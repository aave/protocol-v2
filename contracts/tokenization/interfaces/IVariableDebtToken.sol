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
   * @dev mints new variable debt
   * @param _user the user receiving the debt
   * @param _amount the amount of debt being minted
   **/
  function mint(address _user, uint256 _amount) external;

  /**
   * @dev burns user variable debt
   * @param _user the user which debt is burnt
   * @param _amount the amount of debt being burned
   **/
  function burn(address _user, uint256 _amount) external;

  /**
   * @dev returns the last index of the user
   * @return the index of the user
   **/
  function getUserIndex(address _user) external view returns (uint256);
}
