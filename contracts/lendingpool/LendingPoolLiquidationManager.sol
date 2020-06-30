// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../libraries/openzeppelin-upgradeability/VersionedInitializable.sol";

import "../configuration/LendingPoolAddressesProvider.sol";
import "../tokenization/AToken.sol";
import "../libraries/CoreLibrary.sol";
import "../libraries/WadRayMath.sol";
import "../interfaces/IPriceOracleGetter.sol";
import {IFeeProvider} from "../interfaces/IFeeProvider.sol";
import "../libraries/EthAddressLib.sol";
import "../libraries/GenericLogic.sol";
import "../libraries/UserLogic.sol";
import "../libraries/ReserveLogic.sol";
import "../libraries/UniversalERC20.sol";

/**
* @title LendingPoolLiquidationManager contract
* @author Aave
* @notice Implements the liquidation function.
**/
contract LendingPoolLiquidationManager is ReentrancyGuard, VersionedInitializable {
    using UniversalERC20 for IERC20;
    using SafeMath for uint256;
    using WadRayMath for uint256;
    using Address for address;
    using ReserveLogic for CoreLibrary.ReserveData;
    using UserLogic for CoreLibrary.UserReserveData;

    LendingPoolAddressesProvider public addressesProvider;
    IFeeProvider feeProvider;

    mapping(address => CoreLibrary.ReserveData) internal reserves;
    mapping(address => mapping(address => CoreLibrary.UserReserveData)) internal usersReserveData;

    address[] public reservesList;

    uint256 constant LIQUIDATION_CLOSE_FACTOR_PERCENT = 50;

    /**
    * @dev emitted when a borrow fee is liquidated
    * @param _collateral the address of the collateral being liquidated
    * @param _reserve the address of the reserve
    * @param _user the address of the user being liquidated
    * @param _feeLiquidated the total fee liquidated
    * @param _liquidatedCollateralForFee the amount of collateral received by the protocol in exchange for the fee
    * @param _timestamp the timestamp of the action
    **/
    event OriginationFeeLiquidated(
        address indexed _collateral,
        address indexed _reserve,
        address indexed _user,
        uint256 _feeLiquidated,
        uint256 _liquidatedCollateralForFee,
        uint256 _timestamp
    );

    /**
    * @dev emitted when a borrower is liquidated
    * @param _collateral the address of the collateral being liquidated
    * @param _reserve the address of the reserve
    * @param _user the address of the user being liquidated
    * @param _purchaseAmount the total amount liquidated
    * @param _liquidatedCollateralAmount the amount of collateral being liquidated
    * @param _accruedBorrowInterest the amount of interest accrued by the borrower since the last action
    * @param _liquidator the address of the liquidator
    * @param _receiveAToken true if the liquidator wants to receive aTokens, false otherwise
    * @param _timestamp the timestamp of the action
    **/
    event LiquidationCall(
        address indexed _collateral,
        address indexed _reserve,
        address indexed _user,
        uint256 _purchaseAmount,
        uint256 _liquidatedCollateralAmount,
        uint256 _accruedBorrowInterest,
        address _liquidator,
        bool _receiveAToken,
        uint256 _timestamp
    );

    enum LiquidationErrors {
        NO_ERROR,
        NO_COLLATERAL_AVAILABLE,
        COLLATERAL_CANNOT_BE_LIQUIDATED,
        CURRRENCY_NOT_BORROWED,
        HEALTH_FACTOR_ABOVE_THRESHOLD,
        NOT_ENOUGH_LIQUIDITY
    }

    struct LiquidationCallLocalVars {
        uint256 userCollateralBalance;
        uint256 userCompoundedBorrowBalance;
        uint256 borrowBalanceIncrease;
        uint256 maxPrincipalAmountToLiquidate;
        uint256 actualAmountToLiquidate;
        uint256 liquidationRatio;
        uint256 maxAmountCollateralToLiquidate;
        uint256 originationFee;
        uint256 feeLiquidated;
        uint256 liquidatedCollateralForFee;
        CoreLibrary.InterestRateMode borrowRateMode;
        uint256 userStableRate;
        uint256 maxCollateralToLiquidate;
        uint256 principalAmountNeeded;
        uint256 healthFactor;
        AToken collateralAtoken;
        bool isCollateralEnabled;
    }

    /**
    * @dev as the contract extends the VersionedInitializable contract to match the state
    * of the LendingPool contract, the getRevision() function is needed.
    */
    function getRevision() internal override pure returns (uint256) {
        return 0;
    }

    /**
    * @dev users can invoke this function to liquidate an undercollateralized position.
    * @param _reserve the address of the collateral to liquidated
    * @param _reserve the address of the principal reserve
    * @param _user the address of the borrower
    * @param _purchaseAmount the amount of principal that the liquidator wants to repay
    * @param _receiveAToken true if the liquidators wants to receive the aTokens, false if
    * he wants to receive the underlying asset directly
    **/
    function liquidationCall(
        address _collateral,
        address _reserve,
        address _user,
        uint256 _purchaseAmount,
        bool _receiveAToken
    ) external payable returns (uint256, string memory) {
        CoreLibrary.ReserveData storage principalReserve = reserves[_reserve];
        CoreLibrary.ReserveData storage collateralReserve = reserves[_collateral];
        CoreLibrary.UserReserveData storage userPrincipal = usersReserveData[msg.sender][_reserve];
        CoreLibrary.UserReserveData storage userCollateral = usersReserveData[msg
            .sender][_collateral];

        LiquidationCallLocalVars memory vars;

        (, , , , , vars.healthFactor) = GenericLogic.calculateUserAccountData(
            msg.sender,
            reserves,
            usersReserveData,
            reservesList,
            addressesProvider.getPriceOracle()
        );

        if (vars.healthFactor >= GenericLogic.HEALTH_FACTOR_LIQUIDATION_THRESHOLD) {
            return (
                uint256(LiquidationErrors.HEALTH_FACTOR_ABOVE_THRESHOLD),
                "Health factor is not below the threshold"
            );
        }

        vars.userCollateralBalance = IERC20(_collateral).balanceOf(_user);

        //if _user hasn't deposited this specific collateral, nothing can be liquidated
        if (vars.userCollateralBalance == 0) {
            return (
                uint256(LiquidationErrors.NO_COLLATERAL_AVAILABLE),
                "Invalid collateral to liquidate"
            );
        }

        vars.isCollateralEnabled =
            collateralReserve.usageAsCollateralEnabled &&
            userCollateral.useAsCollateral;

        //if _collateral isn't enabled as collateral by _user, it cannot be liquidated
        if (!vars.isCollateralEnabled) {
            return (
                uint256(LiquidationErrors.COLLATERAL_CANNOT_BE_LIQUIDATED),
                "The collateral chosen cannot be liquidated"
            );
        }

        //if the user hasn't borrowed the specific currency defined by _reserve, it cannot be liquidated
        (,vars.userCompoundedBorrowBalance) = UserLogic.getUserBorrowBalances(_user, principalReserve);

        if (vars.userCompoundedBorrowBalance == 0) {
            return (
                uint256(LiquidationErrors.CURRRENCY_NOT_BORROWED),
                "User did not borrow the specified currency"
            );
        }

        //all clear - calculate the max principal amount that can be liquidated
        vars.maxPrincipalAmountToLiquidate = vars
            .userCompoundedBorrowBalance
            .mul(LIQUIDATION_CLOSE_FACTOR_PERCENT)
            .div(100);

        vars.actualAmountToLiquidate = _purchaseAmount > vars.maxPrincipalAmountToLiquidate
            ? vars.maxPrincipalAmountToLiquidate
            : _purchaseAmount;

        (
            vars.maxCollateralToLiquidate,
            vars.principalAmountNeeded
        ) = calculateAvailableCollateralToLiquidate(
            collateralReserve,
            principalReserve,
            _collateral,
            _reserve,
            vars.actualAmountToLiquidate,
            vars.userCollateralBalance
        );

          
        //if principalAmountNeeded < vars.ActualAmountToLiquidate, there isn't enough
        //of _collateral to cover the actual amount that is being liquidated, hence we liquidate
        //a smaller amount

        if (vars.principalAmountNeeded < vars.actualAmountToLiquidate) {
            vars.actualAmountToLiquidate = vars.principalAmountNeeded;
        }

        //if liquidator reclaims the underlying asset, we make sure there is enough available collateral in the reserve
        if (!_receiveAToken) {
            uint256 currentAvailableCollateral = IERC20(_collateral).universalBalanceOf(address(this));
            if (currentAvailableCollateral < vars.maxCollateralToLiquidate) {
                return (
                    uint256(LiquidationErrors.NOT_ENOUGH_LIQUIDITY),
                    "There isn't enough liquidity available to liquidate"
                );
            }
        }

        collateralReserve.updateStateOnLiquidationAsCollateral(
            _collateral,
            vars.maxCollateralToLiquidate,
            _receiveAToken
        );

        vars.collateralAtoken = AToken(collateralReserve.aTokenAddress);

        //if liquidator reclaims the aToken, he receives the equivalent atoken amount
        if (_receiveAToken) {
            vars.collateralAtoken.transferOnLiquidation(
                _user,
                msg.sender,
                vars.maxCollateralToLiquidate
            );
        } else {
            //otherwise receives the underlying asset
            //burn the equivalent amount of atoken
            vars.collateralAtoken.burnOnLiquidation(_user, vars.maxCollateralToLiquidate);
            IERC20(_collateral).universalTransfer(msg.sender, vars.maxCollateralToLiquidate);
        }

        //transfers the principal currency to the pool
        IERC20(_reserve).universalTransferFromSenderToThis(vars.actualAmountToLiquidate, true);

        if (vars.feeLiquidated > 0) {
            //if there is enough collateral to liquidate the fee, first transfer burn an equivalent amount of
            //aTokens of the user
            vars.collateralAtoken.burnOnLiquidation(_user, vars.liquidatedCollateralForFee);

            //then liquidate the fee by transferring it to the fee collection address
            IERC20(_collateral).universalTransfer(
                addressesProvider.getTokenDistributor(),
                vars.liquidatedCollateralForFee
            );

            emit OriginationFeeLiquidated(
                _collateral,
                _reserve,
                _user,
                vars.feeLiquidated,
                vars.liquidatedCollateralForFee,
                //solium-disable-next-line
                block.timestamp
            );

        }
        emit LiquidationCall(
            _collateral,
            _reserve,
            _user,
            vars.actualAmountToLiquidate,
            vars.maxCollateralToLiquidate,
            vars.borrowBalanceIncrease,
            msg.sender,
            _receiveAToken,
            //solium-disable-next-line
            block.timestamp
        );

        return (uint256(LiquidationErrors.NO_ERROR), "No errors");
    }

    struct AvailableCollateralToLiquidateLocalVars {
        uint256 userCompoundedBorrowBalance;
        uint256 liquidationBonus;
        uint256 collateralPrice;
        uint256 principalCurrencyPrice;
        uint256 maxAmountCollateralToLiquidate;
        uint256 principalDecimals;
        uint256 collateralDecimals;
    }

    /**
    * @dev calculates how much of a specific collateral can be liquidated, given
    * a certain amount of principal currency. This function needs to be called after
    * all the checks to validate the liquidation have been performed, otherwise it might fail.
    * @param _collateralAddress the collateral to be liquidated
    * @param _principalAddress the principal currency to be liquidated
    * @param _purchaseAmount the amount of principal being liquidated
    * @param _userCollateralBalance the collatera balance for the specific _collateral asset of the user being liquidated
    * @return collateralAmount the maximum amount that is possible to liquidated given all the liquidation constraints (user balance, close factor)
    * @return principalAmountNeeded the purchase amount
    **/
    function calculateAvailableCollateralToLiquidate(
        CoreLibrary.ReserveData storage _collateralReserve,
        CoreLibrary.ReserveData storage _principalReserve,
        address _collateralAddress,
        address _principalAddress,
        uint256 _purchaseAmount,
        uint256 _userCollateralBalance
    ) internal view returns (uint256 collateralAmount, uint256 principalAmountNeeded) {
        collateralAmount = 0;
        principalAmountNeeded = 0;
        IPriceOracleGetter oracle = IPriceOracleGetter(addressesProvider.getPriceOracle());

        // Usage of a memory struct of vars to avoid "Stack too deep" errors due to local variables
        AvailableCollateralToLiquidateLocalVars memory vars;

        vars.collateralPrice = oracle.getAssetPrice(_collateralAddress);
        vars.principalCurrencyPrice = oracle.getAssetPrice(_principalAddress);
        vars.liquidationBonus = _collateralReserve.liquidationBonus;
        vars.principalDecimals = _principalReserve.decimals;
        vars.collateralDecimals = _collateralReserve.decimals;

        //this is the maximum possible amount of the selected collateral that can be liquidated, given the
        //max amount of principal currency that is available for liquidation.
        vars.maxAmountCollateralToLiquidate = vars
            .principalCurrencyPrice
            .mul(_purchaseAmount)
            .mul(10 ** vars.collateralDecimals)
            .div(vars.collateralPrice.mul(10 ** vars.principalDecimals))
            .mul(vars.liquidationBonus)
            .div(100);

        if (vars.maxAmountCollateralToLiquidate > _userCollateralBalance) {
            collateralAmount = _userCollateralBalance;
            principalAmountNeeded = vars
                .collateralPrice
                .mul(collateralAmount)
                .mul(10 ** vars.principalDecimals)
                .div(vars.principalCurrencyPrice.mul(10 ** vars.collateralDecimals))
                .mul(100)
                .div(vars.liquidationBonus);
        } else {
            collateralAmount = vars.maxAmountCollateralToLiquidate;
            principalAmountNeeded = _purchaseAmount;
        }

        return (collateralAmount, principalAmountNeeded);
    }
}
