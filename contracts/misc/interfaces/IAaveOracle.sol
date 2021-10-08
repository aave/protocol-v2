// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/**
 * @title IAaveOracle interface
 * @notice Interface for the Aave oracle.
 **/

interface IAaveOracle {
  address public immutable BASE_CURRENCY;
  uint256 public immutable BASE_CURRENCY_UNIT;
  address public immutable WETH;

  /***********
    @dev returns the asset price in ETH
     */
  function getAssetPrice(address asset) external view returns (uint256);
}