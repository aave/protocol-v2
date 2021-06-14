// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/**
 * @title Curve Treasury that holds Curve LP and Gauge tokens
 * @notice The treasury holds Curve assets like LP or Gauge tokens and can lock veCRV for boosting Curve yields
 * @author Aave
 */
interface ICurveTreasury {
  /**
   * @dev Deposit Curve LP or Gauge LP tokens into the treasury from a whitelisted entity
   * @param token Curve LP or Gauge LP token address
   * @param amount Amount of tokens to deposit in base unit
   * @param useGauge Flag to determine if the deposit should be staked
   */
  function deposit(
    address token,
    uint256 amount,
    bool useGauge
  ) external;

  /**
   * @dev Withdraw Curve LP or Gauge LP tokens into the treasury from a whitelisted entity
   * @param token Curve LP or Gauge LP token address
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
   * @param tokens Curve LP Token addresses list
   * @param gauges Curve Gauge Staking tokens list, use zero address to disable staking
   * @param whitelisted Flag to determine if the entity should be enabled or disabled
   */
  function setWhitelist(
    address[] calldata entities,
    address[] calldata tokens,
    address[] calldata gauges,
    bool[] memory whitelisted
  ) external;

  /**
   * @dev Claim all available rewards from Curve Gauge Staking contract
   * @param gaugeUnderlyingToken The gauge underlying stake token to claim rewards
   */
  function claimGaugeRewards(address gaugeUnderlyingToken) external;

  /**
   * @dev Claim Curve Distributor fees and send to protocol treasury
   */
  function claimCurveDistributorFees() external;

  /**
   * @dev Lock the CRV at the veCRV contract up to 4 years to boost rewards from Curve
   * @param amount Amount of CRV to lock inside the Lock Contract
   * @param unlockTime Time where the CRV will be unlocked, maximum 4 years
   */
  function lockCrv(uint256 amount, uint256 unlockTime) external;

  /**
   * @dev Withdraw the unlocked CRV at the veCRV contract after the time lock
   */
  function unlockCrv() external;

  /**
   * @dev Increase the CRV amount inside the veCRV contract
   * @param amount The amount of CRV token to add to the current time lock
   */
  function increaseLockedCrv(uint256 amount) external;

  /**
   * @dev Extend the CRV time lock inside the veCRV ontract
   * @param unlockTime Next time where the CRV will be unlocked, maximum 4 years
   */
  function increaseUnlockTimeCrv(uint256 unlockTime) external;

  /** Owner methods related with Gauge Controller Voting contract */

  /**
   * @dev Vote to set the gauge weights using veCRV
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
