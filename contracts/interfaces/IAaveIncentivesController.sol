// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IAaveIncentivesController {
  struct AssetData {
    uint128 emissionPerSecond;
    uint128 lastUpdateTimestamp;
    uint256 index;
  }

  function REWARD_TOKEN() external view returns (address rewardToken);

  function assets(address underlying) external view returns (AssetData memory assets);

  function handleAction(
    address user,
    uint256 userBalance,
    uint256 totalSupply
  ) external;

  function getRewardsBalance(address[] calldata assets, address user)
    external
    view
    returns (uint256);
}
