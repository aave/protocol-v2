// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IMasterChef {
  struct PoolInfo {
    address lpToken;
  }

  struct UserInfo {
    uint256 amount;
    uint256 rewardDebt;
  }

  function deposit(uint256, uint256) external;

  function withdraw(uint256, uint256) external;

  function sushi() external view returns (address);

  function poolInfo(uint256) external view returns (PoolInfo memory);

  function userInfo(uint256, address) external view returns (uint256, uint256);

  function pendingSushi(uint256, address) external view returns (uint256);
}
