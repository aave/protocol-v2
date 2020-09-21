// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {IScaledBalanceToken} from './IScaledBalanceToken.sol';

/**
 * @title interface IVariableDebtToken
 * @author Aave
 * @notice defines the basic interface for a variable debt token.
 **/
interface IVariableDebtToken is IScaledBalanceToken {  
  
  /**
   * @dev emitted when variable debt is burnt
   * @param user the user which debt has been burned
   * @param amount the amount of debt being burned
   * @param index the index of the user
   **/
  event Burn(
    address indexed user,
    uint256 amount,
    uint256 index
  );

    /**
   * @dev burns user variable debt
   * @param user the user which debt is burnt
   * @param index the variable debt index of the reserve
   **/
  function burn(
    address user,
    uint256 amount,
    uint256 index
  ) external;
 
}
