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
   * @dev Returns the health factor liquidation threshold for a particular account.
   * @param user the account of the health factor liquidation threshold we are querying.
   * @return The health factor liquidation threshold.
   **/
  function getHealthFactorLiquidationThreshold(address user) external view returns (uint256);

  /**
   * @dev Updatess the health factor liquidation threshold for a particular account.
   * @param user the account of the health factor liquidation threshold we are querying.
   * @param newHealthFactorLiquidationThreshold the new health factor liquidation threshold value
   * we are updating.
   **/
  function setHealthFactorLiquidationThreshold(
    address user,
    uint256 newHealthFactorLiquidationThreshold
  ) external;
}
