// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/**
 * @title Balancer Treasury that holds Balancer LP and Gauge tokens
 * @notice The treasury holds Balancer assets like LP or Gauge tokens and can lock veBal for boosting Balancer yields
 * @author Aave
 */
interface IBalancerTreasury {
  /**
   * @dev Deposit Balancer LP or Gauge LP tokens into the treasury from a whitelisted entity
   * @param token Balancer LP or Gauge LP token address
   * @param amount Amount of tokens to deposit in base unit
   * @param useGauge Flag to determine if the deposit should be staked
   */
  function deposit(
    address token,
    uint256 amount,
    bool useGauge
  ) external;

  /**
   * @dev Withdraw Balancer LP or Gauge LP tokens into the treasury from a whitelisted entity
   * @param token Balancer LP or Gauge LP token address
   * @param amount Amount of tokens to withdraw in base unit
   * @param useGauge Flag to determine if the withdraw should be unstaked
   */
  function withdraw(
    address token,
    uint256 amount,
    bool useGauge
  ) external;

  /**
   * @dev Register entities to enable or disable deposits and withdraws from the treasury
   * @param entities Entities addresses list
   * @param tokens Balancer LP Token addresses list
   * @param gauges Balancer Gauge Staking tokens list, use zero address to disable staking
   * @param whitelisted Flag to determine if the entity should be enabled or disabled
   */
  function setWhitelist(
    address[] calldata entities,
    address[] calldata tokens,
    address[] calldata gauges,
    bool[] memory whitelisted
  ) external;

  /**
   * @dev Claim all available rewards from Balancer Gauge Staking contract
   * @param gaugeUnderlyingToken The gauge underlying stake token to claim rewards
   */
  function claimGaugeRewards(address gaugeUnderlyingToken) external;

  /**
   * @dev Claim Balancer Distributor fees and send to protocol treasury
   * @param tokens list of tokens to claim
   */
  function claimBalancerDistributorFees(address[] calldata tokens) external;

  /**
   * @dev Lock the BAL at the veBAL contract up to 1 year to boost rewards from Balancer
   * @param amount Amount of BAL to lock inside the Lock Contract
   * @param unlockTime Time where the BAL will be unlocked, maximum 1 year
   */
  function lockBal(uint256 amount, uint256 unlockTime) external;

  /**
   * @dev Withdraw the unlocked BAL at the veBAL contract after the time lock
   */
  function unlockBal() external;

  /**
   * @dev Increase the BAL amount inside the veBAL contract
   * @param amount The amount of BAL token to add to the current time lock
   */
  function increaseLockedBal(uint256 amount) external;

  /**
   * @dev Extend the BAL time lock inside the veBAL ontract
   * @param unlockTime Next time where the BAL will be unlocked, maximum 4 years
   */
  function increaseUnlockTimeBal(uint256 unlockTime) external;

  /** Owner methods related with Gauge Controller Voting contract */

  /**
   * @dev Vote to set the gauge weights using veBAL
   * @param gauge Gauge address to set the voting weight
   * @param weight Percentage of voting with two decimal points, 100% equals 10000
   */
  function voteForGaugeWeights(address gauge, uint256 weight) external;

  /**
   * @dev Get the current owner of this contract
   */
  function owner() external view returns (address);

  /**
   * @dev Transfers ownership of the contract to a new account (`newOwner`).
   * @param newOwner addess of the new owner
   */
  function transferOwnership(address newOwner) external;
}
