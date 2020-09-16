// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

/**
@title ILendingPoolAddressesProvider interface
@notice provides the interface to fetch the Aave protocol address
 */

interface ILendingPoolAddressesProvider {
  //events
  event LendingPoolUpdated(address indexed newAddress);
  event LendingPoolManagerUpdated(address indexed newAddress);
  event LendingPoolConfiguratorUpdated(address indexed newAddress);
  event LendingPoolCollateralManagerUpdated(address indexed newAddress);
  event EthereumAddressUpdated(address indexed newAddress);
  event PriceOracleUpdated(address indexed newAddress);
  event LendingRateOracleUpdated(address indexed newAddress);

  event ProxyCreated(bytes32 id, address indexed newAddress);

  function getLendingPool() external view returns (address);

  function setLendingPoolImpl(address pool) external;

  function getLendingPoolConfigurator() external view returns (address);

  function setLendingPoolConfiguratorImpl(address configurator) external;

  function getLendingPoolCollateralManager() external view returns (address);

  function setLendingPoolCollateralManager(address manager) external;

  function getLendingPoolManager() external view returns (address);

  function setLendingPoolManager(address lendingPoolManager) external;

  function getPriceOracle() external view returns (address);

  function setPriceOracle(address priceOracle) external;

  function getLendingRateOracle() external view returns (address);

  function setLendingRateOracle(address lendingRateOracle) external;
}
