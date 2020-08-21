// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

/**
 * @title ILendingPoolAddressesProvider interface
 * @notice provides the interface to fetch the LendingPoolCore address
 **/

interface ILendingPoolAddressesProviderRegistry {
  //events
  event AddressesProviderRegistered(address indexed newAddress);
  event AddressesProviderUnregistered(address indexed newAddress);

  function getAddressesProvidersList() external view returns (address[] memory);

  function isAddressesProviderRegistered(address provider) external view returns (uint256);

  function registerAddressesProvider(address provider, uint256 id) external;

  function unregisterAddressesProvider(address provider) external;
}
