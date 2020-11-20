// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IScaledBalanceToken} from './IScaledBalanceToken.sol';

/**
 * @title interface IVariableDebtToken
 * @author Aave
 * @notice defines the basic interface for a variable debt token.
 **/
interface IVariableDebtToken is IScaledBalanceToken {
  /**
   * @dev emitted after the mint action
   * @param from the address performing the mint
   * @param onBehalfOf the address of the user on which behalf minting has been performed
   * @param value the amount to be minted
   * @param index the last index of the reserve
   **/
  event Mint(address indexed from, address indexed onBehalfOf, uint256 value, uint256 index);

  /**
   * @dev mints aTokens to user
   * only lending pools can call this function
   * @param user the address receiving the minted tokens
   * @param amount the amount of tokens to mint
   * @param index the liquidity index
   */
  function mint(
    address user,
    address onBehalfOf,
    uint256 amount,
    uint256 index
  ) external returns (bool);

  /**
   * @dev emitted when variable debt is burnt
   * @param user the user which debt has been burned
   * @param amount the amount of debt being burned
   * @param index the index of the user
   **/
  event Burn(address indexed user, uint256 amount, uint256 index);

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
