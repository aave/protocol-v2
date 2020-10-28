// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

interface IWETHGateway {
  function depositETH(address onBehalfOf, uint16 referralCode) external payable;

  function withdrawETH(uint256 amount) external;

  function repayETH(
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) external payable;
}
