// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {IERC20} from '../../interfaces/IERC20.sol';

interface IAToken is IERC20 {
  /**
   * @dev emitted after aTokens are burned
   * @param from the address performing the redeem
   * @param value the amount to be redeemed
   * @param index the last index of the reserve
   **/
  event Burn(
    address indexed from,
    address indexed target,
    uint256 value,
    uint256 index
  );

  /**
   * @dev emitted after the mint action
   * @param from the address performing the mint
   * @param value the amount to be minted
   * @param index the last index of the reserve
   **/
  event Mint(address indexed from, uint256 value, uint256 index);

  /**
   * @dev emitted during the transfer action
   * @param from the address from which the tokens are being transferred
   * @param to the adress of the destination
   * @param value the amount to be minted
   * @param index the last index of the reserve
   **/
  event BalanceTransfer(
    address indexed from,
    address indexed to,
    uint256 value,
    uint256 index
  );

  /**
   * @dev burns the aTokens and sends the equivalent amount of underlying to the target.
   * only lending pools can call this function
   * @param amount the amount being burned
   * @param index the liquidity index
   **/
  function burn(
    address user,
    address underlyingTarget,
    uint256 amount,
    uint256 index
  ) external;

  /**
   * @dev mints aTokens to user
   * only lending pools can call this function
   * @param user the address receiving the minted tokens
   * @param amount the amount of tokens to mint
   * @param index the liquidity index
   */
  function mint(address user, uint256 amount, uint256 index) external;

  /**
   * @dev mints aTokens to reserve, based on the reserveFactor value
   * only lending pools can call this function
   * @param amount the amount of tokens to mint
   */
  function mintToReserve(uint256 amount) external;


  /**
   * @dev transfers tokens in the event of a borrow being liquidated, in case the liquidators reclaims the aToken
   *      only lending pools can call this function
   * @param from the address from which transfer the aTokens
   * @param to the destination address
   * @param value the amount to transfer
   **/
  function transferOnLiquidation(
    address from,
    address to,
    uint256 value
  ) external;

  /**
   * @dev returns the principal balance of the user. The principal balance is the last
   * updated stored balance, which does not consider the perpetually accruing interest.
   * @param user the address of the user
   * @return the principal balance of the user
   **/
  function scaledBalanceOf(address user) external view returns (uint256);

  /**
   * @dev Used to validate transfers before actually executing them.
   * @param user address of the user to check
   * @param amount the amount to check
   * @return true if the user can transfer amount, false otherwise
   **/
  function isTransferAllowed(address user, uint256 amount) external view returns (bool);

  /**
   * @dev transfer the amount of the underlying asset to the user
   * @param user address of the user
   * @param amount the amount to transfer
   * @return the amount transferred
   **/

  function transferUnderlyingTo(address user, uint256 amount) external returns (uint256);
}
