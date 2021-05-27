// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/**
 * @title IPriceOracleGetter interface
 * @notice Interface for the Aave price oracle.
 **/

interface IPriceOracleGetter {
  /**
   * @dev returns the asset price in Quote currency
   * @param asset the address of the asset
   * @return the price of the asset in Quote currency
   **/
  function getAssetPrice(address asset) external view returns (uint256);
}
