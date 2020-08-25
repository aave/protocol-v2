// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ReserveLogic} from './ReserveLogic.sol';
import {GenericLogic} from './GenericLogic.sol';
import {WadRayMath} from '../math/WadRayMath.sol';
import {PercentageMath} from '../math/PercentageMath.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {ReserveConfiguration} from '../configuration/ReserveConfiguration.sol';
import {UserConfiguration} from '../configuration/UserConfiguration.sol';
import {IPriceOracleGetter} from '../../interfaces/IPriceOracleGetter.sol';

/**
 * @title ReserveLogic library
 * @author Aave
 * @notice Implements functions to validate specific action on the protocol.
 */
library ValidationLogic {
  using ReserveLogic for ReserveLogic.ReserveData;
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;
  using ReserveConfiguration for ReserveConfiguration.Map;
  using UserConfiguration for UserConfiguration.Map;

  //require error messages
  string private constant AMOUNT_NOT_GREATER_THAN_0 = '1'; // 'Amount must be greater than 0'
  string private constant NO_ACTIVE_RESERVE = '2'; // 'Action requires an active reserve'
  string private constant NO_UNFREEZED_RESERVE = '3'; // 'Action requires an unfreezed reserve'
  string private constant CURRENT_AVAILABLE_LIQUIDITY_NOT_ENOUGH = '4'; // 'The current liquidity is not enough'
  string private constant NOT_ENOUGH_AVAILABLE_USER_BALANCE = '5'; // 'User cannot withdraw more than the available balance'
  string private constant TRANSFER_NOT_ALLOWED = '6'; // 'Transfer cannot be allowed.'
  string private constant BORROWING_NOT_ENABLED = '7'; // 'Borrowing is not enabled'
  string private constant INVALID_INTERESTRATE_MODE_SELECTED = '8'; // 'Invalid interest rate mode selected'
  string private constant COLLATERAL_BALANCE_IS_0 = '9'; // 'The collateral balance is 0'
  string private constant HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD = '10'; // 'Health factor is lesser than the liquidation threshold'
  string private constant COLLATERAL_CANNOT_COVER_NEW_BORROW = '11'; // 'There is not enough collateral to cover a new borrow'
  string private constant STABLE_BORROWING_NOT_ENABLED = '12'; // stable borrowing not enabled
  string private constant CALLATERAL_SAME_AS_BORROWING_CURRENCY = '13'; // collateral is (mostly) the same currency that is being borrowed
  string private constant AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE = '14'; // 'The requested amount is greater than the max loan size in stable rate mode
  string private constant NO_DEBT_OF_SELECTED_TYPE = '15'; // 'for repayment of stable debt, the user needs to have stable debt, otherwise, he needs to have variable debt'
  string private constant NO_EPLICIT_AMOUNT_TO_REPAY_ON_BEHALF = '16'; // 'To repay on behalf of an user an explicit amount to repay is needed'
  string private constant NO_STABLE_RATE_LOAN_IN_RESERVE = '17'; // 'User does not have a stable rate loan in progress on this reserve'
  string private constant NO_VARIABLE_RATE_LOAN_IN_RESERVE = '18'; // 'User does not have a variable rate loan in progress on this reserve'
  string private constant UNDERLYING_BALANCE_NOT_GREATER_THAN_0 = '19'; // 'The underlying balance needs to be greater than 0'
  string private constant DEPOSIT_ALREADY_IN_USE = '20'; // 'User deposit is already being used as collateral'

  /**
   * @dev validates a deposit.
   * @param reserve the reserve state on which the user is depositing
   * @param amount the amount to be deposited
   */
  function validateDeposit(ReserveLogic.ReserveData storage reserve, uint256 amount) internal view {
    (bool isActive, bool isFreezed, , ) = reserve.configuration.getFlags();

    require(amount > 0, AMOUNT_NOT_GREATER_THAN_0);
    require(isActive, NO_ACTIVE_RESERVE);
    require(!isFreezed, NO_UNFREEZED_RESERVE);
  }

  /**
   * @dev validates a withdraw action.
   * @param reserveAddress the address of the reserve
   * @param aTokenAddress the address of the aToken for the reserve
   * @param amount the amount to be withdrawn
   * @param userBalance the balance of the user
   */
  function validateWithdraw(
    address reserveAddress,
    address aTokenAddress,
    uint256 amount,
    uint256 userBalance,
    mapping(address => ReserveLogic.ReserveData) storage reservesData,
    UserConfiguration.Map storage userConfig,
    address[] calldata reserves,
    address oracle
  ) external view {
    require(amount > 0, AMOUNT_NOT_GREATER_THAN_0);

    uint256 currentAvailableLiquidity = IERC20(reserveAddress).balanceOf(address(aTokenAddress));

    require(currentAvailableLiquidity >= amount, CURRENT_AVAILABLE_LIQUIDITY_NOT_ENOUGH);

    require(amount <= userBalance, NOT_ENOUGH_AVAILABLE_USER_BALANCE);

    require(
      GenericLogic.balanceDecreaseAllowed(
        reserveAddress,
        msg.sender,
        userBalance,
        reservesData,
        userConfig,
        reserves,
        oracle
      ),
      TRANSFER_NOT_ALLOWED
    );
  }

  struct ValidateBorrowLocalVars {
    uint256 principalBorrowBalance;
    uint256 currentLtv;
    uint256 currentLiquidationThreshold;
    uint256 requestedBorrowAmountETH;
    uint256 amountOfCollateralNeededETH;
    uint256 userCollateralBalanceETH;
    uint256 userBorrowBalanceETH;
    uint256 borrowBalanceIncrease;
    uint256 currentReserveStableRate;
    uint256 availableLiquidity;
    uint256 finalUserBorrowRate;
    uint256 healthFactor;
    ReserveLogic.InterestRateMode rateMode;
    bool healthFactorBelowThreshold;
    bool isActive;
    bool isFreezed;
    bool borrowingEnabled;
    bool stableRateBorrowingEnabled;
  }

  /**
   * @dev validates a borrow.
   * @param reserve the reserve state from which the user is borrowing
   * @param reserveAddress the address of the reserve
   * @param amount the amount to be borrowed
   * @param amountInETH the amount to be borrowed, in ETH
   * @param interestRateMode the interest rate mode at which the user is borrowing
   * @param maxStableLoanPercent the max amount of the liquidity that can be borrowed at stable rate, in percentage
   * @param reservesData the state of all the reserves
   * @param userConfig the state of the user for the specific reserve
   * @param reserves the addresses of all the active reserves
   * @param oracle the price oracle
   */

  function validateBorrow(
    ReserveLogic.ReserveData storage reserve,
    address reserveAddress,
    uint256 amount,
    uint256 amountInETH,
    uint256 interestRateMode,
    uint256 maxStableLoanPercent,
    mapping(address => ReserveLogic.ReserveData) storage reservesData,
    UserConfiguration.Map storage userConfig,
    address[] calldata reserves,
    address oracle
  ) external view {
    ValidateBorrowLocalVars memory vars;

    (
      vars.isActive,
      vars.isFreezed,
      vars.borrowingEnabled,
      vars.stableRateBorrowingEnabled
    ) = reserve.configuration.getFlags();

    require(vars.isActive, NO_ACTIVE_RESERVE);
    require(!vars.isFreezed, NO_UNFREEZED_RESERVE);

    require(vars.borrowingEnabled, BORROWING_NOT_ENABLED);

    //validate interest rate mode
    require(
      uint256(ReserveLogic.InterestRateMode.VARIABLE) == interestRateMode ||
        uint256(ReserveLogic.InterestRateMode.STABLE) == interestRateMode,
      INVALID_INTERESTRATE_MODE_SELECTED
    );

    //check that the amount is available in the reserve
    vars.availableLiquidity = IERC20(reserveAddress).balanceOf(address(reserve.aTokenAddress));

    require(vars.availableLiquidity >= amount, CURRENT_AVAILABLE_LIQUIDITY_NOT_ENOUGH);

    (
      vars.userCollateralBalanceETH,
      vars.userBorrowBalanceETH,
      vars.currentLtv,
      vars.currentLiquidationThreshold,
      vars.healthFactor
    ) = GenericLogic.calculateUserAccountData(
      msg.sender,
      reservesData,
      userConfig,
      reserves,
      oracle
    );

    require(vars.userCollateralBalanceETH > 0, COLLATERAL_BALANCE_IS_0);

    require(
      vars.healthFactor > GenericLogic.HEALTH_FACTOR_LIQUIDATION_THRESHOLD,
      HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD
    );

    //add the current already borrowed amount to the amount requested to calculate the total collateral needed.
    vars.amountOfCollateralNeededETH = vars.userBorrowBalanceETH.add(amountInETH).percentDiv(
      vars.currentLtv
    ); //LTV is calculated in percentage

    require(
      vars.amountOfCollateralNeededETH <= vars.userCollateralBalanceETH,
      COLLATERAL_CANNOT_COVER_NEW_BORROW
    );

    /**
     * Following conditions need to be met if the user is borrowing at a stable rate:
     * 1. Reserve must be enabled for stable rate borrowing
     * 2. Users cannot borrow from the reserve if their collateral is (mostly) the same currency
     *    they are borrowing, to prevent abuses.
     * 3. Users will be able to borrow only a relatively small, configurable amount of the total
     *    liquidity
     **/

    if (vars.rateMode == ReserveLogic.InterestRateMode.STABLE) {
      //check if the borrow mode is stable and if stable rate borrowing is enabled on this reserve

      require(vars.stableRateBorrowingEnabled, STABLE_BORROWING_NOT_ENABLED);

      require(
        !userConfig.isUsingAsCollateral(reserve.index) ||
          reserve.configuration.getLtv() == 0 ||
          amount > IERC20(reserve.aTokenAddress).balanceOf(msg.sender),
        CALLATERAL_SAME_AS_BORROWING_CURRENCY
      );

      //calculate the max available loan size in stable rate mode as a percentage of the
      //available liquidity
      uint256 maxLoanSizeStable = vars.availableLiquidity.percentMul(maxStableLoanPercent);

      require(amount <= maxLoanSizeStable, AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE);
    }
  }

  /**
   * @dev validates a repay.
   * @param reserve the reserve state from which the user is repaying
   * @param amountSent the amount sent for the repayment. Can be an actual value or uint(-1)
   * @param onBehalfOf the address of the user msg.sender is repaying for
   * @param stableDebt the borrow balance of the user
   * @param variableDebt the borrow balance of the user
   */
  function validateRepay(
    ReserveLogic.ReserveData storage reserve,
    uint256 amountSent,
    ReserveLogic.InterestRateMode rateMode,
    address onBehalfOf,
    uint256 stableDebt,
    uint256 variableDebt
  ) external view {
    bool isActive = reserve.configuration.getActive();

    require(isActive, NO_ACTIVE_RESERVE);

    require(amountSent > 0, AMOUNT_NOT_GREATER_THAN_0);

    require(
      (stableDebt > 0 &&
        ReserveLogic.InterestRateMode(rateMode) == ReserveLogic.InterestRateMode.STABLE) ||
        (variableDebt > 0 &&
          ReserveLogic.InterestRateMode(rateMode) == ReserveLogic.InterestRateMode.VARIABLE),
      NO_DEBT_OF_SELECTED_TYPE
    );

    require(
      amountSent != uint256(-1) || msg.sender == onBehalfOf,
      NO_EPLICIT_AMOUNT_TO_REPAY_ON_BEHALF
    );
  }

  /**
   * @dev validates a swap of borrow rate mode.
   * @param reserve the reserve state on which the user is swapping the rate
   * @param userConfig the user reserves configuration
   * @param stableBorrowBalance the stable borrow balance of the user
   * @param variableBorrowBalance the stable borrow balance of the user
   * @param currentRateMode the rate mode of the borrow
   */
  function validateSwapRateMode(
    ReserveLogic.ReserveData storage reserve,
    UserConfiguration.Map storage userConfig,
    uint256 stableBorrowBalance,
    uint256 variableBorrowBalance,
    ReserveLogic.InterestRateMode currentRateMode
  ) external view {
    (bool isActive, bool isFreezed, , bool stableRateEnabled) = reserve.configuration.getFlags();

    require(isActive, NO_ACTIVE_RESERVE);
    require(!isFreezed, NO_UNFREEZED_RESERVE);

    if (currentRateMode == ReserveLogic.InterestRateMode.STABLE) {
      require(stableBorrowBalance > 0, NO_STABLE_RATE_LOAN_IN_RESERVE);
    } else if (currentRateMode == ReserveLogic.InterestRateMode.VARIABLE) {
      require(variableBorrowBalance > 0, NO_VARIABLE_RATE_LOAN_IN_RESERVE);
      /**
       * user wants to swap to stable, before swapping we need to ensure that
       * 1. stable borrow rate is enabled on the reserve
       * 2. user is not trying to abuse the reserve by depositing
       * more collateral than he is borrowing, artificially lowering
       * the interest rate, borrowing at variable, and switching to stable
       **/
      require(stableRateEnabled, STABLE_BORROWING_NOT_ENABLED);

      require(
        !userConfig.isUsingAsCollateral(reserve.index) ||
          reserve.configuration.getLtv() == 0 ||
          stableBorrowBalance.add(variableBorrowBalance) >
          IERC20(reserve.aTokenAddress).balanceOf(msg.sender),
        CALLATERAL_SAME_AS_BORROWING_CURRENCY
      );
    } else {
      revert(INVALID_INTERESTRATE_MODE_SELECTED);
    }
  }

  /**
   * @dev validates the choice of a user of setting (or not) an asset as collateral
   * @param reserve the state of the reserve that the user is enabling or disabling as collateral
   * @param reserveAddress the address of the reserve
   * @param reservesData the data of all the reserves
   * @param userConfig the state of the user for the specific reserve
   * @param reserves the addresses of all the active reserves
   * @param oracle the price oracle
   */
  function validateSetUseReserveAsCollateral(
    ReserveLogic.ReserveData storage reserve,
    address reserveAddress,
    mapping(address => ReserveLogic.ReserveData) storage reservesData,
    UserConfiguration.Map storage userConfig,
    address[] calldata reserves,
    address oracle
  ) external view {
    uint256 underlyingBalance = IERC20(reserve.aTokenAddress).balanceOf(msg.sender);

    require(underlyingBalance > 0, UNDERLYING_BALANCE_NOT_GREATER_THAN_0);

    require(
      GenericLogic.balanceDecreaseAllowed(
        reserveAddress,
        msg.sender,
        underlyingBalance,
        reservesData,
        userConfig,
        reserves,
        oracle
      ),
      DEPOSIT_ALREADY_IN_USE
    );
  }
}
