// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IAToken} from './IAToken.sol';

interface IRewardsAwareAToken is IAToken {
  /**
   * @dev Emitted after the update rewards state
   * @param from The address which can claim rewards
   * @param token The reward token address
   * @param claimable The amount available to claim
   **/
  event UserRewardSnapshot(address indexed from, address indexed token, uint256 claimable);

  /**
   * @dev Emitted after the claim action
   * @param from The address performing the claim
   * @param token The reward token address
   * @param claimed The amount claimed
   * @param rewards The rewards amount, this can differ from claimed rewards if is staked
   **/
  event Claim(address indexed from, address indexed token, uint256 claimed, uint256 rewards);

  /**
   * @dev Emitted after the update of the user index
   * @param from The address with updated user index
   * @param token The reward token address
   * @param newIndex The latest user index
   **/
  event UserIndexUpdate(address indexed from, address indexed token, uint256 newIndex);

  /**
   * @dev Emitted after the update of the reward token index
   * @param token The reward token address
   * @param newIndex The amount available to claim
   **/
  event RewardIndexUpdate(address indexed token, uint256 newIndex);

  /**
   * @dev Emitted after the update of the rewards reserve factor
   * @param reserveFactor the new reserve factor
   **/
  event RewardsReserveFactorUpdate(uint256 reserveFactor);

  /**
   * @dev Get the current claimable rewards dinamically by calling the external rewards contract and simulate the rewards without storage
   * @param token Address of the rewards token
   * @param user Address of the account to get current claimable rewards
   * @return The claimable rewards of the address passed at the "user" argument
   */
  function getClaimableRewards(address token, address user) external view returns (uint256);

  /**
   * @dev Get the total lifetime rewards of an address from contract storage
   * @param token Address of the rewards token
   * @param user Address of the account to get the total lifetime rewards
   * @return The total lifetime rewards of an address, this includes claimed and pending rewards
   */
  function getUserRewardsAccrued(address token, address user) external view returns (uint256);

  /**
   * @dev Get the claimed rewards of an address from contract storage
   * @param token Address of the rewards token
   * @param user Address of the account to get the claimed rewards
   * @return The claimed rewards of an address
   */
  function getUserClaimedRewards(address token, address user) external view returns (uint256);

  /**
   * @dev Get the total lifetime rewards of the aToken contract itself, from contract storage
   * @param token Address of the rewards token
   * @return The total lifetime rewards, this includes claimed and pending rewards from the aToken contract
   */
  function getLifetimeRewards(address token) external view returns (uint256);

  /**
   * @dev Get lifetime minted rewards of a rewards token
   * @param token Address of the rewards token
   * @return The lifetime rewards claimed
   */
  function getLifetimeClaimed(address token) external view returns (uint256);

  /**
   * @dev Get the user checkpoint of the aToken contract itself, from contract storage
   * @param token Address of the rewards token
   * @param user Address of the account to get the claimed rewards
   * @return The total lifetime rewards, this includes claimed and pending rewards from the aToken contract
   */
  function getUserIndex(address token, address user) external view returns (uint256);

  /**
   * @dev Get the rewards ERC20 token address by index position
   * @param index The position of the rewards, starting from zero up
   * @return The rewards ERC20 token address
   */
  function getRewardsTokenAddress(uint256 index) external view returns (address);

  /**
   * @dev Get all the rewards token addresses
   * @return The list of rewards token addresseses
   */
  function getRewardsTokenAddressList() external view returns (address[9] memory);

  /**
   * @dev Return the rewards reserve factor to the treasury
   * @return reserve factor in percent value
   */
  function getRewardsReserveFactor() external view returns (uint256);

  /**
   * @dev Claim the available reward from the caller and transfers to `msg.sender`
   */
  function claim(address token) external;

  /**
   * @dev Set the rewards reserve factor to the treasury, only allowed by LendingPoolAddressesProvider pool admin
   * @param reserveFactor reserve factor in percent value
   */
  function setRewardsReserveFactor(uint256 reserveFactor) external;
}
