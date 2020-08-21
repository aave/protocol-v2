// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import '@openzeppelin/contracts/access/Ownable.sol';
import '../libraries/openzeppelin-upgradeability/InitializableAdminUpgradeabilityProxy.sol';

import '../interfaces/ILendingPoolAddressesProvider.sol';

/**
 * @title LendingPoolAddressesProvider contract
 * @notice Is the main registry of the protocol. All the different components of the protocol are accessible
 * through the addresses provider.
 * @author Aave
 **/

contract LendingPoolAddressesProvider is Ownable, ILendingPoolAddressesProvider {
  mapping(bytes32 => address) private _addresses;

  //events
  event LendingPoolUpdated(address indexed newAddress);
  event LendingPoolManagerUpdated(address indexed newAddress);
  event LendingPoolConfiguratorUpdated(address indexed newAddress);
  event LendingPoolLiquidationManagerUpdated(address indexed newAddress);
  event EthereumAddressUpdated(address indexed newAddress);
  event PriceOracleUpdated(address indexed newAddress);
  event LendingRateOracleUpdated(address indexed newAddress);

  event ProxyCreated(bytes32 id, address indexed newAddress);

  bytes32 private constant LENDING_POOL = 'LENDING_POOL';
  bytes32 private constant LENDING_POOL_CORE = 'LENDING_POOL_CORE';
  bytes32 private constant LENDING_POOL_CONFIGURATOR = 'LENDING_POOL_CONFIGURATOR';
  bytes32 private constant LENDING_POOL_MANAGER = 'LENDING_POOL_MANAGER';
  bytes32 private constant LENDING_POOL_LIQUIDATION_MANAGER = 'LIQUIDATION_MANAGER';
  bytes32 private constant LENDING_POOL_FLASHLOAN_PROVIDER = 'FLASHLOAN_PROVIDER';
  bytes32 private constant DATA_PROVIDER = 'DATA_PROVIDER';
  bytes32 private constant ETHEREUM_ADDRESS = 'ETHEREUM_ADDRESS';
  bytes32 private constant PRICE_ORACLE = 'PRICE_ORACLE';
  bytes32 private constant LENDING_RATE_ORACLE = 'LENDING_RATE_ORACLE';
  bytes32 private constant WALLET_BALANCE_PROVIDER = 'WALLET_BALANCE_PROVIDER';

  /**
   * @dev returns the address of the LendingPool proxy
   * @return the lending pool proxy address
   **/
  function getLendingPool() external override view returns (address) {
    return _addresses[LENDING_POOL];
  }

  /**
   * @dev updates the implementation of the lending pool
   * @param pool the new lending pool implementation
   **/
  function setLendingPoolImpl(address pool) external override onlyOwner {
    _updateImpl(LENDING_POOL, pool);
    emit LendingPoolUpdated(pool);
  }

  /**
   * @dev returns the address of the LendingPoolConfigurator proxy
   * @return the lending pool configurator proxy address
   **/
  function getLendingPoolConfigurator() external override view returns (address) {
    return _addresses[LENDING_POOL_CONFIGURATOR];
  }

  /**
   * @dev updates the implementation of the lending pool configurator
   * @param configurator the new lending pool configurator implementation
   **/
  function setLendingPoolConfiguratorImpl(address configurator) external override onlyOwner {
    _updateImpl(LENDING_POOL_CONFIGURATOR, configurator);
    emit LendingPoolConfiguratorUpdated(configurator);
  }

  /**
   * @dev returns the address of the LendingPoolLiquidationManager. Since the manager is used
   * through delegateCall within the LendingPool contract, the proxy contract pattern does not work properly hence
   * the addresses are changed directly.
   * @return the address of the Lending pool liquidation manager
   **/

  function getLendingPoolLiquidationManager() external override view returns (address) {
    return _addresses[LENDING_POOL_LIQUIDATION_MANAGER];
  }

  /**
   * @dev updates the address of the Lending pool liquidation manager
   * @param manager the new lending pool liquidation manager address
   **/
  function setLendingPoolLiquidationManager(address manager) external override onlyOwner {
    _addresses[LENDING_POOL_LIQUIDATION_MANAGER] = manager;
    emit LendingPoolLiquidationManagerUpdated(manager);
  }

  /**
   * @dev the functions below are storing specific addresses that are outside the context of the protocol
   * hence the upgradable proxy pattern is not used
   **/

  function getLendingPoolManager() external override view returns (address) {
    return _addresses[LENDING_POOL_MANAGER];
  }

  function setLendingPoolManager(address lendingPoolManager) external override onlyOwner {
    _addresses[LENDING_POOL_MANAGER] = lendingPoolManager;
    emit LendingPoolManagerUpdated(lendingPoolManager);
  }

  function getPriceOracle() external override view returns (address) {
    return _addresses[PRICE_ORACLE];
  }

  function setPriceOracle(address priceOracle) external override onlyOwner {
    _addresses[PRICE_ORACLE] = priceOracle;
    emit PriceOracleUpdated(priceOracle);
  }

  function getLendingRateOracle() external override view returns (address) {
    return _addresses[LENDING_RATE_ORACLE];
  }

  function setLendingRateOracle(address lendingRateOracle) external override onlyOwner {
    _addresses[LENDING_RATE_ORACLE] = lendingRateOracle;
    emit LendingRateOracleUpdated(lendingRateOracle);
  }

  /**
   * @dev internal function to update the implementation of a specific component of the protocol
   * @param id the id of the contract to be updated
   * @param newAddress the address of the new implementation
   **/
  function _updateImpl(bytes32 id, address newAddress) internal {
    address payable proxyAddress = payable(_addresses[id]);

    InitializableAdminUpgradeabilityProxy proxy = InitializableAdminUpgradeabilityProxy(
      proxyAddress
    );
    bytes memory params = abi.encodeWithSignature('initialize(address)', address(this));

    if (proxyAddress == address(0)) {
      proxy = new InitializableAdminUpgradeabilityProxy();
      proxy.initialize(newAddress, address(this), params);
      _addresses[id] = address(proxy);
      emit ProxyCreated(id, address(proxy));
    } else {
      proxy.upgradeToAndCall(newAddress, params);
    }
  }
}
