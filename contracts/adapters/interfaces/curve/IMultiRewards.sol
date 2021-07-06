// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface IMultiRewards {
  function notifyRewardAmount(address _rewardsToken, uint256 reward) external;
}
