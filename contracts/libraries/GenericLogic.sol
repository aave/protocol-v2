// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ReserveLogic} from "./ReserveLogic.sol";
import {UserLogic} from "./UserLogic.sol";
import {WadRayMath} from "./WadRayMath.sol";

import "../interfaces/IPriceOracleGetter.sol";
import {IFeeProvider} from "../interfaces/IFeeProvider.sol";
import '@nomiclabs/buidler/console.sol';

/**
* @title GenericLogic library
* @author Aave
* @title Implements protocol-level logic to check the status of the user across all the reserves
*/
library GenericLogic {
    using ReserveLogic for ReserveLogic.ReserveData;
    using UserLogic for UserLogic.UserReserveData;
    using SafeMath for uint256;
    using WadRayMath for uint256;

    uint256 public constant HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1e18;

    struct balanceDecreaseAllowedLocalVars {
        uint256 decimals;
        uint256 collateralBalanceETH;
        uint256 borrowBalanceETH;
        uint256 totalFeesETH;
        uint256 currentLiquidationThreshold;
        uint256 reserveLiquidationThreshold;
        uint256 amountToDecreaseETH;
        uint256 collateralBalancefterDecrease;
        uint256 liquidationThresholdAfterDecrease;
        uint256 healthFactorAfterDecrease;
        bool reserveUsageAsCollateralEnabled;
    }

    /**
    * @dev check if a specific balance decrease is allowed (i.e. doesn't bring the user borrow position health factor under HEALTH_FACTOR_LIQUIDATION_THRESHOLD)
    * @param _reserve the address of the reserve
    * @param _user the address of the user
    * @param _amount the amount to decrease
    * @return true if the decrease of the balance is allowed
    **/
    function balanceDecreaseAllowed(
        address _reserve,
        address _user,
        uint256 _amount,
        mapping(address => ReserveLogic.ReserveData) storage _reservesData,
        mapping(address => mapping(address => UserLogic.UserReserveData)) storage _usersData,
        address[] calldata _reserves,
        address _oracle
    ) external view returns (bool) {
        // Usage of a memory struct of vars to avoid "Stack too deep" errors due to local variables
        balanceDecreaseAllowedLocalVars memory vars;

        if (
            !_reservesData[_reserve].usageAsCollateralEnabled ||
            !_usersData[_user][_reserve].useAsCollateral
        ) {
            return true; //if reserve is not used as collateral, no reasons to block the transfer
        }

        (
            vars.collateralBalanceETH,
            vars.borrowBalanceETH,
            vars.totalFeesETH,
            ,
            vars.currentLiquidationThreshold,
        ) = calculateUserAccountData(_user, _reservesData, _usersData, _reserves, _oracle);

        if (vars.borrowBalanceETH == 0) {
            return true; //no borrows - no reasons to block the transfer
        }

        vars.amountToDecreaseETH = IPriceOracleGetter(_oracle)
            .getAssetPrice(_reserve)
            .mul(_amount)
            .div(10 ** _reservesData[_reserve].decimals);

        vars.collateralBalancefterDecrease = vars.collateralBalanceETH.sub(
            vars.amountToDecreaseETH
        );

        //if there is a borrow, there can't be 0 collateral
        if (vars.collateralBalancefterDecrease == 0) {
            return false;
        }

        vars.liquidationThresholdAfterDecrease = vars
            .collateralBalanceETH
            .mul(vars.currentLiquidationThreshold)
            .sub(vars.amountToDecreaseETH.mul(vars.reserveLiquidationThreshold))
            .div(vars.collateralBalancefterDecrease);

        uint256 healthFactorAfterDecrease = calculateHealthFactorFromBalances(
            vars.collateralBalancefterDecrease,
            vars.borrowBalanceETH,
            vars.totalFeesETH,
            vars.liquidationThresholdAfterDecrease
        );

        return healthFactorAfterDecrease > GenericLogic.HEALTH_FACTOR_LIQUIDATION_THRESHOLD;

    }

    struct CalculateUserAccountDataVars {
        uint256 reserveUnitPrice;
        uint256 tokenUnit;
        uint256 compoundedLiquidityBalance;
        uint256 compoundedBorrowBalance;
        uint256 reserveDecimals;
        uint256 baseLtv;
        uint256 liquidationThreshold;
        uint256 originationFee;
        uint256 i;
        uint256 healthFactor;
        uint256 totalCollateralBalanceETH;
        uint256 totalBorrowBalanceETH;
        uint256 totalFeesETH;
        uint256 currentLtv;
        uint256 currentLiquidationThreshold;
        bool healthFactorBelowThreshold;
        address currentReserveAddress;
        bool usageAsCollateralEnabled;
        bool userUsesReserveAsCollateral;
    }

    /**
    * @dev calculates the user data across the reserves.
    * this includes the total liquidity/collateral/borrow balances in ETH,
    * the average Loan To Value, the average Liquidation Ratio, and the Health factor.
    * @param _user the address of the user
    * @param _reservesData data of all the reserves
    * @param _usersReserveData data
    * @return the total liquidity, total collateral, total borrow balances of the user in ETH.
    * also the average Ltv, liquidation threshold, and the health factor
    **/
    function calculateUserAccountData(
        address _user,
        mapping(address => ReserveLogic.ReserveData) storage _reservesData,
        mapping(address => mapping(address => UserLogic.UserReserveData)) storage _usersReserveData,
        address[] memory _reserves,
        address _oracle
    ) public view returns (uint256, uint256, uint256, uint256, uint256, uint256) {
        CalculateUserAccountDataVars memory vars;

        for (vars.i = 0; vars.i < _reserves.length; vars.i++) {

            vars.currentReserveAddress = _reserves[vars.i];

            ReserveLogic.ReserveData storage currentReserve = _reservesData[vars
                .currentReserveAddress];

            vars.compoundedLiquidityBalance = IERC20(currentReserve.aTokenAddress).balanceOf(_user);
            vars.compoundedBorrowBalance = IERC20(currentReserve.stableDebtTokenAddress).balanceOf(_user);
            vars.compoundedBorrowBalance = vars.compoundedBorrowBalance.add(IERC20(currentReserve.variableDebtTokenAddress).balanceOf(_user));

            if (vars.compoundedLiquidityBalance == 0 && vars.compoundedBorrowBalance == 0) {
                continue;
            }

            vars.tokenUnit = 10 ** currentReserve.decimals;
            vars.reserveUnitPrice = IPriceOracleGetter(_oracle).getAssetPrice(_reserves[vars.i]);

            //liquidity and collateral balance
            if (vars.compoundedLiquidityBalance > 0) {
                uint256 liquidityBalanceETH = vars
                    .reserveUnitPrice
                    .mul(vars.compoundedLiquidityBalance)
                    .div(vars.tokenUnit);

                if (
                    currentReserve.usageAsCollateralEnabled &&
                    _usersReserveData[_user][_reserves[vars.i]].useAsCollateral
                ) {
                    vars.totalCollateralBalanceETH = vars.totalCollateralBalanceETH.add(
                        liquidityBalanceETH
                    );
                    vars.currentLtv = vars.currentLtv.add(
                        liquidityBalanceETH.mul(currentReserve.baseLTVasCollateral)
                    );
                    vars.currentLiquidationThreshold = vars.currentLiquidationThreshold.add(
                        liquidityBalanceETH.mul(currentReserve.liquidationThreshold)
                    );
                }
            }

            if (vars.compoundedBorrowBalance > 0) {
                vars.totalBorrowBalanceETH = vars.totalBorrowBalanceETH.add(
                    vars.reserveUnitPrice.mul(vars.compoundedBorrowBalance).div(vars.tokenUnit)
                );
                vars.totalFeesETH = vars.totalFeesETH.add(
                    vars.originationFee.mul(vars.reserveUnitPrice).div(vars.tokenUnit)
                );
            }
        }

        vars.currentLtv = vars.totalCollateralBalanceETH > 0
            ? vars.currentLtv.div(vars.totalCollateralBalanceETH)
            : 0;
        vars.currentLiquidationThreshold = vars.totalCollateralBalanceETH > 0
            ? vars.currentLiquidationThreshold.div(vars.totalCollateralBalanceETH)
            : 0;

        vars.healthFactor = calculateHealthFactorFromBalances(
            vars.totalCollateralBalanceETH,
            vars.totalBorrowBalanceETH,
            vars.totalFeesETH,
            vars.currentLiquidationThreshold
        );
        return (
            vars.totalCollateralBalanceETH,
            vars.totalBorrowBalanceETH,
            vars.totalFeesETH,
            vars.currentLtv,
            vars.currentLiquidationThreshold,
            vars.healthFactor
        );
    }

    /**
    * @dev calculates the health factor from the corresponding balances
    * @param collateralBalanceETH the total collateral balance in ETH
    * @param borrowBalanceETH the total borrow balance in ETH
    * @param totalFeesETH the total fees in ETH
    * @param liquidationThreshold the avg liquidation threshold
    * @return the health factor calculated from the balances provided
    **/
    function calculateHealthFactorFromBalances(
        uint256 collateralBalanceETH,
        uint256 borrowBalanceETH,
        uint256 totalFeesETH,
        uint256 liquidationThreshold
    ) internal view returns (uint256) {

        console.log("Borrow balance ETH is %s", borrowBalanceETH);

        if (borrowBalanceETH == 0) return uint256(-1);

        return
            (collateralBalanceETH.mul(liquidationThreshold).div(100)).wadDiv(
                borrowBalanceETH.add(totalFeesETH)
            );
    }

    /**
    * @dev calculates the equivalent amount in ETH that an user can borrow, depending on the available collateral and the
    * average Loan To Value.
    * @param collateralBalanceETH the total collateral balance
    * @param borrowBalanceETH the total borrow balance
    * @param totalFeesETH the total fees
    * @param ltv the average loan to value
    * @return the amount available to borrow in ETH for the user
    **/

    function calculateAvailableBorrowsETH(
        uint256 collateralBalanceETH,
        uint256 borrowBalanceETH,
        uint256 totalFeesETH,
        uint256 ltv,
        address _feeProvider
    ) external view returns (uint256) {
        uint256 availableBorrowsETH = collateralBalanceETH.mul(ltv).div(100); //ltv is in percentage

        if (availableBorrowsETH < borrowBalanceETH) {
            return 0;
        }

        availableBorrowsETH = availableBorrowsETH.sub(borrowBalanceETH.add(totalFeesETH));
        //calculate fee
        uint256 borrowFee = IFeeProvider(_feeProvider).calculateLoanOriginationFee(
            msg.sender,
            availableBorrowsETH
        );
        return availableBorrowsETH.sub(borrowFee);
    }

}
