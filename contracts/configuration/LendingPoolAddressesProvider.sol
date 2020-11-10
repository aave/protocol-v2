// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';

// Prettier ignore to prevent buidler flatter bug
// prettier-ignore
import {InitializableImmutableAdminUpgradeabilityProxy} from '../libraries/aave-upgradeability/InitializableImmutableAdminUpgradeabilityProxy.sol';

import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';

/**
 * @title LendingPoolAddressesProvider contract
 * @notice Is the main registry of the protocol. All the different components of the protocol are accessible
 * through the addresses provider.
 * @author Aave
 **/

contract LendingPoolAddressesProvider is Ownable, ILendingPoolAddressesProvider {
  mapping(bytes32 => address) private _addresses;

  bytes32 private constant LENDING_POOL = 'LENDING_POOL';
  bytes32 private constant LENDING_POOL_CONFIGURATOR = 'LENDING_POOL_CONFIGURATOR';
  bytes32 private constant POOL_ADMIN = 'POOL_ADMIN';
  bytes32 private constant EMERGENCY_ADMIN = 'EMERGENCY_ADMIN';
  bytes32 private constant LENDING_POOL_COLLATERAL_MANAGER = 'COLLATERAL_MANAGER';
  bytes32 private constant PRICE_ORACLE = 'PRICE_ORACLE';
  bytes32 private constant LENDING_RATE_ORACLE = 'LENDING_RATE_ORACLE';

  /**
   * @dev Sets an address for an id by updating a proxy implementation
   * @param id The id
   * @param implementationAddress The address of the implementation if we want it covered by a proxy
   * address(0) if we don't want a proxy covering
   */
  function setAddressAsProxy(
    bytes32 id,
    address implementationAddress
  ) external override onlyOwner {
    _updateImpl(id, implementationAddress);
    emit AddressSet(id, implementationAddress, true);
  }

  /**
   * @dev Sets an address for an id replacing the address saved in the addresses map
   * @param id The id
   * @param newAddress The address to set, pass address(0) if a proxy is needed
   */
  function setAddress(
    bytes32 id,
    address newAddress
  ) external override onlyOwner {
    _addresses[id] = newAddress;
    emit AddressSet(id, newAddress, false);
  }

  /**
   * @dev Returns an address by id
   * @return The address
   */
  function getAddress(bytes32 id) public override view returns (address) {
    return _addresses[id];
  }

  /**
   * @dev returns the address of the LendingPool proxy
   * @return the lending pool proxy address
   **/
  function getLendingPool() external override view returns (address) {
    return getAddress(LENDING_POOL);
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
    return getAddress(LENDING_POOL_CONFIGURATOR);
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
   * @dev returns the address of the LendingPoolCollateralManager. Since the manager is used
   * through delegateCall within the LendingPool contract, the proxy contract pattern does not work properly hence
   * the addresses are changed directly.
   * @return the address of the Lending pool collateral manager
   **/

  function getLendingPoolCollateralManager() external override view returns (address) {
    return getAddress(LENDING_POOL_COLLATERAL_MANAGER);
  }

  /**
   * @dev updates the address of the Lending pool collateral manager
   * @param manager the new lending pool collateral manager address
   **/
  function setLendingPoolCollateralManager(address manager) external override onlyOwner {
    _addresses[LENDING_POOL_COLLATERAL_MANAGER] = manager;
    emit LendingPoolCollateralManagerUpdated(manager);
  }

  /**
   * @dev the functions below are storing specific addresses that are outside the context of the protocol
   * hence the upgradable proxy pattern is not used
   **/

  function getPoolAdmin() external override view returns (address) {
    return getAddress(POOL_ADMIN);
  }

  function setPoolAdmin(address admin) external override onlyOwner {
    _addresses[POOL_ADMIN] = admin;
    emit ConfigurationAdminUpdated(admin);
  }

  function getEmergencyAdmin() external override view returns (address) {
    return getAddress(EMERGENCY_ADMIN);
  }

  function setEmergencyAdmin(address emergencyAdmin) external override onlyOwner {
    _addresses[EMERGENCY_ADMIN] = emergencyAdmin;
    emit EmergencyAdminUpdated(emergencyAdmin);
  }

  function getPriceOracle() external override view returns (address) {
    return getAddress(PRICE_ORACLE);
  }

  function setPriceOracle(address priceOracle) external override onlyOwner {
    _addresses[PRICE_ORACLE] = priceOracle;
    emit PriceOracleUpdated(priceOracle);
  }

  function getLendingRateOracle() external override view returns (address) {
    return getAddress(LENDING_RATE_ORACLE);
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


      InitializableImmutableAdminUpgradeabilityProxy proxy
     = InitializableImmutableAdminUpgradeabilityProxy(proxyAddress);
    bytes memory params = abi.encodeWithSignature('initialize(address)', address(this));

    if (proxyAddress == address(0)) {
      proxy = new InitializableImmutableAdminUpgradeabilityProxy(address(this));
      proxy.initialize(newAddress, params);
      _addresses[id] = address(proxy);
      emit ProxyCreated(id, address(proxy));
    } else {
      proxy.upgradeToAndCall(newAddress, params);
    }
  }
}
