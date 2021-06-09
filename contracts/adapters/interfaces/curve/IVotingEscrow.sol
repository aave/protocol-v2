// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface IVotingEscrow {
  function create_lock(uint256 value, uint256 time) external;

  function increase_amount(uint256 value) external;

  function increase_unlock_time(uint256 time) external;

  function withdraw() external;
}
