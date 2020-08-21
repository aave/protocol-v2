// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {LendingPoolAddressesProvider} from '../configuration/LendingPoolAddressesProvider.sol';
import {ReserveConfiguration} from '../libraries/configuration/ReserveConfiguration.sol';
pragma experimental ABIEncoderV2;

interface ILendingPool {
  /**
   * @dev deposits The underlying asset into the reserve. A corresponding amount of the overlying asset (aTokens)
   * is minted.
   * @param reserve the address of the reserve
   * @param amount the amount to be deposited
   * @param referralCode integrators are assigned a referral code and can potentially receive rewards.
   **/
  function deposit(
    address reserve,
    uint256 amount,
    uint16 referralCode
  ) external;

  /**
   * @dev withdraws the assets of user.
   * @param reserve the address of the reserve
   * @param amount the underlying amount to be redeemed
   **/
  function withdraw(address reserve, uint256 amount) external;

  /**
   * @dev Allows users to borrow a specific amount of the reserve currency, provided that the borrower
   * already deposited enough collateral.
   * @param reserve the address of the reserve
   * @param amount the amount to be borrowed
   * @param interestRateMode the interest rate mode at which the user wants to borrow. Can be 0 (STABLE) or 1 (VARIABLE)
   **/
  function borrow(
    address reserve,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referralCode
  ) external;

  /**
   * @notice repays a borrow on the specific reserve, for the specified amount (or for the whole amount, if uint256(-1) is specified).
   * @dev the target user is defined by onBehalfOf. If there is no repayment on behalf of another account,
   * onBehalfOf must be equal to msg.sender.
   * @param reserve the address of the reserve on which the user borrowed
   * @param amount the amount to repay, or uint256(-1) if the user wants to repay everything
   * @param onBehalfOf the address for which msg.sender is repaying.
   **/
  function repay(
    address reserve,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) external;

  /**
   * @dev borrowers can user this function to swap between stable and variable borrow rate modes.
   * @param reserve the address of the reserve on which the user borrowed
   * @param rateMode the rate mode that the user wants to swap
   **/
  function swapBorrowRateMode(address reserve, uint256 rateMode) external;

  /**
   * @dev rebalances the stable interest rate of a user if current liquidity rate > user stable rate.
   * this is regulated by Aave to ensure that the protocol is not abused, and the user is paying a fair
   * rate. Anyone can call this function.
   * @param reserve the address of the reserve
   * @param user the address of the user to be rebalanced
   **/
  function rebalanceStableBorrowRate(address reserve, address user) external;

  /**
   * @dev allows depositors to enable or disable a specific deposit as collateral.
   * @param reserve the address of the reserve
   * @param useAsCollateral true if the user wants to user the deposit as collateral, false otherwise.
   **/
  function setUserUseReserveAsCollateral(address reserve, bool useAsCollateral) external;

  /**
   * @dev users can invoke this function to liquidate an undercollateralized position.
   * @param reserve the address of the collateral to liquidated
   * @param reserve the address of the principal reserve
   * @param user the address of the borrower
   * @param purchaseAmount the amount of principal that the liquidator wants to repay
   * @param receiveAToken true if the liquidators wants to receive the aTokens, false if
   * he wants to receive the underlying asset directly
   **/
  function liquidationCall(
    address collateral,
    address reserve,
    address user,
    uint256 purchaseAmount,
    bool receiveAToken
  ) external;

  /**
   * @dev allows smartcontracts to access the liquidity of the pool within one transaction,
   * as long as the amount taken plus a fee is returned. NOTE There are security concerns for developers of flashloan receiver contracts
   * that must be kept into consideration. For further details please visit https://developers.aave.com
   * @param receiver The address of the contract receiving the funds. The receiver should implement the IFlashLoanReceiver interface.
   * @param reserve the address of the principal reserve
   * @param amount the amount requested for this flashloan
   **/
  function flashLoan(
    address receiver,
    address reserve,
    uint256 amount,
    bytes calldata params
  ) external;

  /**
   * @dev accessory functions to fetch data from the core contract
   **/

  function getReserveConfigurationData(address reserve)
    external
    view
    returns (
      uint256 decimals,
      uint256 ltv,
      uint256 liquidationThreshold,
      uint256 liquidationBonus,
      address interestRateStrategyAddress,
      bool usageAsCollateralEnabled,
      bool borrowingEnabled,
      bool stableBorrowRateEnabled,
      bool isActive,
      bool isFreezed
    );

  function getReserveTokensAddresses(address reserve)
    external
    view
    returns (
      address aTokenAddress,
      address stableDebtTokenAddress,
      address variableDebtTokenAddress
    );

  function getReserveData(address reserve)
    external
    view
    returns (
      uint256 availableLiquidity,
      uint256 totalBorrowsStable,
      uint256 totalBorrowsVariable,
      uint256 liquidityRate,
      uint256 variableBorrowRate,
      uint256 stableBorrowRate,
      uint256 averageStableBorrowRate,
      uint256 liquidityIndex,
      uint256 variableBorrowIndex,
      uint40 lastUpdateTimestamp
    );

  function getUserAccountData(address user)
    external
    view
    returns (
      uint256 totalCollateralETH,
      uint256 totalBorrowsETH,
      uint256 availableBorrowsETH,
      uint256 currentLiquidationThreshold,
      uint256 ltv,
      uint256 healthFactor
    );

  function getUserReserveData(address reserve, address user)
    external
    view
    returns (
      uint256 currentATokenBalance,
      uint256 currentStableDebt,
      uint256 currentVariableDebt,
      uint256 principalStableDebt,
      uint256 principalVariableDebt,
      uint256 stableBorrowRate,
      uint256 liquidityRate,
      uint256 variableBorrowIndex,
      uint40 stableRateLastUpdated,
      bool usageAsCollateralEnabled
    );

  /**
   * @dev initializes a reserve
   * @param reserve the address of the reserve
   * @param aTokenAddress the address of the overlying aToken contract
   * @param interestRateStrategyAddress the address of the interest rate strategy contract
   **/
  function initReserve(
    address reserve,
    address aTokenAddress,
    address stableDebtAddress,
    address variableDebtAddress,
    address interestRateStrategyAddress
  ) external;

  /**
   * @dev updates the address of the interest rate strategy contract
   * @param reserve the address of the reserve
   * @param rateStrategyAddress the address of the interest rate strategy contract
   **/

  function setReserveInterestRateStrategyAddress(address reserve, address rateStrategyAddress)
    external;

  function setConfiguration(address reserve, uint256 configuration) external;

  function getConfiguration(address reserve)
    external
    view
    returns (ReserveConfiguration.Map memory);

  function getReserveNormalizedIncome(address reserve) external view returns (uint256);

  function getReserveNormalizedVariableDebt(address reserve) external view returns (uint256);

  function balanceDecreaseAllowed(
    address reserve,
    address user,
    uint256 amount
  ) external view returns (bool);

  function getReserves() external view returns (address[] memory);
}
