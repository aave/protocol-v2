// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

import '../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';

import '../configuration/LendingPoolAddressesProvider.sol';
import '../tokenization/AToken.sol';
import '../tokenization/interfaces/IStableDebtToken.sol';
import '../tokenization/interfaces/IVariableDebtToken.sol';
import '../libraries/WadRayMath.sol';
import '../interfaces/IPriceOracleGetter.sol';
import '../libraries/GenericLogic.sol';
import '../libraries/UserLogic.sol';
import '../libraries/ReserveLogic.sol';
import '../libraries/UniversalERC20.sol';
import '../libraries/ReserveConfiguration.sol';
import {PercentageMath} from '../libraries/PercentageMath.sol';

/**
 * @title LendingPoolLiquidationManager contract
 * @author Aave
 * @notice Implements the liquidation function.
 **/
contract LendingPoolLiquidationManager is ReentrancyGuard, VersionedInitializable {
  using UniversalERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using Address for address;
  using ReserveLogic for ReserveLogic.ReserveData;
  using UserLogic for UserLogic.UserReserveData;
  using ReserveConfiguration for ReserveConfiguration.Map;

  LendingPoolAddressesProvider public addressesProvider;
  IFeeProvider feeProvider;

  mapping(address => ReserveLogic.ReserveData) internal reserves;
  mapping(address => mapping(address => UserLogic.UserReserveData)) internal usersReserveData;

  address[] public reservesList;

  uint256 constant LIQUIDATION_CLOSE_FACTOR_PERCENT = 50;

  /**
   * @dev emitted when a borrower is liquidated
   * @param _collateral the address of the collateral being liquidated
   * @param _reserve the address of the reserve
   * @param _user the address of the user being liquidated
   * @param _purchaseAmount the total amount liquidated
   * @param _liquidatedCollateralAmount the amount of collateral being liquidated
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
    uint256 userStableDebt;
    uint256 userVariableDebt;
    uint256 maxPrincipalAmountToLiquidate;
    uint256 actualAmountToLiquidate;
    uint256 liquidationRatio;
    uint256 maxAmountCollateralToLiquidate;
    uint256 originationFee;
    uint256 feeLiquidated;
    uint256 liquidatedCollateralForFee;
    ReserveLogic.InterestRateMode borrowRateMode;
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
    ReserveLogic.ReserveData storage principalReserve = reserves[_reserve];
    ReserveLogic.ReserveData storage collateralReserve = reserves[_collateral];
    UserLogic.UserReserveData storage userCollateral = usersReserveData[_user][_collateral];

    LiquidationCallLocalVars memory vars;

    (, , , , vars.healthFactor) = GenericLogic.calculateUserAccountData(
      _user,
      reserves,
      usersReserveData,
      reservesList,
      addressesProvider.getPriceOracle()
    );

    if (vars.healthFactor >= GenericLogic.HEALTH_FACTOR_LIQUIDATION_THRESHOLD) {
      return (
        uint256(LiquidationErrors.HEALTH_FACTOR_ABOVE_THRESHOLD),
        'Health factor is not below the threshold'
      );
    }

    vars.userCollateralBalance = IERC20(collateralReserve.aTokenAddress).balanceOf(_user);

    //if _user hasn't deposited this specific collateral, nothing can be liquidated
    if (vars.userCollateralBalance == 0) {
      return (
        uint256(LiquidationErrors.NO_COLLATERAL_AVAILABLE),
        'Invalid collateral to liquidate'
      );
    }

    vars.isCollateralEnabled =
      collateralReserve.configuration.getLiquidationThreshold() > 0 &&
      userCollateral.useAsCollateral;

    //if _collateral isn't enabled as collateral by _user, it cannot be liquidated
    if (!vars.isCollateralEnabled) {
      return (
        uint256(LiquidationErrors.COLLATERAL_CANNOT_BE_LIQUIDATED),
        'The collateral chosen cannot be liquidated'
      );
    }

    //if the user hasn't borrowed the specific currency defined by _reserve, it cannot be liquidated
    (vars.userStableDebt, vars.userVariableDebt) = UserLogic.getUserCurrentDebt(
      _user,
      principalReserve
    );

    if (vars.userStableDebt == 0 && vars.userVariableDebt == 0) {
      return (
        uint256(LiquidationErrors.CURRRENCY_NOT_BORROWED),
        'User did not borrow the specified currency'
      );
    }

    //all clear - calculate the max principal amount that can be liquidated
    vars.maxPrincipalAmountToLiquidate = vars.userStableDebt.add(vars.userVariableDebt).percentMul(
      LIQUIDATION_CLOSE_FACTOR_PERCENT
    );

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

    vars.collateralAtoken = AToken(payable(collateralReserve.aTokenAddress));

    //if liquidator reclaims the underlying asset, we make sure there is enough available collateral in the reserve
    if (!_receiveAToken) {
      uint256 currentAvailableCollateral = IERC20(_collateral).universalBalanceOf(
        address(vars.collateralAtoken)
      );
      if (currentAvailableCollateral < vars.maxCollateralToLiquidate) {
        return (
          uint256(LiquidationErrors.NOT_ENOUGH_LIQUIDITY),
          "There isn't enough liquidity available to liquidate"
        );
      }
    }

    //update the principal reserve
    principalReserve.updateCumulativeIndexesAndTimestamp();
    principalReserve.updateInterestRates(_reserve, vars.actualAmountToLiquidate, 0);

    if (vars.userVariableDebt >= vars.actualAmountToLiquidate) {
      IVariableDebtToken(principalReserve.variableDebtTokenAddress).burn(
        _user,
        vars.actualAmountToLiquidate
      );
    } else {
      IVariableDebtToken(principalReserve.variableDebtTokenAddress).burn(
        _user,
        vars.userVariableDebt
      );
      IStableDebtToken(principalReserve.stableDebtTokenAddress).burn(
        _user,
        vars.actualAmountToLiquidate.sub(vars.userVariableDebt)
      );
    }

    //if liquidator reclaims the aToken, he receives the equivalent atoken amount
    if (_receiveAToken) {
      vars.collateralAtoken.transferOnLiquidation(_user, msg.sender, vars.maxCollateralToLiquidate);
    } else {
      //otherwise receives the underlying asset

      //updating collateral reserve
      collateralReserve.updateCumulativeIndexesAndTimestamp();
      collateralReserve.updateInterestRates(_collateral, 0, vars.maxCollateralToLiquidate);

      //burn the equivalent amount of atoken
      vars.collateralAtoken.burnOnLiquidation(_user, vars.maxCollateralToLiquidate);
      vars.collateralAtoken.transferUnderlyingTo(msg.sender, vars.maxCollateralToLiquidate);
    }

    //transfers the principal currency to the aToken
    IERC20(_reserve).universalTransferFrom(
      msg.sender,
      principalReserve.aTokenAddress,
      vars.actualAmountToLiquidate,
      true
    );

    emit LiquidationCall(
      _collateral,
      _reserve,
      _user,
      vars.actualAmountToLiquidate,
      vars.maxCollateralToLiquidate,
      msg.sender,
      _receiveAToken,
      //solium-disable-next-line
      block.timestamp
    );

    return (uint256(LiquidationErrors.NO_ERROR), 'No errors');
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
    ReserveLogic.ReserveData storage _collateralReserve,
    ReserveLogic.ReserveData storage _principalReserve,
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

    (, , vars.liquidationBonus, vars.collateralDecimals) = _collateralReserve
      .configuration
      .getParams();
    vars.principalDecimals = _principalReserve.configuration.getDecimals();

    //this is the maximum possible amount of the selected collateral that can be liquidated, given the
    //max amount of principal currency that is available for liquidation.
    vars.maxAmountCollateralToLiquidate = vars
      .principalCurrencyPrice
      .mul(_purchaseAmount)
      .mul(10**vars.collateralDecimals)
      .div(vars.collateralPrice.mul(10**vars.principalDecimals))
      .percentMul(vars.liquidationBonus);

    if (vars.maxAmountCollateralToLiquidate > _userCollateralBalance) {
      collateralAmount = _userCollateralBalance;
      principalAmountNeeded = vars
        .collateralPrice
        .mul(collateralAmount)
        .mul(10**vars.principalDecimals)
        .div(vars.principalCurrencyPrice.mul(10**vars.collateralDecimals))
        .percentDiv(vars.liquidationBonus);
    } else {
      collateralAmount = vars.maxAmountCollateralToLiquidate;
      principalAmountNeeded = _purchaseAmount;
    }

    return (collateralAmount, principalAmountNeeded);
  }
}
