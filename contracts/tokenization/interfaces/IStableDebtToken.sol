// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

/**
 * @title interface IStableDebtToken
 *
 * @notice defines the interface for the stable debt token
 *
 * @dev it does not inherit from IERC20 to save in code size
 *
 * @author Aave
 *
 **/

interface IStableDebtToken {
  /**
   * @dev mints debt token to the target user. The resulting rate is the weighted average
   * between the rate of the new debt and the rate of the previous debt
   * @param _user the address of the user
   * @param _amount the amount of debt tokens to mint
   * @param _rate the rate of the debt being minted.
   **/
  function mint(
    address _user,
    uint256 _amount,
    uint256 _rate
  ) external;

  /**
   * @dev burns debt of the target user.
   * @param _user the address of the user
   * @param _amount the amount of debt tokens to mint
   **/
  function burn(address _user, uint256 _amount) external;

  /**
   * @dev returns the average rate of all the stable rate loans.
   * @return the average stable rate
   **/
  function getAverageStableRate() external view returns (uint256);

  /**
   * @dev returns the stable rate of the user debt
   * @return the stable rate of the user
   **/
  function getUserStableRate(address _user) external view returns (uint256);

  /**
   * @dev returns the timestamp of the last update of the user
   * @return the timestamp
   **/
  function getUserLastUpdated(address _user) external view returns (uint40);
}
