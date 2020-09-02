// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

/**
 * @title Errors library
 * @author Aave
 * @notice Implements error messages.
 */
library Errors {
  // require error messages - ValidationLogic
  string public constant AMOUNT_NOT_GREATER_THAN_0 = '1'; // 'Amount must be greater than 0'
  string public constant NO_ACTIVE_RESERVE = '2'; // 'Action requires an active reserve'
  string public constant NO_UNFREEZED_RESERVE = '3'; // 'Action requires an unfreezed reserve'
  string public constant CURRENT_AVAILABLE_LIQUIDITY_NOT_ENOUGH = '4'; // 'The current liquidity is not enough'
  string public constant NOT_ENOUGH_AVAILABLE_USER_BALANCE = '5'; // 'User cannot withdraw more than the available balance'
  string public constant TRANSFER_NOT_ALLOWED = '6'; // 'Transfer cannot be allowed.'
  string public constant BORROWING_NOT_ENABLED = '7'; // 'Borrowing is not enabled'
  string public constant INVALID_INTERESTRATE_MODE_SELECTED = '8'; // 'Invalid interest rate mode selected'
  string public constant COLLATERAL_BALANCE_IS_0 = '9'; // 'The collateral balance is 0'
  string public constant HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD = '10'; // 'Health factor is lesser than the liquidation threshold'
  string public constant COLLATERAL_CANNOT_COVER_NEW_BORROW = '11'; // 'There is not enough collateral to cover a new borrow'
  string public constant STABLE_BORROWING_NOT_ENABLED = '12'; // stable borrowing not enabled
  string public constant CALLATERAL_SAME_AS_BORROWING_CURRENCY = '13'; // collateral is (mostly) the same currency that is being borrowed
  string public constant AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE = '14'; // 'The requested amount is greater than the max loan size in stable rate mode
  string public constant NO_DEBT_OF_SELECTED_TYPE = '15'; // 'for repayment of stable debt, the user needs to have stable debt, otherwise, he needs to have variable debt'
  string public constant NO_EPLICIT_AMOUNT_TO_REPAY_ON_BEHALF = '16'; // 'To repay on behalf of an user an explicit amount to repay is needed'
  string public constant NO_STABLE_RATE_LOAN_IN_RESERVE = '17'; // 'User does not have a stable rate loan in progress on this reserve'
  string public constant NO_VARIABLE_RATE_LOAN_IN_RESERVE = '18'; // 'User does not have a variable rate loan in progress on this reserve'
  string public constant UNDERLYING_BALANCE_NOT_GREATER_THAN_0 = '19'; // 'The underlying balance needs to be greater than 0'
  string public constant DEPOSIT_ALREADY_IN_USE = '20'; // 'User deposit is already being used as collateral'

  // require error messages - LendingPool
  string public constant NOT_ENOUGH_STABLE_BORROW_BALANCE = '21'; // 'User does not have any stable rate loan for this reserve'
  string public constant INTERESTRATE_REBALANCE_CONDITIONS_NOT_MET = '22'; // 'Interest rate rebalance conditions were not met'
  string public constant LIQUIDATION_CALL_FAILED = '23'; // 'Liquidation call failed'
  string public constant NOT_ENOUGH_LIQUIDITY_TO_BORROW = '24'; // 'There is not enough liquidity available to borrow'
  string public constant REQUESTED_AMOUNT_TO_SMALL = '25'; // 'The requested amount is too small for a FlashLoan.'
  string public constant INCONSISTENT_PROTOCOL_ACTUAL_BALANCE = '26'; // 'The actual balance of the protocol is inconsistent'

  // require error messages - aToken
  string public constant CALLER_MUST_BE_LENDING_POOL = '27'; // 'The caller of this function must be a lending pool'
  string public constant NOT_ALLOWED_TO_REDIRECT_INTEREST = '28'; // 'Caller is not allowed to redirect the interest of the user'
  string public constant CANNOT_GIVE_ALLOWANCE_TO_HIMSELF = '29'; // 'User cannot give allowance to himself'
  string public constant TRANSFER_AMOUNT_NOT_GT_0 = '30'; // 'Transferred amount needs to be greater than zero'
  string public constant INTEREST_ALREADY_REDIRECTED = '31'; // 'Interest is already redirected to the user'
  string public constant NO_VALID_BALANCE_FOR_REDIRECT_INT_STREAM = '32'; // 'Interest stream can only be redirected if there is a valid balance'

  // require error messages - ReserveLogic
  string public constant RESERVE_ALREADY_INITIALIZED = '33'; // 'Reserve has already been initialized'

  //require error messages - LendingPoolConfiguration
  string public constant CALLER_NOT_LENDING_POOL_MANAGER = '34'; // 'The caller must be a lending pool manager'
  string public constant RESERVE_LIQUIDITY_NOT_0 = '35'; // 'The liquidity of the reserve needs to be 0'

  //require error messages - LendingPoolAddressesProviderRegistry
  string public constant PROVIDER_NOT_REGISTERED = '36'; // 'Provider is not registered'
}
