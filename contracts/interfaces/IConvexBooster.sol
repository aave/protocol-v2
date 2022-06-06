// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

interface IConvexBooster {
  struct PoolInfo {
    address lptoken;
    address token;
    address gauge;
    address crvRewards;
    address stash;
    bool shutdown;
  }

  function minter() external view returns (address);

  function poolInfo(uint256 _poolId) external view returns (PoolInfo memory);

  function poolLength() external view returns (uint256);

  //deposit lp tokens and stake
  function deposit(
    uint256 _pid,
    uint256 _amount,
    bool _stake
  ) external returns (bool);

  //withdraw lp tokens
  function withdraw(uint256 _pid, uint256 _amount) external returns (bool);
}
