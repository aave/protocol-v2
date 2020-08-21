// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {MathUtils} from '../math/MathUtils.sol';
import {IPriceOracleGetter} from '../../interfaces/IPriceOracleGetter.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {IStableDebtToken} from '../../tokenization/interfaces/IStableDebtToken.sol';
import {ReserveConfiguration} from '../configuration/ReserveConfiguration.sol';
import {IReserveInterestRateStrategy} from '../../interfaces/IReserveInterestRateStrategy.sol';
import {WadRayMath} from '../math/WadRayMath.sol';

/**
 * @title ReserveLogic library
 * @author Aave
 * @notice Implements the logic to update the state of the reserves
 */
library ReserveLogic {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  /**
   * @dev Emitted when the state of a reserve is updated
   * @param reserve the address of the reserve
   * @param liquidityRate the new liquidity rate
   * @param stableBorrowRate the new stable borrow rate
   * @param averageStableBorrowRate the new average stable borrow rate
   * @param variableBorrowRate the new variable borrow rate
   * @param liquidityIndex the new liquidity index
   * @param variableBorrowIndex the new variable borrow index
   **/
  event ReserveDataUpdated(
    address indexed reserve,
    uint256 liquidityRate,
    uint256 stableBorrowRate,
    uint256 averageStableBorrowRate,
    uint256 variableBorrowRate,
    uint256 liquidityIndex,
    uint256 variableBorrowIndex
  );

  using ReserveLogic for ReserveLogic.ReserveData;
  using ReserveConfiguration for ReserveConfiguration.Map;

  enum InterestRateMode {NONE, STABLE, VARIABLE}

  // refer to the whitepaper, section 1.1 basic concepts for a formal description of these properties.
  struct ReserveData {
    //the liquidity index. Expressed in ray
    uint256 lastLiquidityIndex;
    //the current supply rate. Expressed in ray
    uint256 currentLiquidityRate;
    //the current variable borrow rate. Expressed in ray
    uint256 currentVariableBorrowRate;
    //the current stable borrow rate. Expressed in ray
    uint256 currentStableBorrowRate;
    //variable borrow index. Expressed in ray
    uint256 lastVariableBorrowIndex;
    //stores the reserve configuration
    ReserveConfiguration.Map configuration;
    address aTokenAddress;
    address stableDebtTokenAddress;
    address variableDebtTokenAddress;
    address interestRateStrategyAddress;
    uint40 lastUpdateTimestamp;
    //the index of the reserve in the list of the active reserves
    uint8 index;
  }

  /**
   * @dev returns the ongoing normalized income for the reserve.
   * a value of 1e27 means there is no income. As time passes, the income is accrued.
   * A value of 2*1e27 means for each unit of assset two units of income have been accrued.
   * @param reserve the reserve object
   * @return the normalized income. expressed in ray
   **/
  function getNormalizedIncome(ReserveData storage reserve) internal view returns (uint256) {
    uint40 timestamp = reserve.lastUpdateTimestamp;

    //solium-disable-next-line
    if (timestamp == uint40(block.timestamp)) {
      //if the index was updated in the same block, no need to perform any calculation
      return reserve.lastLiquidityIndex;
    }

    uint256 cumulated = MathUtils
      .calculateLinearInterest(reserve.currentLiquidityRate, timestamp)
      .rayMul(reserve.lastLiquidityIndex);

    return cumulated;
  }

  /**
   * @dev returns the ongoing normalized variable debt for the reserve.
   * a value of 1e27 means there is no debt. As time passes, the income is accrued.
   * A value of 2*1e27 means that the debt of the reserve is double the initial amount.
   * @param reserve the reserve object
   * @return the normalized variable debt. expressed in ray
   **/
  function getNormalizedDebt(ReserveData storage reserve) internal view returns (uint256) {
    uint40 timestamp = reserve.lastUpdateTimestamp;

    //solium-disable-next-line
    if (timestamp == uint40(block.timestamp)) {
      //if the index was updated in the same block, no need to perform any calculation
      return reserve.lastVariableBorrowIndex;
    }

    uint256 cumulated = MathUtils
      .calculateCompoundedInterest(reserve.currentVariableBorrowRate, timestamp)
      .rayMul(reserve.lastVariableBorrowIndex);

    return cumulated;
  }

  /**
   * @dev Updates the liquidity cumulative index Ci and variable borrow cumulative index Bvc. Refer to the whitepaper for
   * a formal specification.
   * @param reserve the reserve object
   **/
  function updateCumulativeIndexesAndTimestamp(ReserveData storage reserve) internal {
    //only cumulating if there is any income being produced
    if (
      IERC20(reserve.variableDebtTokenAddress).totalSupply() > 0 ||
      IERC20(reserve.stableDebtTokenAddress).totalSupply() > 0
    ) {
      uint256 cumulatedLiquidityInterest = MathUtils.calculateLinearInterest(
        reserve.currentLiquidityRate,
        reserve.lastUpdateTimestamp
      );

      reserve.lastLiquidityIndex = cumulatedLiquidityInterest.rayMul(
        reserve.lastLiquidityIndex
      );

      uint256 cumulatedVariableBorrowInterest = MathUtils.calculateCompoundedInterest(
        reserve.currentVariableBorrowRate,
        reserve.lastUpdateTimestamp
      );
      reserve.lastVariableBorrowIndex = cumulatedVariableBorrowInterest.rayMul(
        reserve.lastVariableBorrowIndex
      );
    }

    //solium-disable-next-line
    reserve.lastUpdateTimestamp = uint40(block.timestamp);
  }

  /**
   * @dev accumulates a predefined amount of asset to the reserve as a fixed, one time income. Used for example to accumulate
   * the flashloan fee to the reserve, and spread it through the depositors.
   * @param reserve the reserve object
   * @param totalLiquidity the total liquidity available in the reserve
   * @param amount the amount to accomulate
   **/
  function cumulateToLiquidityIndex(
    ReserveData storage reserve,
    uint256 totalLiquidity,
    uint256 amount
  ) internal {
    uint256 amountToLiquidityRatio = amount.wadToRay().rayDiv(totalLiquidity.wadToRay());

    uint256 cumulatedLiquidity = amountToLiquidityRatio.add(WadRayMath.ray());

    reserve.lastLiquidityIndex = cumulatedLiquidity.rayMul(
      reserve.lastLiquidityIndex
    );
  }

  /**
   * @dev initializes a reserve
   * @param reserve the reserve object
   * @param aTokenAddress the address of the overlying atoken contract
   * @param interestRateStrategyAddress the address of the interest rate strategy contract
   **/
  function init(
    ReserveData storage reserve,
    address aTokenAddress,
    address stableDebtTokenAddress,
    address variableDebtTokenAddress,
    address interestRateStrategyAddress
  ) external {
    require(reserve.aTokenAddress == address(0), 'Reserve has already been initialized');
    if (reserve.lastLiquidityIndex == 0) {
      //if the reserve has not been initialized yet
      reserve.lastLiquidityIndex = WadRayMath.ray();
    }

    if (reserve.lastVariableBorrowIndex == 0) {
      reserve.lastVariableBorrowIndex = WadRayMath.ray();
    }

    reserve.aTokenAddress = aTokenAddress;
    reserve.stableDebtTokenAddress = stableDebtTokenAddress;
    reserve.variableDebtTokenAddress = variableDebtTokenAddress;
    reserve.interestRateStrategyAddress = interestRateStrategyAddress;
  }

  /**
   * @dev Updates the reserve current stable borrow rate Rf, the current variable borrow rate Rv and the current liquidity rate Rl.
   * Also updates the lastUpdateTimestamp value. Please refer to the whitepaper for further information.
   * @param reserve the address of the reserve to be updated
   * @param liquidityAdded the amount of liquidity added to the protocol (deposit or repay) in the previous action
   * @param liquidityTaken the amount of liquidity taken from the protocol (redeem or borrow)
   **/
  function updateInterestRates(
    ReserveData storage reserve,
    address reserveAddress,
    uint256 liquidityAdded,
    uint256 liquidityTaken
  ) internal {
    uint256 currentAvgStableRate = IStableDebtToken(reserve.stableDebtTokenAddress)
      .getAverageStableRate();

    uint256 balance = IERC20(reserveAddress).balanceOf(reserve.aTokenAddress);

    (
      uint256 newLiquidityRate,
      uint256 newStableRate,
      uint256 newVariableRate
    ) = IReserveInterestRateStrategy(reserve.interestRateStrategyAddress).calculateInterestRates(
      reserveAddress,
      balance.add(liquidityAdded).sub(liquidityTaken),
      IERC20(reserve.stableDebtTokenAddress).totalSupply(),
      IERC20(reserve.variableDebtTokenAddress).totalSupply(),
      currentAvgStableRate
    );

    reserve.currentLiquidityRate = newLiquidityRate;
    reserve.currentStableBorrowRate = newStableRate;
    reserve.currentVariableBorrowRate = newVariableRate;

    emit ReserveDataUpdated(
      reserveAddress,
      newLiquidityRate,
      newStableRate,
      currentAvgStableRate,
      newVariableRate,
      reserve.lastLiquidityIndex,
      reserve.lastVariableBorrowIndex
    );
  }
}
