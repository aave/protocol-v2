// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

/**
@title IReserveInterestRateStrategyInterface interface
@notice Interface for the calculation of the interest rates.
*/

interface IReserveInterestRateStrategy {
  /**
   * @dev returns the base variable borrow rate, in rays
   */

  function baseVariableBorrowRate() external view returns (uint256);

  /**
   * @dev calculates the liquidity, stable, and variable rates depending on the current utilization rate
   *      and the base parameters
   *
   */
  function calculateInterestRates(
    address reserve,
    uint256 utilizationRate,
    uint256 totalBorrowsStable,
    uint256 totalBorrowsVariable,
    uint256 averageStableBorrowRate
  )
    external
    view
    returns (
      uint256 liquidityRate,
      uint256 stableBorrowRate,
      uint256 variableBorrowRate
    );
}
