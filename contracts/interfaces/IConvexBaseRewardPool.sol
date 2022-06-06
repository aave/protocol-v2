// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IConvexBaseRewardPool {
  function earned(address account) external view returns (uint256);

  function withdrawAndUnwrap(uint256 amount, bool claim) external;

  function getReward(address _account, bool _claimExtras) external;

  function getReward() external;

  function rewardToken() external view returns (address);

  function extraRewardsLength() external view returns (uint256);

  function extraRewards(uint256) external view returns (address);
}
