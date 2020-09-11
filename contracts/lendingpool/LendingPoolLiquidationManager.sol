// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  VersionedInitializable
} from '../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';
import {LendingPoolAddressesProvider} from '../configuration/LendingPoolAddressesProvider.sol';
import {IAToken} from '../tokenization/interfaces/IAToken.sol';
import {IStableDebtToken} from '../tokenization/interfaces/IStableDebtToken.sol';
import {IVariableDebtToken} from '../tokenization/interfaces/IVariableDebtToken.sol';
import {IPriceOracleGetter} from '../interfaces/IPriceOracleGetter.sol';
import {GenericLogic} from '../libraries/logic/GenericLogic.sol';
import {ReserveLogic} from '../libraries/logic/ReserveLogic.sol';
import {ReserveConfiguration} from '../libraries/configuration/ReserveConfiguration.sol';
import {UserConfiguration} from '../libraries/configuration/UserConfiguration.sol';
import {Helpers} from '../libraries/helpers/Helpers.sol';
import {WadRayMath} from '../libraries/math/WadRayMath.sol';
import {PercentageMath} from '../libraries/math/PercentageMath.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {ISwapAdapter} from '../interfaces/ISwapAdapter.sol';
import {Errors} from '../libraries/helpers/Errors.sol';

/**
 * @title LendingPoolLiquidationManager contract
 * @author Aave
 * @notice Implements the liquidation function.
 **/
