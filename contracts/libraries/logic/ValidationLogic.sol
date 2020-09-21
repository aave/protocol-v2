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
import {Errors} from '../helpers/Errors.sol';
import {Helpers} from '../helpers/Helpers.sol';

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

  /**
   * @dev validates a deposit.
   * @param reserve the reserve state on which the user is depositing
   * @param amount the amount to be deposited
   */
  function validateDeposit(ReserveLogic.ReserveData storage reserve, uint256 amount) external view {
    (bool isActive, bool isFreezed, , ) = reserve.configuration.getFlags();

    require(amount > 0, Errors.AMOUNT_NOT_GREATER_THAN_0);
    require(isActive, Errors.NO_ACTIVE_RESERVE);
    require(!isFreezed, Errors.NO_UNFREEZED_RESERVE);
  }

  /**
   * @dev validates a withdraw action.
   * @param reserveAddress the address of the reserve
   * @param amount the amount to be withdrawn
   * @param userBalance the balance of the user
   */
  function validateWithdraw(
    address reserveAddress,
    uint256 amount,
    uint256 userBalance,
    mapping(address => ReserveLogic.ReserveData) storage reservesData,
    UserConfiguration.Map storage userConfig,
    address[] calldata reserves,
    address oracle
  ) external view {
    require(amount > 0, Errors.AMOUNT_NOT_GREATER_THAN_0);

    require(amount <= userBalance, Errors.NOT_ENOUGH_AVAILABLE_USER_BALANCE);

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
      Errors.TRANSFER_NOT_ALLOWED
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
   * @param userAddress the address of the user
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
    address userAddress,
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

    require(vars.isActive, Errors.NO_ACTIVE_RESERVE);
    require(!vars.isFreezed, Errors.NO_UNFREEZED_RESERVE);

    require(vars.borrowingEnabled, Errors.BORROWING_NOT_ENABLED);

    //validate interest rate mode
    require(
      uint256(ReserveLogic.InterestRateMode.VARIABLE) == interestRateMode ||
        uint256(ReserveLogic.InterestRateMode.STABLE) == interestRateMode,
      Errors.INVALID_INTEREST_RATE_MODE_SELECTED
    );

    (
      vars.userCollateralBalanceETH,
      vars.userBorrowBalanceETH,
      vars.currentLtv,
      vars.currentLiquidationThreshold,
      vars.healthFactor
    ) = GenericLogic.calculateUserAccountData(
      userAddress,
      reservesData,
      userConfig,
      reserves,
      oracle
    );

    require(vars.userCollateralBalanceETH > 0, Errors.COLLATERAL_BALANCE_IS_0);

    require(
      vars.healthFactor > GenericLogic.HEALTH_FACTOR_LIQUIDATION_THRESHOLD,
      Errors.HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD
    );

    //add the current already borrowed amount to the amount requested to calculate the total collateral needed.
    vars.amountOfCollateralNeededETH = vars.userBorrowBalanceETH.add(amountInETH).percentDiv(
      vars.currentLtv
    ); //LTV is calculated in percentage

    require(
      vars.amountOfCollateralNeededETH <= vars.userCollateralBalanceETH,
      Errors.COLLATERAL_CANNOT_COVER_NEW_BORROW
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

      require(vars.stableRateBorrowingEnabled, Errors.STABLE_BORROWING_NOT_ENABLED);

      require(
        !userConfig.isUsingAsCollateral(reserve.id) ||
          reserve.configuration.getLtv() == 0 ||
          amount > IERC20(reserve.aTokenAddress).balanceOf(userAddress),
        Errors.CALLATERAL_SAME_AS_BORROWING_CURRENCY
      );

      //calculate the max available loan size in stable rate mode as a percentage of the
      //available liquidity
      uint256 maxLoanSizeStable = vars.availableLiquidity.percentMul(maxStableLoanPercent);

      require(amount <= maxLoanSizeStable, Errors.AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE);
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

    require(isActive, Errors.NO_ACTIVE_RESERVE);

    require(amountSent > 0, Errors.AMOUNT_NOT_GREATER_THAN_0);

    require(
      (stableDebt > 0 &&
        ReserveLogic.InterestRateMode(rateMode) == ReserveLogic.InterestRateMode.STABLE) ||
        (variableDebt > 0 &&
          ReserveLogic.InterestRateMode(rateMode) == ReserveLogic.InterestRateMode.VARIABLE),
      Errors.NO_DEBT_OF_SELECTED_TYPE
    );

    require(
      amountSent != uint256(-1) || msg.sender == onBehalfOf,
      Errors.NO_EXPLICIT_AMOUNT_TO_REPAY_ON_BEHALF
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

    require(isActive, Errors.NO_ACTIVE_RESERVE);
    require(!isFreezed, Errors.NO_UNFREEZED_RESERVE);

    if (currentRateMode == ReserveLogic.InterestRateMode.STABLE) {
      require(stableBorrowBalance > 0, Errors.NO_STABLE_RATE_LOAN_IN_RESERVE);
    } else if (currentRateMode == ReserveLogic.InterestRateMode.VARIABLE) {
      require(variableBorrowBalance > 0, Errors.NO_VARIABLE_RATE_LOAN_IN_RESERVE);
      /**
       * user wants to swap to stable, before swapping we need to ensure that
       * 1. stable borrow rate is enabled on the reserve
       * 2. user is not trying to abuse the reserve by depositing
       * more collateral than he is borrowing, artificially lowering
       * the interest rate, borrowing at variable, and switching to stable
       **/
      require(stableRateEnabled, Errors.STABLE_BORROWING_NOT_ENABLED);

      require(
        !userConfig.isUsingAsCollateral(reserve.id) ||
          reserve.configuration.getLtv() == 0 ||
          stableBorrowBalance.add(variableBorrowBalance) >
          IERC20(reserve.aTokenAddress).balanceOf(msg.sender),
        Errors.CALLATERAL_SAME_AS_BORROWING_CURRENCY
      );
    } else {
      revert(Errors.INVALID_INTEREST_RATE_MODE_SELECTED);
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

    require(underlyingBalance > 0, Errors.UNDERLYING_BALANCE_NOT_GREATER_THAN_0);

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
      Errors.DEPOSIT_ALREADY_IN_USE
    );
  }

  /**
   * @dev validates a flashloan action
   * @param mode the flashloan mode (0 = classic flashloan, 1 = open a stable rate loan, 2 = open a variable rate loan)
   * @param premium the premium paid on the flashloan
   **/
  function validateFlashloan(uint256 mode, uint256 premium) internal pure {
    require(premium > 0, Errors.REQUESTED_AMOUNT_TOO_SMALL);
    require(mode <= uint256(ReserveLogic.InterestRateMode.VARIABLE), Errors.INVALID_FLASHLOAN_MODE);
  }

  /**
   * @dev Validates the liquidationCall() action
   * @param collateralReserve The reserve data of the collateral
   * @param principalReserve The reserve data of the principal
   * @param userConfig The user configuration
   * @param userHealthFactor The user's health factor
   * @param userStableDebt Total stable debt balance of the user
   * @param userVariableDebt Total variable debt balance of the user
   **/
  function validateLiquidationCall(
    ReserveLogic.ReserveData storage collateralReserve,
    ReserveLogic.ReserveData storage principalReserve,
    UserConfiguration.Map storage userConfig,
    uint256 userHealthFactor,
    uint256 userStableDebt,
    uint256 userVariableDebt
  ) internal view returns (uint256, string memory) {
    if (
      !collateralReserve.configuration.getActive() || !principalReserve.configuration.getActive()
    ) {
      return (uint256(Errors.CollateralManagerErrors.NO_ACTIVE_RESERVE), Errors.NO_ACTIVE_RESERVE);
    }

    if (userHealthFactor >= GenericLogic.HEALTH_FACTOR_LIQUIDATION_THRESHOLD) {
      return (
        uint256(Errors.CollateralManagerErrors.HEALTH_FACTOR_ABOVE_THRESHOLD),
        Errors.HEALTH_FACTOR_NOT_BELOW_THRESHOLD
      );
    }

    bool isCollateralEnabled = collateralReserve.configuration.getLiquidationThreshold() > 0 &&
      userConfig.isUsingAsCollateral(collateralReserve.id);

    //if collateral isn't enabled as collateral by user, it cannot be liquidated
    if (!isCollateralEnabled) {
      return (
        uint256(Errors.CollateralManagerErrors.COLLATERAL_CANNOT_BE_LIQUIDATED),
        Errors.COLLATERAL_CANNOT_BE_LIQUIDATED
      );
    }

    if (userStableDebt == 0 && userVariableDebt == 0) {
      return (
        uint256(Errors.CollateralManagerErrors.CURRRENCY_NOT_BORROWED),
        Errors.SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER
      );
    }

    return (uint256(Errors.CollateralManagerErrors.NO_ERROR), Errors.NO_ERRORS);
  }

  /**
   * @dev Validates the repayWithCollateral() action
   * @param collateralReserve The reserve data of the collateral
   * @param principalReserve The reserve data of the principal
   * @param userConfig The user configuration
   * @param user The address of the user
   * @param userHealthFactor The user's health factor
   * @param userStableDebt Total stable debt balance of the user
   * @param userVariableDebt Total variable debt balance of the user
   **/
  function validateRepayWithCollateral(
    ReserveLogic.ReserveData storage collateralReserve,
    ReserveLogic.ReserveData storage principalReserve,
    UserConfiguration.Map storage userConfig,
    address user,
    uint256 userHealthFactor,
    uint256 userStableDebt,
    uint256 userVariableDebt
  ) internal view returns (uint256, string memory) {
    if (
      !collateralReserve.configuration.getActive() || !principalReserve.configuration.getActive()
    ) {
      return (uint256(Errors.CollateralManagerErrors.NO_ACTIVE_RESERVE), Errors.NO_ACTIVE_RESERVE);
    }

    if (
      msg.sender != user && userHealthFactor >= GenericLogic.HEALTH_FACTOR_LIQUIDATION_THRESHOLD
    ) {
      return (
        uint256(Errors.CollateralManagerErrors.HEALTH_FACTOR_ABOVE_THRESHOLD),
        Errors.HEALTH_FACTOR_NOT_BELOW_THRESHOLD
      );
    }

    if (msg.sender != user) {
      bool isCollateralEnabled = collateralReserve.configuration.getLiquidationThreshold() > 0 &&
        userConfig.isUsingAsCollateral(collateralReserve.id);

      //if collateral isn't enabled as collateral by user, it cannot be liquidated
      if (!isCollateralEnabled) {
        return (
          uint256(Errors.CollateralManagerErrors.COLLATERAL_CANNOT_BE_LIQUIDATED),
          Errors.COLLATERAL_CANNOT_BE_LIQUIDATED
        );
      }
    }

    if (userStableDebt == 0 && userVariableDebt == 0) {
      return (
        uint256(Errors.CollateralManagerErrors.CURRRENCY_NOT_BORROWED),
        Errors.SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER
      );
    }

    return (uint256(Errors.CollateralManagerErrors.NO_ERROR), Errors.NO_ERRORS);
  }

  /**
   * @dev Validates the swapLiquidity() action
   * @param fromReserve The reserve data of the asset to swap from
   * @param toReserve The reserve data of the asset to swap to
   * @param fromAsset Address of the asset to swap from
   * @param toAsset Address of the asset to swap to
   **/
  function validateSwapLiquidity(
    ReserveLogic.ReserveData storage fromReserve,
    ReserveLogic.ReserveData storage toReserve,
    address fromAsset,
    address toAsset
  ) internal view returns (uint256, string memory) {
    if (fromAsset == toAsset) {
      return (
        uint256(Errors.CollateralManagerErrors.INVALID_EQUAL_ASSETS_TO_SWAP),
        Errors.INVALID_EQUAL_ASSETS_TO_SWAP
      );
    }

    (bool isToActive, bool isToFreezed, , ) = toReserve.configuration.getFlags();
    if (!fromReserve.configuration.getActive() || !isToActive) {
      return (uint256(Errors.CollateralManagerErrors.NO_ACTIVE_RESERVE), Errors.NO_ACTIVE_RESERVE);
    }
    if (isToFreezed) {
      return (
        uint256(Errors.CollateralManagerErrors.NO_UNFREEZED_RESERVE),
        Errors.NO_UNFREEZED_RESERVE
      );
    }

    return (uint256(Errors.CollateralManagerErrors.NO_ERROR), Errors.NO_ERRORS);
  }
}
