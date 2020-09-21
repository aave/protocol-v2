// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {IERC20} from '../../interfaces/IERC20.sol';
import {IScaledBalanceToken} from './IScaledBalanceToken.sol';

interface IAToken is IERC20, IScaledBalanceToken {
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
   * @dev mints aTokens to the reserve treasury
   * @param amount the amount to mint
   * @param index the liquidity index of the reserve
   **/
  function mintToTreasury(uint256 amount, uint256 index) external;

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

  
  function isTransferAllowed(address user, uint256 amount) external view returns (bool);

  /**
   * @dev transfer the amount of the underlying asset to the user
   * @param user address of the user
   * @param amount the amount to transfer
   * @return the amount transferred
   **/
  function transferUnderlyingTo(address user, uint256 amount) external returns (uint256);


}