contract LendingPoolLiquidationManager is VersionedInitializable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using ReserveLogic for ReserveLogic.ReserveData;
  using ReserveConfiguration for ReserveConfiguration.Map;
  using UserConfiguration for UserConfiguration.Map;

  // IMPORTANT The storage layout of the LendingPool is reproduced here because this contract
  // is gonna be used through DELEGATECALL

  LendingPoolAddressesProvider internal addressesProvider;

  mapping(address => ReserveLogic.ReserveData) internal reserves;
  mapping(address => UserConfiguration.Map) internal usersConfig;
  mapping(address => mapping(address => mapping(address => uint256))) internal _borrowAllowance;

  address[] internal reservesList;

  bool internal _flashLiquidationLocked;

  uint256 internal constant LIQUIDATION_CLOSE_FACTOR_PERCENT = 5000;

  /**
   * @dev emitted when a borrower is liquidated
   * @param collateral the address of the collateral being liquidated
   * @param principal the address of the reserve
   * @param user the address of the user being liquidated
   * @param purchaseAmount the total amount liquidated
   * @param liquidatedCollateralAmount the amount of collateral being liquidated
   * @param liquidator the address of the liquidator
   * @param receiveAToken true if the liquidator wants to receive aTokens, false otherwise
   **/
  event LiquidationCall(
    address indexed collateral,
    address indexed principal,
    address indexed user,
    uint256 purchaseAmount,
    uint256 liquidatedCollateralAmount,
    address liquidator,
    bool receiveAToken
  );

  /**
    @dev emitted when a borrower/liquidator repays with the borrower's collateral
    @param collateral the address of the collateral being swapped to repay
    @param principal the address of the reserve of the debt
    @param user the borrower's address
    @param liquidator the address of the liquidator, same as the one of the borrower on self-repayment
    @param principalAmount the amount of the debt finally covered
    @param swappedCollateralAmount the amount of collateral finally swapped
  */
  event RepaidWithCollateral(
    address indexed collateral,
    address indexed principal,
    address indexed user,
    address liquidator,
    uint256 principalAmount,
    uint256 swappedCollateralAmount
  );

  enum LiquidationErrors {
    NO_ERROR,
    NO_COLLATERAL_AVAILABLE,
    COLLATERAL_CANNOT_BE_LIQUIDATED,
    CURRRENCY_NOT_BORROWED,
    HEALTH_FACTOR_ABOVE_THRESHOLD,
    NOT_ENOUGH_LIQUIDITY
  }

  struct LiquidationCallLocalVars {
    uint256 userCollateralBalance;
    uint256 userStableDebt;
    uint256 userVariableDebt;
    uint256 maxPrincipalAmountToLiquidate;
    uint256 actualAmountToLiquidate;
    uint256 liquidationRatio;
    uint256 maxAmountCollateralToLiquidate;
    ReserveLogic.InterestRateMode borrowRateMode;
    uint256 userStableRate;
    uint256 maxCollateralToLiquidate;
    uint256 principalAmountNeeded;
    uint256 healthFactor;
    IAToken collateralAtoken;
    bool isCollateralEnabled;
  }

  /**
   * @dev as the contract extends the VersionedInitializable contract to match the state
   * of the LendingPool contract, the getRevision() function is needed.
   */
  function getRevision() internal override pure returns (uint256) {
    return 0;
  }

  /**
   * @dev users can invoke this function to liquidate an undercollateralized position.
   * @param collateral the address of the collateral to liquidated
   * @param principal the address of the principal reserve
   * @param user the address of the borrower
   * @param purchaseAmount the amount of principal that the liquidator wants to repay
   * @param receiveAToken true if the liquidators wants to receive the aTokens, false if
   * he wants to receive the underlying asset directly
   **/
  function liquidationCall(
    address collateral,
    address principal,
    address user,
    uint256 purchaseAmount,
    bool receiveAToken
  ) external returns (uint256, string memory) {
    ReserveLogic.ReserveData storage principalReserve = reserves[principal];
    ReserveLogic.ReserveData storage collateralReserve = reserves[collateral];
    UserConfiguration.Map storage userConfig = usersConfig[user];

    LiquidationCallLocalVars memory vars;

    (, , , , vars.healthFactor) = GenericLogic.calculateUserAccountData(
      user,
      reserves,
      usersConfig[user],
      reservesList,
      addressesProvider.getPriceOracle()
    );

    if (vars.healthFactor >= GenericLogic.HEALTH_FACTOR_LIQUIDATION_THRESHOLD) {
      return (
        uint256(LiquidationErrors.HEALTH_FACTOR_ABOVE_THRESHOLD),
        Errors.HEALTH_FACTOR_NOT_BELOW_THRESHOLD
      );
    }

    vars.collateralAtoken = IAToken(collateralReserve.aTokenAddress);

    vars.userCollateralBalance = vars.collateralAtoken.balanceOf(user);

    vars.isCollateralEnabled =
      collateralReserve.configuration.getLiquidationThreshold() > 0 &&
      userConfig.isUsingAsCollateral(collateralReserve.index);

    //if collateral isn't enabled as collateral by user, it cannot be liquidated
    if (!vars.isCollateralEnabled) {
      return (
        uint256(LiquidationErrors.COLLATERAL_CANNOT_BE_LIQUIDATED),
        Errors.COLLATERAL_CANNOT_BE_LIQUIDATED
      );
    }

    //if the user hasn't borrowed the specific currency defined by asset, it cannot be liquidated
    (vars.userStableDebt, vars.userVariableDebt) = Helpers.getUserCurrentDebt(
      user,
      principalReserve
    );

    if (vars.userStableDebt == 0 && vars.userVariableDebt == 0) {
      return (
        uint256(LiquidationErrors.CURRRENCY_NOT_BORROWED),
        Errors.SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER
      );
    }

    //all clear - calculate the max principal amount that can be liquidated
    vars.maxPrincipalAmountToLiquidate = vars.userStableDebt.add(vars.userVariableDebt).percentMul(
      LIQUIDATION_CLOSE_FACTOR_PERCENT
    );

    vars.actualAmountToLiquidate = purchaseAmount > vars.maxPrincipalAmountToLiquidate
      ? vars.maxPrincipalAmountToLiquidate
      : purchaseAmount;

    (
      vars.maxCollateralToLiquidate,
      vars.principalAmountNeeded
    ) = calculateAvailableCollateralToLiquidate(
      collateralReserve,
      principalReserve,
      collateral,
      principal,
      vars.actualAmountToLiquidate,
      vars.userCollateralBalance
    );

    //if principalAmountNeeded < vars.ActualAmountToLiquidate, there isn't enough
    //of collateral to cover the actual amount that is being liquidated, hence we liquidate
    //a smaller amount

    if (vars.principalAmountNeeded < vars.actualAmountToLiquidate) {
      vars.actualAmountToLiquidate = vars.principalAmountNeeded;
    }

    //if liquidator reclaims the underlying asset, we make sure there is enough available collateral in the reserve
    if (!receiveAToken) {
      uint256 currentAvailableCollateral = IERC20(collateral).balanceOf(
        address(vars.collateralAtoken)
      );
      if (currentAvailableCollateral < vars.maxCollateralToLiquidate) {
        return (
          uint256(LiquidationErrors.NOT_ENOUGH_LIQUIDITY),
          Errors.NOT_ENOUGH_LIQUIDITY_TO_LIQUIDATE
        );
      }
    }

    //update the principal reserve
    principalReserve.updateCumulativeIndexesAndTimestamp();
    principalReserve.updateInterestRates(
      principal,
      principalReserve.aTokenAddress,
      vars.actualAmountToLiquidate,
      0
    );

    if (vars.userVariableDebt >= vars.actualAmountToLiquidate) {
      IVariableDebtToken(principalReserve.variableDebtTokenAddress).burn(
        user,
        vars.actualAmountToLiquidate
      );
    } else {
      IVariableDebtToken(principalReserve.variableDebtTokenAddress).burn(
        user,
        vars.userVariableDebt
      );
      IStableDebtToken(principalReserve.stableDebtTokenAddress).burn(
        user,
        vars.actualAmountToLiquidate.sub(vars.userVariableDebt)
      );
    }

    //if liquidator reclaims the aToken, he receives the equivalent atoken amount
    if (receiveAToken) {
      vars.collateralAtoken.transferOnLiquidation(user, msg.sender, vars.maxCollateralToLiquidate);
    } else {
      //otherwise receives the underlying asset

      //updating collateral reserve
      collateralReserve.updateCumulativeIndexesAndTimestamp();
      collateralReserve.updateInterestRates(
        collateral,
        address(vars.collateralAtoken),
        0,
        vars.maxCollateralToLiquidate
      );

      //burn the equivalent amount of atoken
      vars.collateralAtoken.burn(user, msg.sender, vars.maxCollateralToLiquidate);
    }

    //transfers the principal currency to the aToken
    IERC20(principal).safeTransferFrom(
      msg.sender,
      principalReserve.aTokenAddress,
      vars.actualAmountToLiquidate
    );

    emit LiquidationCall(
      collateral,
      principal,
      user,
      vars.actualAmountToLiquidate,
      vars.maxCollateralToLiquidate,
      msg.sender,
      receiveAToken
    );

    return (uint256(LiquidationErrors.NO_ERROR), Errors.NO_ERRORS);
  }

  /**
   * @dev flashes the underlying collateral on an user to swap for the owed asset and repay
   * - Both the owner of the position and other liquidators can execute it.
   * - The owner can repay with his collateral at any point, no matter the health factor.
   * - Other liquidators can only use this function below 1 HF. To liquidate 50% of the debt > HF 0.98 or the whole below.
   * @param collateral The address of the collateral asset.
   * @param principal The address of the owed asset.
   * @param user Address of the borrower.
   * @param principalAmount Amount of the debt to repay.
   * @param receiver Address of the contract receiving the collateral to swap.
   * @param params Variadic bytes param to pass with extra information to the receiver
   **/
  function repayWithCollateral(
    address collateral,
    address principal,
    address user,
    uint256 principalAmount,
    address receiver,
    bytes calldata params
  ) external returns (uint256, string memory) {
    ReserveLogic.ReserveData storage debtReserve = reserves[principal];
    ReserveLogic.ReserveData storage collateralReserve = reserves[collateral];

    UserConfiguration.Map storage userConfig = usersConfig[user];

    LiquidationCallLocalVars memory vars;

    (, , , , vars.healthFactor) = GenericLogic.calculateUserAccountData(
      user,
      reserves,
      usersConfig[user],
      reservesList,
      addressesProvider.getPriceOracle()
    );

    if (
      msg.sender != user && vars.healthFactor >= GenericLogic.HEALTH_FACTOR_LIQUIDATION_THRESHOLD
    ) {
      return (
        uint256(LiquidationErrors.HEALTH_FACTOR_ABOVE_THRESHOLD),
        Errors.HEALTH_FACTOR_NOT_BELOW_THRESHOLD
      );
    }

    if (msg.sender != user) {
      vars.isCollateralEnabled =
        collateralReserve.configuration.getLiquidationThreshold() > 0 &&
        userConfig.isUsingAsCollateral(collateralReserve.index);

      //if collateral isn't enabled as collateral by user, it cannot be liquidated
      if (!vars.isCollateralEnabled) {
        return (
          uint256(LiquidationErrors.COLLATERAL_CANNOT_BE_LIQUIDATED),
          Errors.COLLATERAL_CANNOT_BE_LIQUIDATED
        );
      }
    }

    (vars.userStableDebt, vars.userVariableDebt) = Helpers.getUserCurrentDebt(user, debtReserve);

    if (vars.userStableDebt == 0 && vars.userVariableDebt == 0) {
      return (
        uint256(LiquidationErrors.CURRRENCY_NOT_BORROWED),
        Errors.SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER
      );
    }

    vars.maxPrincipalAmountToLiquidate = vars.userStableDebt.add(vars.userVariableDebt);

    vars.actualAmountToLiquidate = principalAmount > vars.maxPrincipalAmountToLiquidate
      ? vars.maxPrincipalAmountToLiquidate
      : principalAmount;

    vars.collateralAtoken = IAToken(collateralReserve.aTokenAddress);
    vars.userCollateralBalance = vars.collateralAtoken.balanceOf(user);

    (
      vars.maxCollateralToLiquidate,
      vars.principalAmountNeeded
    ) = calculateAvailableCollateralToLiquidate(
      collateralReserve,
      debtReserve,
      collateral,
      principal,
      vars.actualAmountToLiquidate,
      vars.userCollateralBalance
    );

    //if principalAmountNeeded < vars.ActualAmountToLiquidate, there isn't enough
    //of collateral to cover the actual amount that is being liquidated, hence we liquidate
    //a smaller amount
    if (vars.principalAmountNeeded < vars.actualAmountToLiquidate) {
      vars.actualAmountToLiquidate = vars.principalAmountNeeded;
    }

    vars.collateralAtoken.burn(user, receiver, vars.maxCollateralToLiquidate);

    if (vars.userCollateralBalance == vars.maxCollateralToLiquidate) {
      usersConfig[user].setUsingAsCollateral(collateralReserve.index, false);
    }

    address principalAToken = debtReserve.aTokenAddress;

    // Notifies the receiver to proceed, sending as param the underlying already transferred
    ISwapAdapter(receiver).executeOperation(
      collateral,
      principal,
      vars.maxCollateralToLiquidate,
      address(this),
      params
    );

    //updating debt reserve
    debtReserve.updateCumulativeIndexesAndTimestamp();
    debtReserve.updateInterestRates(principal, principalAToken, vars.actualAmountToLiquidate, 0);
    IERC20(principal).transferFrom(receiver, principalAToken, vars.actualAmountToLiquidate);

    if (vars.userVariableDebt >= vars.actualAmountToLiquidate) {
      IVariableDebtToken(debtReserve.variableDebtTokenAddress).burn(
        user,
        vars.actualAmountToLiquidate
      );
    } else {
      IVariableDebtToken(debtReserve.variableDebtTokenAddress).burn(user, vars.userVariableDebt);
      IStableDebtToken(debtReserve.stableDebtTokenAddress).burn(
        user,
        vars.actualAmountToLiquidate.sub(vars.userVariableDebt)
      );
    }

    //updating collateral reserve
    collateralReserve.updateCumulativeIndexesAndTimestamp();
    collateralReserve.updateInterestRates(
      collateral,
      address(vars.collateralAtoken),
      0,
      vars.maxCollateralToLiquidate
    );

    emit RepaidWithCollateral(
      collateral,
      principal,
      user,
      msg.sender,
      vars.actualAmountToLiquidate,
      vars.maxCollateralToLiquidate
    );

    return (uint256(LiquidationErrors.NO_ERROR), Errors.NO_ERRORS);
  }

  struct AvailableCollateralToLiquidateLocalVars {
    uint256 userCompoundedBorrowBalance;
    uint256 liquidationBonus;
    uint256 collateralPrice;
    uint256 principalCurrencyPrice;
    uint256 maxAmountCollateralToLiquidate;
    uint256 principalDecimals;
    uint256 collateralDecimals;
  }

  /**
   * @dev calculates how much of a specific collateral can be liquidated, given
   * a certain amount of principal currency. This function needs to be called after
   * all the checks to validate the liquidation have been performed, otherwise it might fail.
   * @param collateralAddress the collateral to be liquidated
   * @param principalAddress the principal currency to be liquidated
   * @param purchaseAmount the amount of principal being liquidated
   * @param userCollateralBalance the collatera balance for the specific collateral asset of the user being liquidated
   * @return collateralAmount the maximum amount that is possible to liquidated given all the liquidation constraints (user balance, close factor)
   * @return principalAmountNeeded the purchase amount
   **/
  function calculateAvailableCollateralToLiquidate(
    ReserveLogic.ReserveData storage collateralReserve,
    ReserveLogic.ReserveData storage principalReserve,
    address collateralAddress,
    address principalAddress,
    uint256 purchaseAmount,
    uint256 userCollateralBalance
  ) internal view returns (uint256, uint256) {
    uint256 collateralAmount = 0;
    uint256 principalAmountNeeded = 0;
    IPriceOracleGetter oracle = IPriceOracleGetter(addressesProvider.getPriceOracle());

    // Usage of a memory struct of vars to avoid "Stack too deep" errors due to local variables
    AvailableCollateralToLiquidateLocalVars memory vars;

    vars.collateralPrice = oracle.getAssetPrice(collateralAddress);
    vars.principalCurrencyPrice = oracle.getAssetPrice(principalAddress);

    (, , vars.liquidationBonus, vars.collateralDecimals) = collateralReserve
      .configuration
      .getParams();
    vars.principalDecimals = principalReserve.configuration.getDecimals();

    //this is the maximum possible amount of the selected collateral that can be liquidated, given the
    //max amount of principal currency that is available for liquidation.
    vars.maxAmountCollateralToLiquidate = vars
      .principalCurrencyPrice
      .mul(purchaseAmount)
      .mul(10**vars.collateralDecimals)
      .div(vars.collateralPrice.mul(10**vars.principalDecimals))
      .percentMul(vars.liquidationBonus);

    if (vars.maxAmountCollateralToLiquidate > userCollateralBalance) {
      collateralAmount = userCollateralBalance;
      principalAmountNeeded = vars
        .collateralPrice
        .mul(collateralAmount)
        .mul(10**vars.principalDecimals)
        .div(vars.principalCurrencyPrice.mul(10**vars.collateralDecimals))
        .percentDiv(vars.liquidationBonus);
    } else {
      collateralAmount = vars.maxAmountCollateralToLiquidate;
      principalAmountNeeded = purchaseAmount;
    }
    return (collateralAmount, principalAmountNeeded);
  }
}
