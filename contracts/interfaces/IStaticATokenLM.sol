// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';

interface IStaticATokenLM is IERC20 {
  struct SignatureParams {
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  function deposit(
    address recipient,
    uint256 amount,
    uint16 referralCode,
    bool fromUnderlying
  ) external returns (uint256);

  function withdraw(
    address recipient,
    uint256 amount,
    bool toUnderlying
  ) external returns (uint256, uint256);

  function withdrawDynamicAmount(
    address recipient,
    uint256 amount,
    bool toUnderlying
  ) external returns (uint256, uint256);

  function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external;

  function metaDeposit(
    address depositor,
    address recipient,
    uint256 value,
    uint16 referralCode,
    bool fromUnderlying,
    uint256 deadline,
    SignatureParams calldata sigParams
  ) external returns (uint256);

  function metaWithdraw(
    address owner,
    address recipient,
    uint256 staticAmount,
    uint256 dynamicAmount,
    bool toUnderlying,
    uint256 deadline,
    SignatureParams calldata sigParams
  ) external returns (uint256, uint256);

  function dynamicBalanceOf(address account) external view returns (uint256);

  function staticToDynamicAmount(uint256 amount) external view returns (uint256);

  function dynamicToStaticAmount(uint256 amount) external view returns (uint256);

  function rate() external view returns (uint256);

  function getDomainSeparator() external view returns (bytes32);

  function collectAndUpdateRewards() external;

  function claimRewardsOnBehalf(
    address onBehalfOf,
    address receiver,
    bool forceUpdate
  ) external;

  function claimRewards(address receiver, bool forceUpdate) external;

  function claimRewardsToSelf(bool forceUpdate) external;

  function getTotalClaimableRewards() external view returns (uint256);

  function getClaimableRewards(address user) external view returns (uint256);

  function getUnclaimedRewards(address user) external view returns (uint256);

  function getAccRewardsPerToken() external view returns (uint256);

  function getLifetimeRewardsClaimed() external view returns (uint256);

  function getLifetimeRewards() external view returns (uint256);

  function getLastRewardBlock() external view returns (uint256);
}
