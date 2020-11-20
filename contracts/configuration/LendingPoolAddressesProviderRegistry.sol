// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {
  ILendingPoolAddressesProviderRegistry
} from '../interfaces/ILendingPoolAddressesProviderRegistry.sol';
import {Errors} from '../libraries/helpers/Errors.sol';

/**
 * @title LendingPoolAddressesProviderRegistry contract
 * @notice contains the list of active addresses providers
 * @author Aave
 **/

contract LendingPoolAddressesProviderRegistry is Ownable, ILendingPoolAddressesProviderRegistry {
  mapping(address => uint256) private _addressesProviders;
  address[] private _addressesProvidersList;

  /**
   * @dev returns if an addressesProvider is registered or not
   * @param provider the addresses provider
   * @return The id of the addresses provider or 0 if the addresses provider not registered
   **/
  function isAddressesProviderRegistered(address provider)
    external
    override
    view
    returns (uint256)
  {
    return _addressesProviders[provider];
  }

  /**
   * @dev returns the list of active addressesProviders
   * @return the list of addressesProviders, potentially containing address(0) elements
   **/
  function getAddressesProvidersList() external override view returns (address[] memory) {
    address[] memory addressesProvidersList = _addressesProvidersList;

    uint256 maxLength = addressesProvidersList.length;

    address[] memory activeProviders = new address[](maxLength);

    for (uint256 i = 0; i < maxLength; i++) {
      if (_addressesProviders[addressesProvidersList[i]] > 0) {
        activeProviders[i] = addressesProvidersList[i];
      }
    }

    return activeProviders;
  }

  /**
   * @dev adds a lending pool to the list of registered lending pools
   * @param provider the pool address to be registered
   **/
  function registerAddressesProvider(address provider, uint256 id) external override onlyOwner {
    require(id != 0, Errors.LPAPR_INVALID_ADDRESSES_PROVIDER_ID);

    _addressesProviders[provider] = id;
    _addToAddressesProvidersList(provider);
    emit AddressesProviderRegistered(provider);
  }

  /**
   * @dev removes a lending pool from the list of registered lending pools
   * @param provider the pool address to be unregistered
   **/
  function unregisterAddressesProvider(address provider) external override onlyOwner {
    require(_addressesProviders[provider] > 0, Errors.LPAPR_PROVIDER_NOT_REGISTERED);
    _addressesProviders[provider] = 0;
    emit AddressesProviderUnregistered(provider);
  }

  /**
   * @dev adds to the list of the addresses providers, if it wasn't already added before
   * @param provider the pool address to be added
   **/
  function _addToAddressesProvidersList(address provider) internal {
    uint256 providersCount = _addressesProvidersList.length;

    for (uint256 i = 0; i < providersCount; i++) {
      if (_addressesProvidersList[i] == provider) {
        return;
      }
    }

    _addressesProvidersList.push(provider);
  }

  /**
   * @dev Returns the id on an `addressesProvider` or address(0) if not registered
   * @return The id or 0 if the addresses provider is not registered
   */
  function getAddressesProviderIdByAddress(address addressesProvider)
    external
    override
    view
    returns (uint256)
  {
    return _addressesProviders[addressesProvider];
  }
}
