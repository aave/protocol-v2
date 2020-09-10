// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

/**
 * @title interface IVariableDebtToken
 * @author Aave
 * @notice defines the basic interface for a variable debt token.
 * @dev does not inherit from IERC20 to save in contract size
 **/
interface IVariableDebtToken {
  /**
   * @dev emitted when new variable debt is minted
   * @param user the user receiving the debt
   * @param amount the amount of debt being minted
   * @param index the index of the user
   **/
  event MintDebt(
    address user,
    uint256 amount,
    uint256 index
  );

  /**
   * @dev emitted when variable debt is burnt
   * @param user the user which debt has been burned
   * @param amount the amount of debt being burned
   * @param index the index of the user
   **/
  event BurnDebt(
    address user,
    uint256 amount,
    uint256 index
  );

  /**
   * @dev mints new variable debt
   * @param user the user receiving the debt
   * @param amount the amount of debt being minted
   **/
  function mint(address user, uint256 amount) external;

  /**
   * @dev burns user variable debt
   * @param user the user which debt is burnt
   * @param amount the amount of debt being burned
   **/
  function burn(address user, uint256 amount) external;

  /**
   * @dev returns the last index of the user
   * @return the index of the user
   **/
  function getUserIndex(address user) external view returns (uint256);
}
