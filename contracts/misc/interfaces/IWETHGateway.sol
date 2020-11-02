// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {ILendingPool} from '../../interfaces/ILendingPool.sol';

interface IWETHGateway {
  function depositETH(
    ILendingPool pool,
    address onBehalfOf,
    uint16 referralCode
  ) external payable;

  function withdrawETH(
    ILendingPool pool,
    uint256 amount,
    address onBehalfOf
  ) external;

  function repayETH(
    ILendingPool pool,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) external payable;
}
