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
   * @dev emitted when new stable debt is minted
   * @param user the address of the user
   * @param amount the amount minted
   * @param previousBalance the previous balance of the user
   * @param currentBalance the current balance of the user
   * @param balanceIncrease the debt increase since the last update
   * @param newRate the rate of the debt after the minting
   **/
  event MintDebt(
    address user,
    uint256 amount,
    uint256 previousBalance,
    uint256 currentBalance,
    uint256 balanceIncrease,
    uint256 newRate
  );

  /**
   * @dev emitted when new stable debt is burned
   * @param user the address of the user
   * @param amount the amount minted
   * @param previousBalance the previous balance of the user
   * @param currentBalance the current balance of the user
   * @param balanceIncrease the debt increase since the last update
   **/
  event BurnDebt(
    address user,
    uint256 amount,
    uint256 previousBalance,
    uint256 currentBalance,
    uint256 balanceIncrease
  );

  /**
   * @dev mints debt token to the target user. The resulting rate is the weighted average
   * between the rate of the new debt and the rate of the previous debt
   * @param user the address of the user
   * @param amount the amount of debt tokens to mint
   * @param rate the rate of the debt being minted.
   **/
  function mint(
    address user,
    uint256 amount,
    uint256 rate
  ) external;

  /**
   * @dev burns debt of the target user.
   * @param user the address of the user
   * @param amount the amount of debt tokens to mint
   **/
  function burn(address user, uint256 amount) external;

  /**
   * @dev returns the average rate of all the stable rate loans.
   * @return the average stable rate
   **/
  function getAverageStableRate() external view returns (uint256);

  /**
   * @dev returns the stable rate of the user debt
   * @return the stable rate of the user
   **/
  function getUserStableRate(address user) external view returns (uint256);

  /**
   * @dev returns the timestamp of the last update of the user
   * @return the timestamp
   **/
  function getUserLastUpdated(address user) external view returns (uint40);

  /**
   * @dev returns the principal, the total supply and the average stable rate
   **/
  function getSupplyData() external view returns (uint256, uint256, uint256, uint40);

  /**
   * @dev returns the timestamp of the last update of the total supply
   * @return the timestamp
   **/
  function getTotalSupplyLastUpdated() external view returns (uint40);

  /**
   * @dev returns the total supply and the average stable rate
   **/
  function getTotalSupplyAndAvgRate() external view returns (uint256, uint256);

  /**
   * @dev Returns the principal debt balance of the user
   * @return The debt balance of the user since the last burn/mint action
   **/
  function principalBalanceOf(address user) external view returns (uint256);
}
