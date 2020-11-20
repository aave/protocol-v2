// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

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

  // the list of the available reserves, structured as a mapping for gas savings reasons
  mapping(uint256 => address) internal _reservesList;

  uint256 internal _reservesCount;

  bool internal _paused;
}
