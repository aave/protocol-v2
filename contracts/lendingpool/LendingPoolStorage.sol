// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {UserConfiguration} from '../libraries/configuration/UserConfiguration.sol';
import {ReserveConfiguration} from '../libraries/configuration/ReserveConfiguration.sol';
import {ReserveLogic} from '../libraries/logic/ReserveLogic.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';

contract LendingPoolStorage {
  using ReserveLogic for ReserveLogic.ReserveData;
  using ReserveConfiguration for ReserveConfiguration.Map;
  using UserConfiguration for UserConfiguration.Map;

  ILendingPoolAddressesProvider internal _addressesProvider;

  mapping(address => ReserveLogic.ReserveData) internal _reserves;
  mapping(address => UserConfiguration.Map) internal _usersConfig;
  // debt token address => user who gives allowance => user who receives allowance => amount
  mapping(address => mapping(address => mapping(address => uint256))) internal _borrowAllowance;

  address[] internal _reservesList;

  bool internal _flashLiquidationLocked;
  bool internal _paused;

  /**
   * @dev returns the list of the initialized reserves
   **/
  function getReservesList() external view returns (address[] memory) {
    return _reservesList;
  }

  /**
   * @dev returns the addresses provider
   **/
  function getAddressesProvider() external view returns (ILendingPoolAddressesProvider) {
    return _addressesProvider;
  }
}
