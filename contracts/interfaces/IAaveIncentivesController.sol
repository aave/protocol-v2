// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IAaveIncentivesController {
  function handleAction(
    address user,
    uint256 totalSupply,
    uint256 userBalance
  ) external;
}
