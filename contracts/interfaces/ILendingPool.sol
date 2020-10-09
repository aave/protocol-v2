// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {LendingPoolAddressesProvider} from '../configuration/LendingPoolAddressesProvider.sol';
import {ReserveConfiguration} from '../libraries/configuration/ReserveConfiguration.sol';
import {ReserveLogic} from '../libraries/logic/ReserveLogic.sol';

pragma experimental ABIEncoderV2;

interface ILendingPool {
  /**
   * @dev emitted on deposit
   * @param reserve the address of the reserve
   * @param user the address of the user
   * @param amount the amount to be deposited
   * @param referral the referral number of the action
   **/
  event Deposit(
    address indexed reserve,
    address user,
    address indexed onBehalfOf,
    uint256 amount,
    uint16 indexed referral
  );

  /**
   * @dev emitted during a withdraw action.
   * @param reserve the address of the reserve
   * @param user the address of the user
   * @param amount the amount to be withdrawn
   **/
  event Withdraw(address indexed reserve, address indexed user, uint256 amount);

  event BorrowAllowanceDelegated(
    address indexed asset,
    address indexed fromUser,
    address indexed toUser,
    uint256 interestRateMode,
    uint256 amount
  );
  /**
   * @dev emitted on borrow
   * @param reserve the address of the reserve
   * @param user the address of the user
   * @param amount the amount to be deposited
   * @param borrowRateMode the rate mode, can be either 1-stable or 2-variable
   * @param borrowRate the rate at which the user has borrowed
   * @param referral the referral number of the action
   **/
  event Borrow(
    address indexed reserve,
    address user,
    address indexed onBehalfOf,
    uint256 amount,
    uint256 borrowRateMode,
    uint256 borrowRate,
    uint16 indexed referral
  );
  /**
   * @dev emitted on repay
   * @param reserve the address of the reserve
   * @param user the address of the user for which the repay has been executed
   * @param repayer the address of the user that has performed the repay action
   * @param amount the amount repaid
   **/
  event Repay(
    address indexed reserve,
    address indexed user,
    address indexed repayer,
    uint256 amount
  );
  /**
   * @dev emitted when a user performs a rate swap
   * @param reserve the address of the reserve
   * @param user the address of the user executing the swap
   **/
  event Swap(address indexed reserve, address indexed user);

  /**
   * @dev emitted when a user enables a reserve as collateral
   * @param reserve the address of the reserve
   * @param user the address of the user
   **/
  event ReserveUsedAsCollateralEnabled(address indexed reserve, address indexed user);

  /**
   * @dev emitted when a user disables a reserve as collateral
   * @param reserve the address of the reserve
   * @param user the address of the user
   **/
  event ReserveUsedAsCollateralDisabled(address indexed reserve, address indexed user);

  /**
   * @dev emitted when the stable rate of a user gets rebalanced
   * @param reserve the address of the reserve
   * @param user the address of the user for which the rebalance has been executed
   **/
  event RebalanceStableBorrowRate(address indexed reserve, address indexed user);
  /**
   * @dev emitted when a flashloan is executed
   * @param target the address of the flashLoanReceiver
   * @param reserve the address of the reserve
   * @param amount the amount requested
   * @param totalPremium the total fee on the amount
   * @param referralCode the referral code of the caller
   **/
  event FlashLoan(
    address indexed target,
    address indexed reserve,
    uint256 amount,
    uint256 totalPremium,
    uint16 referralCode
  );
  /**
   * @dev these events are not emitted directly by the LendingPool
   * but they are declared here as the LendingPoolCollateralManager
   * is executed using a delegateCall().
   * This allows to have the events in the generated ABI for LendingPool.
   **/

  /**
   * @dev emitted when a borrower is liquidated
   * @param collateral the address of the collateral being liquidated
   * @param reserve the address of the reserve
   * @param user the address of the user being liquidated
   * @param purchaseAmount the total amount liquidated
   * @param liquidatedCollateralAmount the amount of collateral being liquidated
   * @param accruedBorrowInterest the amount of interest accrued by the borrower since the last action
   * @param liquidator the address of the liquidator
   * @param receiveAToken true if the liquidator wants to receive aTokens, false otherwise
   **/
  event LiquidationCall(
    address indexed collateral,
    address indexed reserve,
    address indexed user,
    uint256 purchaseAmount,
    uint256 liquidatedCollateralAmount,
    uint256 accruedBorrowInterest,
    address liquidator,
    bool receiveAToken
  );
  /**
   * @dev Emitted when the pause is triggered.
   */
  event Paused();

