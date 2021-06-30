// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ILendingPoolAddressesProvider} from './ILendingPoolAddressesProvider.sol';
import {ILendingPool} from './ILendingPool.sol';
import {DataTypes} from '../protocol/libraries/types/DataTypes.sol';

interface IPermissionedLendingPool is ILendingPool {
  /**
   * @dev Function to seize the collateral of a user. Only whitelisters of the user can call this function
   * @param assets The addresses of the underlying assets to seize
   * @param to The address that will receive the funds
   **/
  function seize(
    address user,
    address[] calldata assets,
    address to
  ) external;
}
