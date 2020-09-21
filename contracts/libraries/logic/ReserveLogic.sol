// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {MathUtils} from '../math/MathUtils.sol';
import {IPriceOracleGetter} from '../../interfaces/IPriceOracleGetter.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {IAToken} from '../../tokenization/interfaces/IAToken.sol';
import {IStableDebtToken} from '../../tokenization/interfaces/IStableDebtToken.sol';
import {IVariableDebtToken} from '../../tokenization/interfaces/IVariableDebtToken.sol';
import {ReserveConfiguration} from '../configuration/ReserveConfiguration.sol';
import {IReserveInterestRateStrategy} from '../../interfaces/IReserveInterestRateStrategy.sol';
import {WadRayMath} from '../math/WadRayMath.sol';
import {PercentageMath} from '../math/PercentageMath.sol';
import {Errors} from '../helpers/Errors.sol';

/**
 * @title ReserveLogic library
 * @author Aave
 * @notice Implements the logic to update the state of the reserves
 */
library ReserveLogic {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  /**
   * @dev Emitted when the state of a reserve is updated
   * @param reserve the address of the reserve
   * @param liquidityRate the new liquidity rate
   * @param stableBorrowRate the new stable borrow rate
   * @param variableBorrowRate the new variable borrow rate
   * @param liquidityIndex the new liquidity index
   * @param variableBorrowIndex the new variable borrow index
   **/
  event ReserveDataUpdated(
    address indexed reserve,
    uint256 liquidityRate,
    uint256 stableBorrowRate,
    uint256 variableBorrowRate,
    uint256 liquidityIndex,
    uint256 variableBorrowIndex
  );

  using ReserveLogic for ReserveLogic.ReserveData;
  using ReserveConfiguration for ReserveConfiguration.Map;

  enum InterestRateMode {NONE, STABLE, VARIABLE}

  // refer to the whitepaper, section 1.1 basic concepts for a formal description of these properties.
  struct ReserveData {
    //stores the reserve configuration
    ReserveConfiguration.Map configuration;
    //the liquidity index. Expressed in ray
    uint128 liquidityIndex;
    //variable borrow index. Expressed in ray
    uint128 variableBorrowIndex;
    //the current supply rate. Expressed in ray
    uint128 currentLiquidityRate;
    //the current variable borrow rate. Expressed in ray
    uint128 currentVariableBorrowRate;
    //the current stable borrow rate. Expressed in ray
    uint128 currentStableBorrowRate;
    uint40 lastUpdateTimestamp;
    //tokens addresses
    address aTokenAddress;
    address stableDebtTokenAddress;
    address variableDebtTokenAddress;
    //address of the interest rate strategy
    address interestRateStrategyAddress;
    //the id of the reserve. Represents the position in the list of the active reserves
    uint8 id;
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
      return reserve.liquidityIndex;
    }

    uint256 cumulated = MathUtils
      .calculateLinearInterest(reserve.currentLiquidityRate, timestamp)
      .rayMul(reserve.liquidityIndex);

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
      return reserve.variableBorrowIndex;
    }

    uint256 cumulated = MathUtils
      .calculateCompoundedInterest(reserve.currentVariableBorrowRate, timestamp)
      .rayMul(reserve.variableBorrowIndex);

    return cumulated;
  }

  /**
   * @dev returns an address of the debt token used for particular interest rate mode on asset.
   * @param reserve the reserve object
   * @param interestRateMode - STABLE or VARIABLE from ReserveLogic.InterestRateMode enum
   * @return an address of the corresponding debt token from reserve configuration
   **/
  function getDebtTokenAddress(ReserveLogic.ReserveData storage reserve, uint256 interestRateMode)
    external
    view
    returns (address)
  {
    require(
      ReserveLogic.InterestRateMode.STABLE == ReserveLogic.InterestRateMode(interestRateMode) ||
        ReserveLogic.InterestRateMode.VARIABLE == ReserveLogic.InterestRateMode(interestRateMode),
      Errors.INVALID_INTEREST_RATE_MODE_SELECTED
    );
    return
      ReserveLogic.InterestRateMode.STABLE == ReserveLogic.InterestRateMode(interestRateMode)
        ? reserve.stableDebtTokenAddress
        : reserve.variableDebtTokenAddress;
  }

  /**
   * @dev Updates the liquidity cumulative index Ci and variable borrow cumulative index Bvc. Refer to the whitepaper for
   * a formal specification.
   * @param reserve the reserve object
   **/
  function updateState(ReserveData storage reserve) external {
    address variableDebtToken = reserve.variableDebtTokenAddress;
    uint256 previousVariableBorrowIndex = reserve.variableBorrowIndex;
    uint256 previousLiquidityIndex = reserve.liquidityIndex;

    (uint256 newLiquidityIndex, uint256 newVariableBorrowIndex) = _updateIndexes(
      reserve,
      variableDebtToken,
      previousLiquidityIndex,
      previousVariableBorrowIndex
    );

    _mintToTreasury(
      reserve,
      variableDebtToken,
      previousVariableBorrowIndex,
      newLiquidityIndex,
      newVariableBorrowIndex
    );
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
  ) external {
    uint256 amountToLiquidityRatio = amount.wadToRay().rayDiv(totalLiquidity.wadToRay());

    uint256 result = amountToLiquidityRatio.add(WadRayMath.ray());

    result = result.rayMul(reserve.liquidityIndex);
    require(result < (1 << 128), Errors.LIQUIDITY_INDEX_OVERFLOW);

    reserve.liquidityIndex = uint128(result);
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
    require(reserve.aTokenAddress == address(0), Errors.RESERVE_ALREADY_INITIALIZED);
    if (reserve.liquidityIndex == 0) {
      //if the reserve has not been initialized yet
      reserve.liquidityIndex = uint128(WadRayMath.ray());
    }

    if (reserve.variableBorrowIndex == 0) {
      reserve.variableBorrowIndex = uint128(WadRayMath.ray());
    }

    reserve.aTokenAddress = aTokenAddress;
    reserve.stableDebtTokenAddress = stableDebtTokenAddress;
    reserve.variableDebtTokenAddress = variableDebtTokenAddress;
    reserve.interestRateStrategyAddress = interestRateStrategyAddress;
  }

  struct UpdateInterestRatesLocalVars {
    address stableDebtTokenAddress;
    uint256 availableLiquidity;
    uint256 totalStableDebt;
    uint256 newLiquidityRate;
    uint256 newStableRate;
    uint256 newVariableRate;
    uint256 avgStableRate;
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
    address aTokenAddress,
    uint256 liquidityAdded,
    uint256 liquidityTaken
  ) external {
    UpdateInterestRatesLocalVars memory vars;

    vars.stableDebtTokenAddress = reserve.stableDebtTokenAddress;

    (vars.totalStableDebt, vars.avgStableRate) = IStableDebtToken(vars.stableDebtTokenAddress)
      .getTotalSupplyAndAvgRate();

    vars.availableLiquidity = IERC20(reserveAddress).balanceOf(aTokenAddress);

    (
      vars.newLiquidityRate,
      vars.newStableRate,
      vars.newVariableRate
    ) = IReserveInterestRateStrategy(reserve.interestRateStrategyAddress).calculateInterestRates(
      reserveAddress,
      vars.availableLiquidity.add(liquidityAdded).sub(liquidityTaken),
      vars.totalStableDebt,
      IERC20(reserve.variableDebtTokenAddress).totalSupply(),
      vars.avgStableRate,
      reserve.configuration.getReserveFactor()
    );
    require(vars.newLiquidityRate < (1 << 128), 'ReserveLogic: Liquidity rate overflow');
    require(vars.newStableRate < (1 << 128), 'ReserveLogic: Stable borrow rate overflow');
    require(vars.newVariableRate < (1 << 128), 'ReserveLogic: Variable borrow rate overflow');

    reserve.currentLiquidityRate = uint128(vars.newLiquidityRate);
    reserve.currentStableBorrowRate = uint128(vars.newStableRate);
    reserve.currentVariableBorrowRate = uint128(vars.newVariableRate);

    emit ReserveDataUpdated(
      reserveAddress,
      vars.newLiquidityRate,
      vars.newStableRate,
      vars.newVariableRate,
      reserve.liquidityIndex,
      reserve.variableBorrowIndex
    );
  }

  struct MintToTreasuryLocalVars {
    uint256 currentStableDebt;
    uint256 principalStableDebt;
    uint256 previousStableDebt;
    uint256 currentVariableDebt;
    uint256 scaledVariableDebt;
    uint256 previousVariableDebt;
    uint256 avgStableRate;
    uint256 cumulatedStableInterest;
    uint256 totalDebtAccrued;
    uint256 amountToMint;
    uint256 reserveFactor;
    uint40 stableSupplyUpdatedTimestamp;
  }

  /**
   * @dev mints part of the repaid interest to the reserve treasury, depending on the reserveFactor for the
   * specific asset.
   * @param reserve the reserve reserve to be updated
   * @param variableDebtToken the debt token address
   * @param previousVariableBorrowIndex the variable borrow index before the last accumulation of the interest
   * @param newLiquidityIndex the new liquidity index
   * @param newVariableBorrowIndex the variable borrow index after the last accumulation of the interest
   **/
  function _mintToTreasury(
    ReserveData storage reserve,
    address variableDebtToken,
    uint256 previousVariableBorrowIndex,
    uint256 newLiquidityIndex,
    uint256 newVariableBorrowIndex
  ) internal {
    MintToTreasuryLocalVars memory vars;

    vars.reserveFactor = reserve.configuration.getReserveFactor();

    if (vars.reserveFactor == 0) {
      return;
    }

    //fetching the last scaled total variable debt
    vars.scaledVariableDebt = IVariableDebtToken(variableDebtToken).scaledTotalSupply();

    //fetching the principal, total stable debt and the avg stable rate
    (
      vars.principalStableDebt,
      vars.currentStableDebt,
      vars.avgStableRate,
      vars.stableSupplyUpdatedTimestamp
    ) = IStableDebtToken(reserve.stableDebtTokenAddress).getSupplyData();

    //calculate the last principal variable debt
    vars.previousVariableDebt = vars.scaledVariableDebt.rayMul(previousVariableBorrowIndex);

    //calculate the new total supply after accumulation of the index
    vars.currentVariableDebt = vars.scaledVariableDebt.rayMul(newVariableBorrowIndex);

    //calculate the stable debt until the last timestamp update
    vars.cumulatedStableInterest = MathUtils.calculateCompoundedInterest(
      vars.avgStableRate,
      vars.stableSupplyUpdatedTimestamp
    );

    vars.previousStableDebt = vars.principalStableDebt.rayMul(vars.cumulatedStableInterest);

    //debt accrued is the sum of the current debt minus the sum of the debt at the last update
    vars.totalDebtAccrued = vars
      .currentVariableDebt
      .add(vars.currentStableDebt)
      .sub(vars.previousVariableDebt)
      .sub(vars.previousStableDebt);

    vars.amountToMint = vars.totalDebtAccrued.percentMul(vars.reserveFactor);

    IAToken(reserve.aTokenAddress).mintToTreasury(vars.amountToMint, newLiquidityIndex);
  }

  /**
   * @dev updates the reserve indexes and the timestamp of the update
   * @param reserve the reserve reserve to be updated
   * @param variableDebtToken the debt token address
   * @param liquidityIndex the last stored liquidity index
   * @param variableBorrowIndex the last stored variable borrow index
   **/
  function _updateIndexes(
    ReserveData storage reserve,
    address variableDebtToken,
    uint256 liquidityIndex,
    uint256 variableBorrowIndex
  ) internal returns (uint256, uint256) {
    uint40 timestamp = reserve.lastUpdateTimestamp;

    uint256 currentLiquidityRate = reserve.currentLiquidityRate;

    uint256 newLiquidityIndex = liquidityIndex;
    uint256 newVariableBorrowIndex = variableBorrowIndex;

    //only cumulating if there is any income being produced
    if (currentLiquidityRate > 0) {
      uint256 cumulatedLiquidityInterest = MathUtils.calculateLinearInterest(
        currentLiquidityRate,
        timestamp
      );
      newLiquidityIndex = cumulatedLiquidityInterest.rayMul(liquidityIndex);
      require(newLiquidityIndex < (1 << 128), Errors.LIQUIDITY_INDEX_OVERFLOW);

      reserve.liquidityIndex = uint128(newLiquidityIndex);

      //as the liquidity rate might come only from stable rate loans, we need to ensure
      //that there is actual variable debt before accumulating
      if (IERC20(variableDebtToken).totalSupply() > 0) {
        uint256 cumulatedVariableBorrowInterest = MathUtils.calculateCompoundedInterest(
          reserve.currentVariableBorrowRate,
          timestamp
        );
        newVariableBorrowIndex = cumulatedVariableBorrowInterest.rayMul(variableBorrowIndex);
        require(newVariableBorrowIndex < (1 << 128), Errors.VARIABLE_BORROW_INDEX_OVERFLOW);
        reserve.variableBorrowIndex = uint128(newVariableBorrowIndex);
      }
    }

    //solium-disable-next-line
    reserve.lastUpdateTimestamp = uint40(block.timestamp);
    return (newLiquidityIndex, newVariableBorrowIndex);
  }
}
