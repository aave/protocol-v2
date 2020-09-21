// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {DebtTokenBase} from '../../tokenization/base/DebtTokenBase.sol';
import {ReserveLogic} from '../logic/ReserveLogic.sol';

/**
 * @title Helpers library
 * @author Aave
 * @notice Implements calculation helpers.
 */
library Helpers {
  /**
   * @dev fetches the user current stable and variable debt balances
   * @param user the user
   * @param reserve the reserve object
   * @return the stable and variable debt balance
   **/
  function getUserCurrentDebt(address user, ReserveLogic.ReserveData storage reserve)
    internal
    view
    returns (uint256, uint256)
  {
    return (
      DebtTokenBase(reserve.stableDebtTokenAddress).balanceOf(user),
      DebtTokenBase(reserve.variableDebtTokenAddress).balanceOf(user)
    );
  }
}
