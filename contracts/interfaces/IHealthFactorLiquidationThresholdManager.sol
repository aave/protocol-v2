// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/**
 * @title HealthFactorLiquidationThresholdManager contract
 * @dev Manager for updating accounts' health factor liquidation
 * threshold.
 * - Owned by the Ormi Governance
 * @author Ormi
 **/
interface IHealthFactorLiquidationThresholdManager {
  /**
   * @dev Emitted when the health factor liquidation threshold of a user is updated.
   * @param user the user's account address to be updated.
   * @param healthFactorLiquidationThreshold the new liquidation threshold to be updated.
   */
  event HealthFactorLiquidationThresholdUpdated(
    address indexed user,
    uint256 healthFactorLiquidationThreshold
  );

  function getHealthFactorLiquidationThreshold(address user) external view returns (uint256);

  function setHealthFactorLiquidationThreshold(
    address user,
    uint256 newHealthFactorLiquidationThreshold
  ) external;
}
