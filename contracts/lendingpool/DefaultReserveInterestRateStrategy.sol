// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IReserveInterestRateStrategy} from '../interfaces/IReserveInterestRateStrategy.sol';
import {WadRayMath} from '../libraries/math/WadRayMath.sol';
import {PercentageMath} from '../libraries/math/PercentageMath.sol';
import {LendingPoolAddressesProvider} from '../configuration/LendingPoolAddressesProvider.sol';
import {ILendingRateOracle} from '../interfaces/ILendingRateOracle.sol';

/**
 * @title DefaultReserveInterestRateStrategy contract
 * @notice implements the calculation of the interest rates depending on the reserve parameters.
 * @dev if there is need to update the calculation of the interest rates for a specific reserve,
 * a new version of this contract will be deployed.
 * @author Aave
 **/
contract DefaultReserveInterestRateStrategy is IReserveInterestRateStrategy {
  using WadRayMath for uint256;
  using SafeMath for uint256;
  using PercentageMath for uint256;
  /**
   * @dev this constant represents the utilization rate at which the pool aims to obtain most competitive borrow rates
   * expressed in ray
   **/
  uint256 public constant OPTIMAL_UTILIZATION_RATE = 0.8 * 1e27;

  /**
   * @dev this constant represents the excess utilization rate above the optimal. It's always equal to
   * 1-optimal utilization rate. Added as a constant here for gas optimizations
   * expressed in ray
   **/

  uint256 public constant EXCESS_UTILIZATION_RATE = 0.2 * 1e27;

  LendingPoolAddressesProvider public immutable addressesProvider;

  //base variable borrow rate when Utilization rate = 0. Expressed in ray
  uint256 internal immutable _baseVariableBorrowRate;

  //slope of the variable interest curve when utilization rate > 0 and <= OPTIMAL_UTILIZATION_RATE. Expressed in ray
  uint256 internal immutable _variableRateSlope1;

  //slope of the variable interest curve when utilization rate > OPTIMAL_UTILIZATION_RATE. Expressed in ray
  uint256 internal immutable _variableRateSlope2;

  //slope of the stable interest curve when utilization rate > 0 and <= OPTIMAL_UTILIZATION_RATE. Expressed in ray
  uint256 internal immutable _stableRateSlope1;

  //slope of the stable interest curve when utilization rate > OPTIMAL_UTILIZATION_RATE. Expressed in ray
  uint256 internal immutable _stableRateSlope2;

 
  constructor(
    LendingPoolAddressesProvider provider,
    uint256 baseVariableBorrowRate,
    uint256 variableRateSlope1,
    uint256 variableRateSlope2,
    uint256 stableRateSlope1,
    uint256 stableRateSlope2
  ) public {
    addressesProvider = provider;
    _baseVariableBorrowRate = baseVariableBorrowRate;
    _variableRateSlope1 = variableRateSlope1;
    _variableRateSlope2 = variableRateSlope2;
    _stableRateSlope1 = stableRateSlope1;
    _stableRateSlope2 = stableRateSlope2;
  }

  /**
   * @dev accessors
   */

  function variableRateSlope1() external view returns (uint256) {
    return _variableRateSlope1;
  }

  function variableRateSlope2() external view returns (uint256) {
    return _variableRateSlope2;
  }

  function stableRateSlope1() external view returns (uint256) {
    return _stableRateSlope1;
  }

  function stableRateSlope2() external view returns (uint256) {
    return _stableRateSlope2;
  }

  function baseVariableBorrowRate() external override view returns (uint256) {
    return _baseVariableBorrowRate;
  }

  function getMaxVariableBorrowRate() external override view returns (uint256) {
    return _baseVariableBorrowRate.add(_variableRateSlope1).add(_variableRateSlope2);
  }
  
  struct CalcInterestRatesLocalVars {

    uint256 totalBorrows;
    uint256 currentVariableBorrowRate;
    uint256 currentStableBorrowRate;
    uint256 currentLiquidityRate;
    uint256 utilizationRate;
  }

  /**
   * @dev calculates the interest rates depending on the available liquidity and the total borrowed.
   * @param reserve the address of the reserve
   * @param availableLiquidity the liquidity available in the reserve
   * @param totalStableDebt the total borrowed from the reserve a stable rate
   * @param totalVariableDebt the total borrowed from the reserve at a variable rate
   * @param averageStableBorrowRate the weighted average of all the stable rate borrows
   * @param reserveFactor the reserve portion of the interest to redirect to the reserve treasury
   * @return currentLiquidityRate the liquidity rate
   * @return currentStableBorrowRate stable borrow rate
   * @return currentVariableBorrowRate variable borrow rate
   **/
  function calculateInterestRates(
    address reserve,
    uint256 availableLiquidity,
    uint256 totalStableDebt,
    uint256 totalVariableDebt,
    uint256 averageStableBorrowRate,
    uint256 reserveFactor
  )
    external
    override
    view
    returns (
      uint256,
      uint256,
      uint256
    )
  {

    CalcInterestRatesLocalVars memory vars;

    vars.totalBorrows = totalStableDebt.add(totalVariableDebt);
    vars.currentVariableBorrowRate = 0;
    vars.currentStableBorrowRate = 0;
    vars.currentLiquidityRate = 0;

    uint256 utilizationRate = vars.totalBorrows == 0
      ? 0
      : vars.totalBorrows.rayDiv(availableLiquidity.add(vars.totalBorrows));

    vars.currentStableBorrowRate = ILendingRateOracle(addressesProvider.getLendingRateOracle())
      .getMarketBorrowRate(reserve);

    if (utilizationRate > OPTIMAL_UTILIZATION_RATE) {
      uint256 excessUtilizationRateRatio = utilizationRate.sub(OPTIMAL_UTILIZATION_RATE).rayDiv(
        EXCESS_UTILIZATION_RATE
      );

      vars.currentStableBorrowRate = vars.currentStableBorrowRate.add(_stableRateSlope1).add(
        _stableRateSlope2.rayMul(excessUtilizationRateRatio)
      );

      vars.currentVariableBorrowRate = _baseVariableBorrowRate.add(_variableRateSlope1).add(
        _variableRateSlope2.rayMul(excessUtilizationRateRatio)
      );
    } else {
      vars.currentStableBorrowRate = vars.currentStableBorrowRate.add(
        _stableRateSlope1.rayMul(utilizationRate.rayDiv(OPTIMAL_UTILIZATION_RATE))
      );
      vars.currentVariableBorrowRate = _baseVariableBorrowRate.add(
        utilizationRate.rayDiv(OPTIMAL_UTILIZATION_RATE).rayMul(_variableRateSlope1)
      );
    }

    vars.currentLiquidityRate = _getOverallBorrowRate(
      totalStableDebt,
      totalVariableDebt,
      vars.currentVariableBorrowRate,
      averageStableBorrowRate
    )
      .rayMul(utilizationRate)
      .percentMul(PercentageMath.PERCENTAGE_FACTOR.sub(reserveFactor));

    return (vars.currentLiquidityRate, vars.currentStableBorrowRate, vars.currentVariableBorrowRate);
  }

  /**
   * @dev calculates the overall borrow rate as the weighted average between the total variable borrows and total stable borrows.
   * @param totalStableDebt the total borrowed from the reserve a stable rate
   * @param totalVariableDebt the total borrowed from the reserve at a variable rate
   * @param currentVariableBorrowRate the current variable borrow rate
   * @param currentAverageStableBorrowRate the weighted average of all the stable rate borrows
   * @return the weighted averaged borrow rate
   **/
  function _getOverallBorrowRate(
    uint256 totalStableDebt,
    uint256 totalVariableDebt,
    uint256 currentVariableBorrowRate,
    uint256 currentAverageStableBorrowRate
  ) internal pure returns (uint256) {
    uint256 totalBorrows = totalStableDebt.add(totalVariableDebt);

    if (totalBorrows == 0) return 0;

    uint256 weightedVariableRate = totalVariableDebt.wadToRay().rayMul(
      currentVariableBorrowRate
    );

    uint256 weightedStableRate = totalStableDebt.wadToRay().rayMul(
      currentAverageStableBorrowRate
    );

    uint256 overallBorrowRate = weightedVariableRate.add(weightedStableRate).rayDiv(
      totalBorrows.wadToRay()
    );

    return overallBorrowRate;
  }
}
