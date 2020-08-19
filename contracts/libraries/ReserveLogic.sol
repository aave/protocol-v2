// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {MathUtils} from './MathUtils.sol';
import {IPriceOracleGetter} from '../interfaces/IPriceOracleGetter.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {IStableDebtToken} from '../tokenization/interfaces/IStableDebtToken.sol';
import {ReserveConfiguration} from './ReserveConfiguration.sol';

import {IReserveInterestRateStrategy} from '../interfaces/IReserveInterestRateStrategy.sol';
import {WadRayMath} from './WadRayMath.sol';

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
   * @dev NOTE: This event replaces the Deprecated ReserveUpdated() event, which didn't emit the average stable borrow rate
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
    uint256 lastLiquidityCumulativeIndex;
    //the current supply rate. Expressed in ray
    uint256 currentLiquidityRate;
    //the current variable borrow rate. Expressed in ray
    uint256 currentVariableBorrowRate;
    //the current stable borrow rate. Expressed in ray
    uint256 currentStableBorrowRate;
    //variable borrow index. Expressed in ray
    uint256 lastVariableBorrowCumulativeIndex;
    //stores the reserve configuration
    ReserveConfiguration.Map configuration;
    address payable aTokenAddress;
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
   * @param _reserve the reserve object
   * @return the normalized income. expressed in ray
   **/
  function getNormalizedIncome(ReserveData storage _reserve) internal view returns (uint256) {
    uint40 timestamp = _reserve.lastUpdateTimestamp;

    //solium-disable-next-line
    if (timestamp == uint40(block.timestamp)) {
      //if the index was updated in the same block, no need to perform any calculation
      return _reserve.lastLiquidityCumulativeIndex;
    }

    uint256 cumulated = MathUtils
      .calculateLinearInterest(_reserve.currentLiquidityRate, timestamp)
      .rayMul(_reserve.lastLiquidityCumulativeIndex);

    return cumulated;
  }

  /**
   * @dev returns the ongoing normalized variable debt for the reserve.
   * a value of 1e27 means there is no debt. As time passes, the income is accrued.
   * A value of 2*1e27 means that the debt of the reserve is double the initial amount.
   * @param _reserve the reserve object
   * @return the normalized variable debt. expressed in ray
   **/
  function getNormalizedDebt(ReserveData storage _reserve) internal view returns (uint256) {
    uint40 timestamp = _reserve.lastUpdateTimestamp;

    //solium-disable-next-line
    if (timestamp == uint40(block.timestamp)) {
      //if the index was updated in the same block, no need to perform any calculation
      return _reserve.lastVariableBorrowCumulativeIndex;
    }

    uint256 cumulated = MathUtils
      .calculateCompoundedInterest(_reserve.currentVariableBorrowRate, timestamp)
      .rayMul(_reserve.lastVariableBorrowCumulativeIndex);

    return cumulated;
  }

  /**
   * @dev Updates the liquidity cumulative index Ci and variable borrow cumulative index Bvc. Refer to the whitepaper for
   * a formal specification.
   * @param _self the reserve object
   **/
  function updateCumulativeIndexesAndTimestamp(ReserveData storage _self) internal {
    //only cumulating if there is any income being produced
    if (
      IERC20(_self.variableDebtTokenAddress).totalSupply() > 0 ||
      IERC20(_self.stableDebtTokenAddress).totalSupply() > 0
    ) {
      uint256 cumulatedLiquidityInterest = MathUtils.calculateLinearInterest(
        _self.currentLiquidityRate,
        _self.lastUpdateTimestamp
      );

      _self.lastLiquidityCumulativeIndex = cumulatedLiquidityInterest.rayMul(
        _self.lastLiquidityCumulativeIndex
      );

      uint256 cumulatedVariableBorrowInterest = MathUtils.calculateCompoundedInterest(
        _self.currentVariableBorrowRate,
        _self.lastUpdateTimestamp
      );
      _self.lastVariableBorrowCumulativeIndex = cumulatedVariableBorrowInterest.rayMul(
        _self.lastVariableBorrowCumulativeIndex
      );
    }

    //solium-disable-next-line
    _self.lastUpdateTimestamp = uint40(block.timestamp);
  }

  /**
   * @dev accumulates a predefined amount of asset to the reserve as a fixed, one time income. Used for example to accumulate
   * the flashloan fee to the reserve, and spread it through the depositors.
   * @param _self the reserve object
   * @param _totalLiquidity the total liquidity available in the reserve
   * @param _amount the amount to accomulate
   **/
  function cumulateToLiquidityIndex(
    ReserveData storage _self,
    uint256 _totalLiquidity,
    uint256 _amount
  ) internal {
    uint256 amountToLiquidityRatio = _amount.wadToRay().rayDiv(_totalLiquidity.wadToRay());

    uint256 cumulatedLiquidity = amountToLiquidityRatio.add(WadRayMath.ray());

    _self.lastLiquidityCumulativeIndex = cumulatedLiquidity.rayMul(
      _self.lastLiquidityCumulativeIndex
    );
  }

  /**
   * @dev initializes a reserve
   * @param _self the reserve object
   * @param _aTokenAddress the address of the overlying atoken contract
   * @param _interestRateStrategyAddress the address of the interest rate strategy contract
   **/
  function init(
    ReserveData storage _self,
    address _aTokenAddress,
    address _stableDebtAddress,
    address _variableDebtAddress,
    address _interestRateStrategyAddress
  ) external {
    require(_self.aTokenAddress == address(0), 'Reserve has already been initialized');
    if (_self.lastLiquidityCumulativeIndex == 0) {
      //if the reserve has not been initialized yet
      _self.lastLiquidityCumulativeIndex = WadRayMath.ray();
    }

    if (_self.lastVariableBorrowCumulativeIndex == 0) {
      _self.lastVariableBorrowCumulativeIndex = WadRayMath.ray();
    }

    _self.aTokenAddress = payable(_aTokenAddress);
    _self.stableDebtTokenAddress = _stableDebtAddress;
    _self.variableDebtTokenAddress = _variableDebtAddress;
    _self.interestRateStrategyAddress = _interestRateStrategyAddress;
  }

  /**
   * @dev updates the state of the core as a result of a flashloan action
   * @param _reserve the address of the reserve in which the flashloan is happening
   * @param _income the income of the protocol as a result of the action
   **/
  function updateStateOnFlashLoan(
    ReserveData storage _reserve,
    address _reserveAddress,
    uint256 _availableLiquidityBefore,
    uint256 _income,
    uint256 _protocolFee
  ) external {
    //compounding the cumulated interest
    _reserve.updateCumulativeIndexesAndTimestamp();

    uint256 totalLiquidityBefore = _availableLiquidityBefore
      .add(IERC20(_reserve.variableDebtTokenAddress).totalSupply())
      .add(IERC20(_reserve.stableDebtTokenAddress).totalSupply());

    //compounding the received fee into the reserve
    _reserve.cumulateToLiquidityIndex(totalLiquidityBefore, _income);

    //refresh interest rates
    updateInterestRates(_reserve, _reserveAddress, _income, 0);
  }

  /**
   * @dev Updates the reserve current stable borrow rate Rf, the current variable borrow rate Rv and the current liquidity rate Rl.
   * Also updates the lastUpdateTimestamp value. Please refer to the whitepaper for further information.
   * @param _reserve the address of the reserve to be updated
   * @param _liquidityAdded the amount of liquidity added to the protocol (deposit or repay) in the previous action
   * @param _liquidityTaken the amount of liquidity taken from the protocol (redeem or borrow)
   **/
  function updateInterestRates(
    ReserveData storage _reserve,
    address _reserveAddress,
    uint256 _liquidityAdded,
    uint256 _liquidityTaken
  ) internal {
    uint256 currentAvgStableRate = IStableDebtToken(_reserve.stableDebtTokenAddress)
      .getAverageStableRate();

    uint256 balance = IERC20(_reserveAddress).balanceOf(_reserve.aTokenAddress);

    (
      uint256 newLiquidityRate,
      uint256 newStableRate,
      uint256 newVariableRate
    ) = IReserveInterestRateStrategy(_reserve.interestRateStrategyAddress).calculateInterestRates(
      _reserveAddress,
      balance.add(_liquidityAdded).sub(_liquidityTaken),
      IERC20(_reserve.stableDebtTokenAddress).totalSupply(),
      IERC20(_reserve.variableDebtTokenAddress).totalSupply(),
      currentAvgStableRate
    );

    _reserve.currentLiquidityRate = newLiquidityRate;
    _reserve.currentStableBorrowRate = newStableRate;
    _reserve.currentVariableBorrowRate = newVariableRate;

    emit ReserveDataUpdated(
      _reserveAddress,
      newLiquidityRate,
      newStableRate,
      currentAvgStableRate,
      newVariableRate,
      _reserve.lastLiquidityCumulativeIndex,
      _reserve.lastVariableBorrowCumulativeIndex
    );
  }
}
