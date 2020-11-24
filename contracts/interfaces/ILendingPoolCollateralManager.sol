// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/**
 * @title ILendingPoolCollateralManager interface
 * @author Aave
 * @notice Defines the actions involving management of collateral in the protocol.
 **/
interface ILendingPoolCollateralManager {
  /**
   * @dev emitted when a borrower is liquidated
   * @param collateral the address of the collateral being liquidated
   * @param principal the address of the reserve
   * @param user the address of the user being liquidated
   * @param debtToCover the total amount liquidated
   * @param liquidatedCollateralAmount the amount of collateral being liquidated
   * @param liquidator the address of the liquidator
   * @param receiveAToken true if the liquidator wants to receive aTokens, false otherwise
   **/
  event LiquidationCall(
    address indexed collateral,
    address indexed principal,
    address indexed user,
    uint256 debtToCover,
    uint256 liquidatedCollateralAmount,
    address liquidator,
    bool receiveAToken
  );

  /**
   * @dev emitted when a user disables a reserve as collateral
   * @param reserve the address of the reserve
   * @param user the address of the user
   **/
  event ReserveUsedAsCollateralDisabled(address indexed reserve, address indexed user);

  /**
   * @dev users can invoke this function to liquidate an undercollateralized position.
   * @param collateral the address of the collateral to liquidated
   * @param principal the address of the principal reserve
   * @param user the address of the borrower
   * @param debtToCover the amount of principal that the liquidator wants to repay
   * @param receiveAToken true if the liquidators wants to receive the aTokens, false if
   * he wants to receive the underlying asset directly
   **/
  function liquidationCall(
    address collateral,
    address principal,
    address user,
    uint256 debtToCover,
    bool receiveAToken
  ) external virtual returns (uint256, string memory);
}
