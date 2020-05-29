// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/ILendingPoolAddressesProviderRegistry.sol";



/**
* @title LendingPoolAddressesProviderRegistry contract
* @notice contains the list of active addresses providers
* @author Aave
**/

contract LendingPoolAddressesProviderRegistry is Ownable, ILendingPoolAddressesProviderRegistry {
    //events
    event AddressesProviderRegistered(address indexed newAddress);
    event AddressesProviderUnregistered(address indexed newAddress);

    mapping(address => uint256) addressesProviders;
    address[] addressesProvidersList;

    /**
    * @dev returns if an addressesProvider is registered or not
    * @param _provider the addresses provider
    * @return true if the addressesProvider is registered, false otherwise
    **/
    function isAddressesProviderRegistered(address _provider) external override view returns(uint256) {
        return addressesProviders[_provider];
    }

    /**
    * @dev returns the list of active addressesProviders
    * @return the list of addressesProviders
    **/
    function getAddressesProvidersList() external override view returns(address[] memory) {

        uint256 maxLength = addressesProvidersList.length;

        address[] memory activeProviders = new address[](maxLength);

        for(uint256 i = 0; i<addressesProvidersList.length; i++){
            if(addressesProviders[addressesProvidersList[i]] > 0){
                activeProviders[i] = addressesProvidersList[i];
            }
        }

        return activeProviders;
    }

    /**
    * @dev adds a lending pool to the list of registered lending pools
    * @param _provider the pool address to be registered
    **/
    function registerAddressesProvider(address _provider, uint256 _id) public override onlyOwner {
        addressesProviders[_provider] = _id;
        addToAddressesProvidersListInternal(_provider);
        emit AddressesProviderRegistered(_provider);
    }

    /**
    * @dev removes a lending pool from the list of registered lending pools
    * @param _provider the pool address to be unregistered
    **/
    function unregisterAddressesProvider(address _provider) public override onlyOwner {
        require(addressesProviders[_provider] > 0, "Provider is not registered");
        addressesProviders[_provider] = 0;
        emit AddressesProviderUnregistered(_provider);
    }

    /**
    * @dev adds to the list of the addresses providers, if it wasn't already added before
    * @param _provider the pool address to be added
    **/
    function addToAddressesProvidersListInternal(address _provider) internal {

        for(uint256 i = 0; i < addressesProvidersList.length; i++) {

            if(addressesProvidersList[i] == _provider){
                return;
            }
        }

        addressesProvidersList.push(_provider);
    }
}
