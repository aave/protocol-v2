// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../tokenization/base/DebtTokenBase.sol';
import './ReserveLogic.sol';


/**
 * @title Helpers library
 * @author Aave
 * @notice Implements calculation helpers.
 */
library Helpers {

  /**
   * @dev fetches the user current stable and variable debt balances
   * @param _user the user
   * @param _reserve the reserve object
   * @return the stable and variable debt balance
   **/
  function getUserCurrentDebt(address _user, ReserveLogic.ReserveData storage _reserve)
    internal
    view
    returns (uint256, uint256)
  {
    return (
      IERC20(_reserve.stableDebtTokenAddress).balanceOf(_user),
      IERC20(_reserve.variableDebtTokenAddress).balanceOf(_user)
    );
  }

  /**
   * @dev fetches the user principal stable and variable debt balances
   * @param _user the user
   * @param _reserve the reserve object
   * @return the stable and variable debt balance
   **/
  function getUserPrincipalDebt(address _user, ReserveLogic.ReserveData storage _reserve)
    internal
    view
    returns (uint256, uint256)
  {
    return (
      DebtTokenBase(_reserve.stableDebtTokenAddress).principalBalanceOf(_user),
      DebtTokenBase(_reserve.variableDebtTokenAddress).principalBalanceOf(_user)
    );
  }
}
