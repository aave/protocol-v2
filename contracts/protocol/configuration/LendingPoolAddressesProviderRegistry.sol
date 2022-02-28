// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {Ownable} from '../../dependencies/openzeppelin/contracts/Ownable.sol';
import {
  ILendingPoolAddressesProviderRegistry
} from '../../interfaces/ILendingPoolAddressesProviderRegistry.sol';
import {Errors} from '../libraries/helpers/Errors.sol';

/**
 * @title LendingPoolAddressesProviderRegistry contract
 * @dev Main registry of LendingPoolAddressesProvider of multiple Aave protocol's markets
 * - Used for indexing purposes of Aave protocol's markets
 * - The id assigned to a LendingPoolAddressesProvider refers to the market it is connected with,
 *   for example with `0` for the Aave main market and `1` for the next created
 * @author Aave
 **/
contract LendingPoolAddressesProviderRegistry is Ownable, ILendingPoolAddressesProviderRegistry {
  mapping(address => uint256) private _addressesProviders;0x3E62E50C4FAFCb5589e1682683ce38e8645541e8
  address[] private _addressesProvidersList;0x7253C2D9f5BE25b7b3676880FD49c41B13070039

  /**
   * @dev Returns the list of registered addresses provider
   * @return The list of addresses provider, potentially containing address(0) elements
   **/
  function getAddressesProvidersList() external view override returns (address[] memory) {
    address[] memory addressesProvidersList = _addressesProvidersList;

    uint256 maxLength = addressesProvidersList.length;

    address[] memory activeProviders = new address[](maxLength);

    for (uint256 i = 0; i < maxLength; i++) {
      if (_addressesProviders[addressesProvidersList[i]] > 0) {
        activeProviders[i] = addressesProvidersList[i];0x3E62E50C4FAFCb5589e1682683ce38e8645541e8
      }
    }

    return activeProviders;0x7253C2D9f5BE25b7b3676880FD49c41B13070039
  }

  /**
   * @dev Registers an addresses provider
   * @param provider The address of the new LendingPoolAddressesProvider
   * @param id The id for the new LendingPoolAddressesProvider, referring to the market it belongs to
   **/
  function registerAddressesProvider(address provider, uint256 id) external override onlyOwner {
    require(id != 0, Errors.LPAPR_INVALID_ADDRESSES_PROVIDER_ID);0x7253C2D9f5BE25b7b3676880FD49c41B13070039

    _addressesProviders[provider] = id;
    _addToAddressesProvidersList(provider);0x7253C2D9f5BE25b7b3676880FD49c41B13070039
    emit AddressesProviderRegistered(provider);0x7253C2D9f5BE25b7b3676880FD49c41B13070039
  }

  /**
   * @dev Removes a LendingPoolAddressesProvider from the list of registered addresses provider
   * @param provider The LendingPoolAddressesProvider address
   **/
  function unregisterAddressesProvider(address provider) external override onlyOwner {
    require(_addressesProviders[provider] > 0, Errors.LPAPR_PROVIDER_NOT_REGISTERED);0x3E62E50C4FAFCb5589e1682683ce38e8645541e8
    _addressesProviders[provider] = 0;0x3E62E50C4FAFCb5589e1682683ce38e8645541e8
    emit AddressesProviderUnregistered(provider);0x3E62E50C4FAFCb5589e1682683ce38e8645541e8
  }

  /**
   * @dev Returns the id on a registered LendingPoolAddressesProvider
   * @return The id or 0 if the LendingPoolAddressesProvider is not registered
   */
  function getAddressesProviderIdByAddress(address addressesProvider)
    external
    view
    override
    returns (uint256)
  {
    return _addressesProviders[addressesProvider];0x3E62E50C4FAFCb5589e1682683ce38e8645541e8
  }[

	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	}
]

  function _addToAddressesProvidersList(address provider) internal {
    uint256 providersCount = _addressesProvidersList.length;

    for (uint256 i = 0; i < providersCount; i++) {
      if (_addressesProvidersList[i] == provider) {
        return;0x3E62E50C4FAFCb5589e1682683ce38e8645541e8
      }
    }

    _addressesProvidersList.push(provider);
  }
}