  /**
   * @dev Emitted when the pause is lifted.
   */
  event Unpaused();

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
    address onBehalfOf,
    uint16 referralCode
  ) external;

  /**
   * @dev withdraws the assets of user.
   * @param reserve the address of the reserve
   * @param amount the underlying amount to be redeemed
   **/
  function withdraw(address reserve, uint256 amount) external;

  /**
   * @dev Sets allowance to borrow on a certain type of debt asset for a certain user address
   * @param asset The underlying asset of the debt token
   * @param user The user to give allowance to
   * @param interestRateMode Type of debt: 1 for stable, 2 for variable
   * @param amount Allowance amount to borrow
   **/
  function delegateBorrowAllowance(
    address asset,
    address user,
    uint256 interestRateMode,
    uint256 amount
  ) external;

  function getBorrowAllowance(
    address fromUser,
    address toUser,
    address asset,
    uint256 interestRateMode
  ) external view returns (uint256);

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
    uint16 referralCode,
    address onBehalfOf
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
   * @dev flashes the underlying collateral on an user to swap for the owed asset and repay
   * - Both the owner of the position and other liquidators can execute it
   * - The owner can repay with his collateral at any point, no matter the health factor
   * - Other liquidators can only use this function below 1 HF. To liquidate 50% of the debt > HF 0.98 or the whole below
   * @param collateral The address of the collateral asset
   * @param principal The address of the owed asset
   * @param user Address of the borrower
   * @param principalAmount Amount of the debt to repay. type(uint256).max to repay the maximum possible
   * @param receiver Address of the contract receiving the collateral to swap
   * @param params Variadic bytes param to pass with extra information to the receiver
   **/
  function repayWithCollateral(
    address collateral,
    address principal,
    address user,
    uint256 principalAmount,
    address receiver,
    bytes calldata params
  ) external;

  /**
   * @dev allows smartcontracts to access the liquidity of the pool within one transaction,
   * as long as the amount taken plus a fee is returned. NOTE There are security concerns for developers of flashloan receiver contracts
   * that must be kept into consideration. For further details please visit https://developers.aave.com
   * @param receiver The address of the contract receiving the funds. The receiver should implement the IFlashLoanReceiver interface.
   * @param reserve the address of the principal reserve
   * @param amount the amount requested for this flashloan
   * @param params a bytes array to be sent to the flashloan executor
   * @param referralCode the referral code of the caller
   **/
  function flashLoan(
    address receiver,
    address reserve,
    uint256 amount,
    uint256 debtType,
    bytes calldata params,
    uint16 referralCode
  ) external;

  /**
   * @dev Allows an user to release one of his assets deposited in the protocol, even if it is used as collateral, to swap for another.
   * - It's not possible to release one asset to swap for the same
   * @param receiverAddress The address of the contract receiving the funds. The receiver should implement the ISwapAdapter interface
   * @param fromAsset Asset to swap from
   * @param toAsset Asset to swap to
   * @param params a bytes array to be sent (if needed) to the receiver contract with extra data
   **/
  function swapLiquidity(
    address receiverAddress,
    address fromAsset,
    address toAsset,
    uint256 amountToSwap,
    bytes calldata params
  ) external;

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

  function getReserveData(address asset) external view returns (ReserveLogic.ReserveData memory);

  function balanceDecreaseAllowed(
    address reserve,
    address user,
    uint256 amount
  ) external view returns (bool);

  function getReservesList() external view returns (address[] memory);

  /**
   * @dev Set the _pause state
   * @param val the boolean value to set the current pause state of LendingPool
   */
  function setPause(bool val) external;

  /**
   * @dev Returns if the LendingPool is paused
   */
  function paused() external view returns (bool);
}
