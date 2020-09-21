// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ReserveLogic} from './ReserveLogic.sol';
import {ReserveConfiguration} from '../configuration/ReserveConfiguration.sol';
import {UserConfiguration} from '../configuration/UserConfiguration.sol';
import {WadRayMath} from '../math/WadRayMath.sol';
import {PercentageMath} from '../math/PercentageMath.sol';
import {IPriceOracleGetter} from '../../interfaces/IPriceOracleGetter.sol';

/**
 * @title GenericLogic library
 * @author Aave
 * @title Implements protocol-level logic to check the status of the user across all the reserves
 */
library GenericLogic {
  using ReserveLogic for ReserveLogic.ReserveData;
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using ReserveConfiguration for ReserveConfiguration.Map;
  using UserConfiguration for UserConfiguration.Map;

  uint256 public constant HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1 ether;
  uint256 public constant HEALTH_FACTOR_CRITICAL_THRESHOLD = 0.98 ether;

  struct balanceDecreaseAllowedLocalVars {
    uint256 decimals;
    uint256 ltv;
    uint256 collateralBalanceETH;
    uint256 borrowBalanceETH;
    uint256 currentLiquidationThreshold;
    uint256 reserveLiquidationThreshold;
    uint256 amountToDecreaseETH;
    uint256 collateralBalancefterDecrease;
    uint256 liquidationThresholdAfterDecrease;
    uint256 healthFactorAfterDecrease;
    bool reserveUsageAsCollateralEnabled;
  }

  /**
   * @dev check if a specific balance decrease is allowed
   * (i.e. doesn't bring the user borrow position health factor under HEALTH_FACTOR_LIQUIDATION_THRESHOLD)
   * @param asset the address of the reserve
   * @param user the address of the user
   * @param amount the amount to decrease
   * @param reservesData the data of all the reserves
   * @param userConfig the user configuration
   * @param reserves the list of all the active reserves
   * @param oracle the address of the oracle contract
   * @return true if the decrease of the balance is allowed
   **/
  function balanceDecreaseAllowed(
    address asset,
    address user,
    uint256 amount,
    mapping(address => ReserveLogic.ReserveData) storage reservesData,
    UserConfiguration.Map calldata userConfig,
    address[] calldata reserves,
    address oracle
  ) external view returns (bool) {
    if (
      !userConfig.isBorrowingAny() ||
      !userConfig.isUsingAsCollateral(reservesData[asset].id)
    ) {
      return true;
    }

    balanceDecreaseAllowedLocalVars memory vars;

    (vars.ltv, , , vars.decimals) = reservesData[asset].configuration.getParams();

    if (vars.ltv == 0) {
      return true; //if reserve is not used as collateral, no reasons to block the transfer
    }

    (
      vars.collateralBalanceETH,
      vars.borrowBalanceETH,
      ,
      vars.currentLiquidationThreshold,

    ) = calculateUserAccountData(user, reservesData, userConfig, reserves, oracle);

    if (vars.borrowBalanceETH == 0) {
      return true; //no borrows - no reasons to block the transfer
    }

    vars.amountToDecreaseETH = IPriceOracleGetter(oracle).getAssetPrice(asset).mul(amount).div(
      10**vars.decimals
    );

    vars.collateralBalancefterDecrease = vars.collateralBalanceETH.sub(vars.amountToDecreaseETH);

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
      vars.liquidationThresholdAfterDecrease
    );

    return healthFactorAfterDecrease > GenericLogic.HEALTH_FACTOR_LIQUIDATION_THRESHOLD;
  }

  struct CalculateUserAccountDataVars {
    uint256 reserveUnitPrice;
    uint256 tokenUnit;
    uint256 compoundedLiquidityBalance;
    uint256 compoundedBorrowBalance;
    uint256 decimals;
    uint256 ltv;
    uint256 liquidationThreshold;
    uint256 i;
    uint256 healthFactor;
    uint256 totalCollateralBalanceETH;
    uint256 totalBorrowBalanceETH;
    uint256 totalFeesETH;
    uint256 avgLtv;
    uint256 avgLiquidationThreshold;
    uint256 reservesLength;
    bool healthFactorBelowThreshold;
    address currentReserveAddress;
    bool usageAsCollateralEnabled;
    bool userUsesReserveAsCollateral;
  }

  /**
   * @dev calculates the user data across the reserves.
   * this includes the total liquidity/collateral/borrow balances in ETH,
   * the average Loan To Value, the average Liquidation Ratio, and the Health factor.
   * @param user the address of the user
   * @param reservesData data of all the reserves
   * @param userConfig the configuration of the user
   * @param reserves the list of the available reserves
   * @param oracle the price oracle address
   * @return the total collateral and total borrow balance of the user in ETH, the avg ltv and liquidation threshold and the HF
   * also the average Ltv, liquidation threshold, and the health factor
   **/
  function calculateUserAccountData(
    address user,
    mapping(address => ReserveLogic.ReserveData) storage reservesData,
    UserConfiguration.Map memory userConfig,
    address[] memory reserves,
    address oracle
  )
    internal
    view
    returns (
      uint256,
      uint256,
      uint256,
      uint256,
      uint256
    )
  {
    CalculateUserAccountDataVars memory vars;

    if (userConfig.isEmpty()) {
      return (0, 0, 0, 0, uint256(-1));
    }
    for (vars.i = 0; vars.i < reserves.length; vars.i++) {
      if (!userConfig.isUsingAsCollateralOrBorrowing(vars.i)) {
        continue;
      }

      vars.currentReserveAddress = reserves[vars.i];
      ReserveLogic.ReserveData storage currentReserve = reservesData[vars.currentReserveAddress];

      (vars.ltv, vars.liquidationThreshold, , vars.decimals) = currentReserve
        .configuration
        .getParams();

      vars.tokenUnit = 10**vars.decimals;
      vars.reserveUnitPrice = IPriceOracleGetter(oracle).getAssetPrice(vars.currentReserveAddress);

      if (vars.ltv != 0 && userConfig.isUsingAsCollateral(vars.i)) {
        vars.compoundedLiquidityBalance = IERC20(currentReserve.aTokenAddress).balanceOf(user);

        uint256 liquidityBalanceETH = vars
          .reserveUnitPrice
          .mul(vars.compoundedLiquidityBalance)
          .div(vars.tokenUnit);

        vars.totalCollateralBalanceETH = vars.totalCollateralBalanceETH.add(liquidityBalanceETH);

        vars.avgLtv = vars.avgLtv.add(liquidityBalanceETH.mul(vars.ltv));
        vars.avgLiquidationThreshold = vars.avgLiquidationThreshold.add(
          liquidityBalanceETH.mul(vars.liquidationThreshold)
        );
      }

      if (userConfig.isBorrowing(vars.i)) {
        vars.compoundedBorrowBalance = IERC20(currentReserve.stableDebtTokenAddress).balanceOf(
          user
        );
        vars.compoundedBorrowBalance = vars.compoundedBorrowBalance.add(
          IERC20(currentReserve.variableDebtTokenAddress).balanceOf(user)
        );

        vars.totalBorrowBalanceETH = vars.totalBorrowBalanceETH.add(
          vars.reserveUnitPrice.mul(vars.compoundedBorrowBalance).div(vars.tokenUnit)
        );
      }
    }

    vars.avgLtv = vars.totalCollateralBalanceETH > 0
      ? vars.avgLtv.div(vars.totalCollateralBalanceETH)
      : 0;
    vars.avgLiquidationThreshold = vars.totalCollateralBalanceETH > 0
      ? vars.avgLiquidationThreshold.div(vars.totalCollateralBalanceETH)
      : 0;

    vars.healthFactor = calculateHealthFactorFromBalances(
      vars.totalCollateralBalanceETH,
      vars.totalBorrowBalanceETH,
      vars.avgLiquidationThreshold
    );
    return (
      vars.totalCollateralBalanceETH,
      vars.totalBorrowBalanceETH,
      vars.avgLtv,
      vars.avgLiquidationThreshold,
      vars.healthFactor
    );
  }

  /**
   * @dev calculates the health factor from the corresponding balances
   * @param collateralBalanceETH the total collateral balance in ETH
   * @param borrowBalanceETH the total borrow balance in ETH
   * @param liquidationThreshold the avg liquidation threshold
   * @return the health factor calculated from the balances provided
   **/
  function calculateHealthFactorFromBalances(
    uint256 collateralBalanceETH,
    uint256 borrowBalanceETH,
    uint256 liquidationThreshold
  ) internal pure returns (uint256) {
    if (borrowBalanceETH == 0) return uint256(-1);

    return (collateralBalanceETH.percentMul(liquidationThreshold)).wadDiv(borrowBalanceETH);
  }

    /**
   * @dev calculates the equivalent amount in ETH that an user can borrow, depending on the available collateral and the
   * average Loan To Value.
   * @param collateralBalanceETH the total collateral balance
   * @param borrowBalanceETH the total borrow balance
   * @param ltv the average loan to value
   * @return the amount available to borrow in ETH for the user
   **/

  function calculateAvailableBorrowsETH(
    uint256 collateralBalanceETH,
    uint256 borrowBalanceETH,
    uint256 ltv
  ) internal pure returns (uint256) {
    uint256 availableBorrowsETH = collateralBalanceETH.percentMul(ltv); //ltv is in percentage

    if (availableBorrowsETH < borrowBalanceETH) {
      return 0;
    }

    availableBorrowsETH = availableBorrowsETH.sub(borrowBalanceETH);
    return availableBorrowsETH;
  }
}
