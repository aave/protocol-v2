// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

/**
@title ILendingPoolAddressesProvider interface
@notice provides the interface to fetch the Aave protocol address
 */

interface ILendingPoolAddressesProvider {
  function getLendingPool() external view returns (address);

  function setLendingPoolImpl(address pool) external;

  function getLendingPoolConfigurator() external view returns (address);

  function setLendingPoolConfiguratorImpl(address configurator) external;

  function getTokenDistributor() external view returns (address);

  function setTokenDistributor(address tokenDistributor) external;

  function getFeeProvider() external view returns (address);

  function setFeeProviderImpl(address feeProvider) external;

  function getLendingPoolLiquidationManager() external view returns (address);

  function setLendingPoolLiquidationManager(address manager) external;

  function getLendingPoolManager() external view returns (address);

  function setLendingPoolManager(address lendingPoolManager) external;

  function getPriceOracle() external view returns (address);

  function setPriceOracle(address priceOracle) external;

  function getLendingRateOracle() external view returns (address);

  function setLendingRateOracle(address lendingRateOracle) external;
}
