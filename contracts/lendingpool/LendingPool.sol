// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  VersionedInitializable
} from '../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IAToken} from '../tokenization/interfaces/IAToken.sol';
import {Helpers} from '../libraries/helpers/Helpers.sol';
import {Errors} from '../libraries/helpers/Errors.sol';
import {WadRayMath} from '../libraries/math/WadRayMath.sol';
import {PercentageMath} from '../libraries/math/PercentageMath.sol';
import {ReserveLogic} from '../libraries/logic/ReserveLogic.sol';
import {GenericLogic} from '../libraries/logic/GenericLogic.sol';
import {ValidationLogic} from '../libraries/logic/ValidationLogic.sol';
import {ReserveConfiguration} from '../libraries/configuration/ReserveConfiguration.sol';
import {UserConfiguration} from '../libraries/configuration/UserConfiguration.sol';
import {IStableDebtToken} from '../tokenization/interfaces/IStableDebtToken.sol';
import {IVariableDebtToken} from '../tokenization/interfaces/IVariableDebtToken.sol';
import {DebtTokenBase} from '../tokenization/base/DebtTokenBase.sol';
import {IFlashLoanReceiver} from '../flashloan/interfaces/IFlashLoanReceiver.sol';
import {ISwapAdapter} from '../interfaces/ISwapAdapter.sol';
import {LendingPoolLiquidationManager} from './LendingPoolLiquidationManager.sol';
import {IPriceOracleGetter} from '../interfaces/IPriceOracleGetter.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';

/**
 * @title LendingPool contract
 * @notice Implements the actions of the LendingPool, and exposes accessory methods to fetch the users and reserve data
 * @author Aave
 **/

contract LendingPool is VersionedInitializable, ILendingPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using ReserveLogic for ReserveLogic.ReserveData;
  using ReserveConfiguration for ReserveConfiguration.Map;
  using UserConfiguration for UserConfiguration.Map;
  using SafeERC20 for IERC20;

  //main configuration parameters
  uint256 public constant REBALANCE_DOWN_RATE_DELTA = (1e27) / 5;
  uint256 public constant MAX_STABLE_RATE_BORROW_SIZE_PERCENT = 25;
  uint256 public constant FLASHLOAN_PREMIUM_TOTAL = 9;
  uint256 public constant UINT_MAX_VALUE = uint256(-1);
  uint256 public constant LENDINGPOOL_REVISION = 0x2;

  mapping(address => ReserveLogic.ReserveData) internal _reserves;
  mapping(address => UserConfiguration.Map) internal _usersConfig;
  ILendingPoolAddressesProvider internal _addressesProvider;
  // debt token address => user who gives allowance => user who receives allowance => amount
  mapping(address => mapping(address => mapping(address => uint256))) internal _borrowAllowance;

  address[] internal _reservesList;

  bool internal _flashLiquidationLocked;

  /**
   * @dev only lending pools configurator can use functions affected by this modifier
   **/
  function onlyLendingPoolConfigurator() internal view {
    require(
      _addressesProvider.getLendingPoolConfigurator() == msg.sender,
      Errors.CALLER_NOT_LENDING_POOL_CONFIGURATOR
    );
  }

  function getRevision() internal override pure returns (uint256) {
    return LENDINGPOOL_REVISION;
  }

  /**
   * @dev this function is invoked by the proxy contract when the LendingPool contract is added to the
   * AddressesProvider.
   * @param provider the address of the LendingPoolAddressesProvider registry
   **/
  function initialize(ILendingPoolAddressesProvider provider) public initializer {
    _addressesProvider = provider;
  }

  /**
   * @dev deposits The underlying asset into the reserve. A corresponding amount of the overlying asset (aTokens)
   * is minted.
   * @param asset the address of the reserve
   * @param amount the amount to be deposited
   * @param referralCode integrators are assigned a referral code and can potentially receive rewards.
   **/
  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  ) external override {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    ValidationLogic.validateDeposit(reserve, amount);

    address aToken = reserve.aTokenAddress;

    reserve.updateState();
    reserve.updateInterestRates(asset, aToken, amount, 0);

    bool isFirstDeposit = IAToken(aToken).balanceOf(onBehalfOf) == 0;
    if (isFirstDeposit) {
      _usersConfig[onBehalfOf].setUsingAsCollateral(reserve.id, true);
    }

    IAToken(aToken).mint(onBehalfOf, amount, reserve.liquidityIndex);

    //transfer to the aToken contract
    IERC20(asset).safeTransferFrom(msg.sender, aToken, amount);

    emit Deposit(asset, msg.sender, onBehalfOf, amount, referralCode);
  }

  /**
   * @dev withdraws the _reserves of user.
   * @param asset the address of the reserve
   * @param amount the underlying amount to be redeemed
   **/
  function withdraw(address asset, uint256 amount) external override {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    address aToken = reserve.aTokenAddress;

    uint256 userBalance = IAToken(aToken).balanceOf(msg.sender);

    uint256 amountToWithdraw = amount;

    //if amount is equal to uint(-1), the user wants to redeem everything
    if (amount == UINT_MAX_VALUE) {
      amountToWithdraw = userBalance;
    }

    ValidationLogic.validateWithdraw(
      asset,
      aToken,
      amountToWithdraw,
      userBalance,
      _reserves,
      _usersConfig[msg.sender],
      _reservesList,
      _addressesProvider.getPriceOracle()
    );

    reserve.updateState();

    reserve.updateInterestRates(asset, aToken, 0, amountToWithdraw);

    if (amountToWithdraw == userBalance) {
      _usersConfig[msg.sender].setUsingAsCollateral(reserve.id, false);
    }

    IAToken(aToken).burn(msg.sender, msg.sender, amountToWithdraw, reserve.liquidityIndex);

    emit Withdraw(asset, msg.sender, amount);
  }

  function getBorrowAllowance(
    address fromUser,
    address toUser,
    address asset,
    uint256 interestRateMode
  ) external override view returns (uint256) {
    return
      _borrowAllowance[_reserves[asset].getDebtTokenAddress(interestRateMode)][fromUser][toUser];
  }

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
  ) external override {
    address debtToken = _reserves[asset].getDebtTokenAddress(interestRateMode);

    _borrowAllowance[debtToken][msg.sender][user] = amount;
    emit BorrowAllowanceDelegated(asset, msg.sender, user, interestRateMode, amount);
  }

  /**
   * @dev Allows users to borrow a specific amount of the reserve currency, provided that the borrower
   * already deposited enough collateral.
   * @param asset the address of the reserve
   * @param amount the amount to be borrowed
   * @param interestRateMode the interest rate mode at which the user wants to borrow. Can be 0 (STABLE) or 1 (VARIABLE)
   * @param referralCode a referral code for integrators
   * @param onBehalfOf address of the user who will receive the debt
   **/
  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referralCode,
    address onBehalfOf
  ) external override {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    if (onBehalfOf != msg.sender) {
      address debtToken = reserve.getDebtTokenAddress(interestRateMode);

      _borrowAllowance[debtToken][onBehalfOf][msg
        .sender] = _borrowAllowance[debtToken][onBehalfOf][msg.sender].sub(
        amount,
        Errors.BORROW_ALLOWANCE_ARE_NOT_ENOUGH
      );
    }
    _executeBorrow(
      ExecuteBorrowParams(
        asset,
        msg.sender,
        onBehalfOf,
        amount,
        interestRateMode,
        reserve.aTokenAddress,
        referralCode,
        true
      )
    );
  }

  /**
   * @notice repays a borrow on the specific reserve, for the specified amount (or for the whole amount, if uint256(-1) is specified).
   * @dev the target user is defined by onBehalfOf. If there is no repayment on behalf of another account,
   * onBehalfOf must be equal to msg.sender.
   * @param asset the address of the reserve on which the user borrowed
   * @param amount the amount to repay, or uint256(-1) if the user wants to repay everything
   * @param onBehalfOf the address for which msg.sender is repaying.
   **/
  function repay(
    address asset,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) external override {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    (uint256 stableDebt, uint256 variableDebt) = Helpers.getUserCurrentDebt(onBehalfOf, reserve);

    ReserveLogic.InterestRateMode interestRateMode = ReserveLogic.InterestRateMode(rateMode);

    //default to max amount
    uint256 paybackAmount = interestRateMode == ReserveLogic.InterestRateMode.STABLE
      ? stableDebt
      : variableDebt;

    if (amount != UINT_MAX_VALUE && amount < paybackAmount) {
      paybackAmount = amount;
    }

    ValidationLogic.validateRepay(
      reserve,
      amount,
      interestRateMode,
      onBehalfOf,
      stableDebt,
      variableDebt
    );

    reserve.updateState();

    //burns an equivalent amount of debt tokens
    if (interestRateMode == ReserveLogic.InterestRateMode.STABLE) {
      IStableDebtToken(reserve.stableDebtTokenAddress).burn(onBehalfOf, paybackAmount);
    } else {
      IVariableDebtToken(reserve.variableDebtTokenAddress).burn(onBehalfOf, paybackAmount, reserve.variableBorrowIndex);
    }

    address aToken = reserve.aTokenAddress;
    reserve.updateInterestRates(asset, aToken, paybackAmount, 0);

    if (stableDebt.add(variableDebt).sub(paybackAmount) == 0) {
      _usersConfig[onBehalfOf].setBorrowing(reserve.id, false);
    }

    IERC20(asset).safeTransferFrom(msg.sender, aToken, paybackAmount);

    emit Repay(asset, onBehalfOf, msg.sender, paybackAmount);
  }

  /**
   * @dev borrowers can user this function to swap between stable and variable borrow rate modes.
   * @param asset the address of the reserve on which the user borrowed
   * @param rateMode the rate mode that the user wants to swap
   **/
  function swapBorrowRateMode(address asset, uint256 rateMode) external override {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    (uint256 stableDebt, uint256 variableDebt) = Helpers.getUserCurrentDebt(msg.sender, reserve);

    ReserveLogic.InterestRateMode interestRateMode = ReserveLogic.InterestRateMode(rateMode);

    ValidationLogic.validateSwapRateMode(
      reserve,
      _usersConfig[msg.sender],
      stableDebt,
      variableDebt,
      interestRateMode
    );

    reserve.updateState();

    if (interestRateMode == ReserveLogic.InterestRateMode.STABLE) {
      //burn stable rate tokens, mint variable rate tokens
      IStableDebtToken(reserve.stableDebtTokenAddress).burn(msg.sender, stableDebt);
      IVariableDebtToken(reserve.variableDebtTokenAddress).mint(msg.sender, stableDebt, reserve.variableBorrowIndex);
    } else {
      //do the opposite
      IVariableDebtToken(reserve.variableDebtTokenAddress).burn(msg.sender, variableDebt, reserve.variableBorrowIndex);
      IStableDebtToken(reserve.stableDebtTokenAddress).mint(
        msg.sender,
        variableDebt,
        reserve.currentStableBorrowRate
      );
    }

    reserve.updateInterestRates(asset, reserve.aTokenAddress, 0, 0);

    emit Swap(asset, msg.sender);
  }

  /**
   * @dev rebalances the stable interest rate of a user if current liquidity rate > user stable rate.
   * this is regulated by Aave to ensure that the protocol is not abused, and the user is paying a fair
   * rate. Anyone can call this function.
   * @param asset the address of the reserve
   * @param user the address of the user to be rebalanced
   **/
  function rebalanceStableBorrowRate(address asset, address user) external override {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    IStableDebtToken stableDebtToken = IStableDebtToken(reserve.stableDebtTokenAddress);

    uint256 stableBorrowBalance = IERC20(address(stableDebtToken)).balanceOf(user);

    // user must be borrowing on asset at a stable rate
    require(stableBorrowBalance > 0, Errors.NOT_ENOUGH_STABLE_BORROW_BALANCE);

    uint256 rebalanceDownRateThreshold = WadRayMath.ray().add(REBALANCE_DOWN_RATE_DELTA).rayMul(
      reserve.currentStableBorrowRate
    );

    //1. user stable borrow rate is below the current liquidity rate. The loan needs to be rebalanced,
    //as this situation can be abused (user putting back the borrowed liquidity in the same reserve to earn on it)
    //2. user stable rate is above the market avg borrow rate of a certain delta, and utilization rate is low.
    //In this case, the user is paying an interest that is too high, and needs to be rescaled down.

    uint256 userStableRate = stableDebtToken.getUserStableRate(user);

    require(
      userStableRate < reserve.currentLiquidityRate || userStableRate > rebalanceDownRateThreshold,
      Errors.INTEREST_RATE_REBALANCE_CONDITIONS_NOT_MET
    );


    reserve.updateState();

    //burn old debt tokens, mint new ones
    stableDebtToken.burn(user, stableBorrowBalance);
    stableDebtToken.mint(user, stableBorrowBalance, reserve.currentStableBorrowRate);

    reserve.updateInterestRates(asset, reserve.aTokenAddress, 0, 0);

    emit RebalanceStableBorrowRate(asset, user);

    return;
  }

  /**
   * @dev allows depositors to enable or disable a specific deposit as collateral.
   * @param asset the address of the reserve
   * @param useAsCollateral true if the user wants to user the deposit as collateral, false otherwise.
   **/
  function setUserUseReserveAsCollateral(address asset, bool useAsCollateral) external override {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    ValidationLogic.validateSetUseReserveAsCollateral(
      reserve,
      asset,
      _reserves,
      _usersConfig[msg.sender],
      _reservesList,
      _addressesProvider.getPriceOracle()
    );

    _usersConfig[msg.sender].setUsingAsCollateral(reserve.id, useAsCollateral);

    if (useAsCollateral) {
      emit ReserveUsedAsCollateralEnabled(asset, msg.sender);
    } else {
      emit ReserveUsedAsCollateralDisabled(asset, msg.sender);
    }
  }

  /**
   * @dev users can invoke this function to liquidate an undercollateralized position.
   * @param asset the address of the collateral to liquidated
   * @param asset the address of the principal reserve
   * @param user the address of the borrower
   * @param purchaseAmount the amount of principal that the liquidator wants to repay
   * @param receiveAToken true if the liquidators wants to receive the aTokens, false if
   * he wants to receive the underlying asset directly
   **/
  function liquidationCall(
    address collateral,
    address asset,
    address user,
    uint256 purchaseAmount,
    bool receiveAToken
  ) external override {
    address liquidationManager = _addressesProvider.getLendingPoolLiquidationManager();

    //solium-disable-next-line
    (bool success, bytes memory result) = liquidationManager.delegatecall(
      abi.encodeWithSignature(
        'liquidationCall(address,address,address,uint256,bool)',
        collateral,
        asset,
        user,
        purchaseAmount,
        receiveAToken
      )
    );
    require(success, Errors.LIQUIDATION_CALL_FAILED);

    (uint256 returnCode, string memory returnMessage) = abi.decode(result, (uint256, string));

    if (returnCode != 0) {
      //error found
      revert(string(abi.encodePacked(returnMessage)));
    }
  }

  struct FlashLoanLocalVars {
    uint256 premium;
    uint256 amountPlusPremium;
    uint256 amountPlusPremiumInETH;
    uint256 receiverBalance;
    uint256 receiverAllowance;
    uint256 availableBalance;
    uint256 assetPrice;
    IFlashLoanReceiver receiver;
    address aTokenAddress;
    address oracle;
  }

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
  ) external override {
    require(!_flashLiquidationLocked, Errors.REENTRANCY_NOT_ALLOWED);
    _flashLiquidationLocked = true;

    address liquidationManager = _addressesProvider.getLendingPoolLiquidationManager();

    //solium-disable-next-line
    (bool success, bytes memory result) = liquidationManager.delegatecall(
      abi.encodeWithSignature(
        'repayWithCollateral(address,address,address,uint256,address,bytes)',
        collateral,
        principal,
        user,
        principalAmount,
        receiver,
        params
      )
    );
    require(success, Errors.FAILED_REPAY_WITH_COLLATERAL);

    (uint256 returnCode, string memory returnMessage) = abi.decode(result, (uint256, string));

    if (returnCode != 0) {
      revert(string(abi.encodePacked(returnMessage)));
    }

    _flashLiquidationLocked = false;
  }

  /**
   * @dev allows smartcontracts to access the liquidity of the pool within one transaction,
   * as long as the amount taken plus a fee is returned. NOTE There are security concerns for developers of flashloan receiver contracts
   * that must be kept into consideration. For further details please visit https://developers.aave.com
   * @param receiverAddress The address of the contract receiving the funds. The receiver should implement the IFlashLoanReceiver interface.
   * @param asset The address of the principal reserve
   * @param amount The amount requested for this flashloan
   * @param mode Type of the debt to open if the flash loan is not returned. 0 -> Don't open any debt, just revert, 1 -> stable, 2 -> variable
   * @param params Variadic packed params to pass to the receiver as extra information
   * @param referralCode Referral code of the flash loan
   **/
  function flashLoan(
    address receiverAddress,
    address asset,
    uint256 amount,
    uint256 mode,
    bytes calldata params,
    uint16 referralCode
  ) external override {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];
    FlashLoanLocalVars memory vars;

    vars.aTokenAddress = reserve.aTokenAddress;

    vars.premium = amount.mul(FLASHLOAN_PREMIUM_TOTAL).div(10000);

    ValidationLogic.validateFlashloan(mode, vars.premium);

    ReserveLogic.InterestRateMode debtMode = ReserveLogic.InterestRateMode(mode);

    vars.receiver = IFlashLoanReceiver(receiverAddress);

    //transfer funds to the receiver
    IAToken(vars.aTokenAddress).transferUnderlyingTo(receiverAddress, amount);

    //execute action of the receiver
    vars.receiver.executeOperation(asset, amount, vars.premium, params);

    vars.amountPlusPremium = amount.add(vars.premium);

    if (debtMode == ReserveLogic.InterestRateMode.NONE) {
      IERC20(asset).transferFrom(receiverAddress, vars.aTokenAddress, vars.amountPlusPremium);

      reserve.updateState();
      reserve.cumulateToLiquidityIndex(IERC20(vars.aTokenAddress).totalSupply(), vars.premium);
      reserve.updateInterestRates(asset, vars.aTokenAddress, vars.premium, 0);

      emit FlashLoan(receiverAddress, asset, amount, vars.premium, referralCode);
    } else {
      // If the transfer didn't succeed, the receiver either didn't return the funds, or didn't approve the transfer.
      _executeBorrow(
        ExecuteBorrowParams(
          asset,
          msg.sender,
          msg.sender,
          vars.amountPlusPremium.sub(vars.availableBalance),
          mode,
          vars.aTokenAddress,
          referralCode,
          false
        )
      );
    }
  }

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
  ) external override {
    address liquidationManager = _addressesProvider.getLendingPoolLiquidationManager();

    //solium-disable-next-line
    (bool success, bytes memory result) = liquidationManager.delegatecall(
      abi.encodeWithSignature(
        'swapLiquidity(address,address,address,uint256,bytes)',
        receiverAddress,
        fromAsset,
        toAsset,
        amountToSwap,
        params
      )
    );
    require(success, Errors.FAILED_COLLATERAL_SWAP);

    (uint256 returnCode, string memory returnMessage) = abi.decode(result, (uint256, string));

    if (returnCode != 0) {
      revert(string(abi.encodePacked(returnMessage)));
    }
  }

  /**
   * @dev accessory functions to fetch data from the core contract
   **/

  function getReserveConfigurationData(address asset)
    external
    override
    view
    returns (
      uint256 decimals,
      uint256 ltv,
      uint256 liquidationThreshold,
      uint256 liquidationBonus,
      uint256 reserveFactor,
      address interestRateStrategyAddress,
      bool usageAsCollateralEnabled,
      bool borrowingEnabled,
      bool stableBorrowRateEnabled,
      bool isActive,
      bool isFreezed
    )
  {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    return (
      reserve.configuration.getDecimals(),
      reserve.configuration.getLtv(),
      reserve.configuration.getLiquidationThreshold(),
      reserve.configuration.getLiquidationBonus(),
      reserve.configuration.getReserveFactor(),
      reserve.interestRateStrategyAddress,
      reserve.configuration.getLtv() != 0,
      reserve.configuration.getBorrowingEnabled(),
      reserve.configuration.getStableRateBorrowingEnabled(),
      reserve.configuration.getActive(),
      reserve.configuration.getFrozen()
    );
  }

  function getReserveTokensAddresses(address asset)
    external
    override
    view
    returns (
      address aTokenAddress,
      address stableDebtTokenAddress,
      address variableDebtTokenAddress
    )
  {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    return (
      reserve.aTokenAddress,
      reserve.stableDebtTokenAddress,
      reserve.variableDebtTokenAddress
    );
  }

  function getReserveData(address asset)
    external
    override
    view
    returns (
      uint256 availableLiquidity,
      uint256 totalStableDebt,
      uint256 totalVariableDebt,
      uint256 liquidityRate,
      uint256 variableBorrowRate,
      uint256 stableBorrowRate,
      uint256 averageStableBorrowRate,
      uint256 liquidityIndex,
      uint256 variableBorrowIndex,
      uint40 lastUpdateTimestamp
    )
  {
    ReserveLogic.ReserveData memory reserve = _reserves[asset];
    return (
      IERC20(asset).balanceOf(reserve.aTokenAddress),
      IERC20(reserve.stableDebtTokenAddress).totalSupply(),
      IERC20(reserve.variableDebtTokenAddress).totalSupply(),
      reserve.currentLiquidityRate,
      reserve.currentVariableBorrowRate,
      reserve.currentStableBorrowRate,
      IStableDebtToken(reserve.stableDebtTokenAddress).getAverageStableRate(),
      reserve.liquidityIndex,
      reserve.variableBorrowIndex,
      reserve.lastUpdateTimestamp
    );
  }

  function getUserAccountData(address user)
    external
    override
    view
    returns (
      uint256 totalCollateralETH,
      uint256 totalBorrowsETH,
      uint256 availableBorrowsETH,
      uint256 currentLiquidationThreshold,
      uint256 ltv,
      uint256 healthFactor
    )
  {
    (
      totalCollateralETH,
      totalBorrowsETH,
      ltv,
      currentLiquidationThreshold,
      healthFactor
    ) = GenericLogic.calculateUserAccountData(
      user,
      _reserves,
      _usersConfig[user],
      _reservesList,
      _addressesProvider.getPriceOracle()
    );

    availableBorrowsETH = GenericLogic.calculateAvailableBorrowsETH(
      totalCollateralETH,
      totalBorrowsETH,
      ltv
    );
  }

  function getUserReserveData(address asset, address user)
    external
    override
    view
    returns (
      uint256 currentATokenBalance,
      uint256 currentStableDebt,
      uint256 currentVariableDebt,
      uint256 principalStableDebt,
      uint256 scaledVariableDebt,
      uint256 stableBorrowRate,
      uint256 liquidityRate,
      uint40 stableRateLastUpdated,
      bool usageAsCollateralEnabled
    )
  {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    currentATokenBalance = IERC20(reserve.aTokenAddress).balanceOf(user);
    (currentStableDebt, currentVariableDebt) = Helpers.getUserCurrentDebt(user, reserve);
    principalStableDebt = IStableDebtToken(reserve.stableDebtTokenAddress).principalBalanceOf(user);
    scaledVariableDebt = IVariableDebtToken(reserve.variableDebtTokenAddress).scaledBalanceOf(user);
    liquidityRate = reserve.currentLiquidityRate;
    stableBorrowRate = IStableDebtToken(reserve.stableDebtTokenAddress).getUserStableRate(user);
    stableRateLastUpdated = IStableDebtToken(reserve.stableDebtTokenAddress).getUserLastUpdated(
      user
    );
    usageAsCollateralEnabled = _usersConfig[user].isUsingAsCollateral(reserve.id);
  }

  function getReserves() external override view returns (address[] memory) {
    return _reservesList;
  }

  receive() external payable {
    revert();
  }

  /**
   * @dev initializes a reserve
   * @param asset the address of the reserve
   * @param aTokenAddress the address of the overlying aToken contract
   * @param interestRateStrategyAddress the address of the interest rate strategy contract
   **/
  function initReserve(
    address asset,
    address aTokenAddress,
    address stableDebtAddress,
    address variableDebtAddress,
    address interestRateStrategyAddress
  ) external override {
    onlyLendingPoolConfigurator();
    _reserves[asset].init(
      aTokenAddress,
      stableDebtAddress,
      variableDebtAddress,
      interestRateStrategyAddress
    );
    _addReserveToList(asset);
  }

  /**
   * @dev updates the address of the interest rate strategy contract
   * @param asset the address of the reserve
   * @param rateStrategyAddress the address of the interest rate strategy contract
   **/

  function setReserveInterestRateStrategyAddress(address asset, address rateStrategyAddress)
    external
    override
  {
    onlyLendingPoolConfigurator();
    _reserves[asset].interestRateStrategyAddress = rateStrategyAddress;
  }

  function setConfiguration(address asset, uint256 configuration) external override {
    onlyLendingPoolConfigurator();
    _reserves[asset].configuration.data = configuration;
  }

  function getConfiguration(address asset)
    external
    override
    view
    returns (ReserveConfiguration.Map memory)
  {
    return _reserves[asset].configuration;
  }

  /**
   * @dev returns the normalized income per unit of asset
   * @param asset the address of the reserve
   * @return the reserve normalized income
   */
  function getReserveNormalizedIncome(address asset) external override view returns (uint256) {
    return _reserves[asset].getNormalizedIncome();
  }

  /**
   * @dev returns the normalized variable debt per unit of asset
   * @param asset the address of the reserve
   * @return the reserve normalized debt
   */
  function getReserveNormalizedVariableDebt(address asset)
    external
    override
    view
    returns (uint256)
  {
    return _reserves[asset].getNormalizedDebt();
  }

  /**
   * @dev validate if a balance decrease for an asset is allowed
   * @param asset the address of the reserve
   * @param user the user related to the balance decrease
   * @param amount the amount being transferred/redeemed
   * @return true if the balance decrease can be allowed, false otherwise
   */
  function balanceDecreaseAllowed(
    address asset,
    address user,
    uint256 amount
  ) external override view returns (bool) {
    return
      GenericLogic.balanceDecreaseAllowed(
        asset,
        user,
        amount,
        _reserves,
        _usersConfig[user],
        _reservesList,
        _addressesProvider.getPriceOracle()
      );
  }

  /**
   * @dev returns the list of the initialized reserves
   **/
  function getReservesList() external view returns (address[] memory) {
    return _reservesList;
  }

  /**
   * @dev returns the addresses provider
   **/
  function getAddressesProvider() external view returns (ILendingPoolAddressesProvider) {
    return _addressesProvider;
  }

  // internal functions

  struct ExecuteBorrowParams {
    address asset;
    address user;
    address onBehalfOf;
    uint256 amount;
    uint256 interestRateMode;
    address aTokenAddress;
    uint16 referralCode;
    bool releaseUnderlying;
  }

  /**
   * @dev Internal function to execute a borrowing action, allowing to transfer or not the underlying
   * @param vars Input struct for the borrowing action, in order to avoid STD errors
   **/
  function _executeBorrow(ExecuteBorrowParams memory vars) internal {
    ReserveLogic.ReserveData storage reserve = _reserves[vars.asset];
    UserConfiguration.Map storage userConfig = _usersConfig[vars.onBehalfOf];

    address oracle = _addressesProvider.getPriceOracle();

    uint256 amountInETH = IPriceOracleGetter(oracle).getAssetPrice(vars.asset).mul(vars.amount).div(
      10**reserve.configuration.getDecimals()
    );

    ValidationLogic.validateBorrow(
      reserve,
      vars.onBehalfOf,
      vars.amount,
      amountInETH,
      vars.interestRateMode,
      MAX_STABLE_RATE_BORROW_SIZE_PERCENT,
      _reserves,
      userConfig,
      _reservesList,
      oracle
    );

    uint256 reserveId = reserve.id;
    if (!userConfig.isBorrowing(reserveId)) {
      userConfig.setBorrowing(reserveId, true);
    }

    reserve.updateState();

    //caching the current stable borrow rate
    uint256 currentStableRate = 0;

    if (
      ReserveLogic.InterestRateMode(vars.interestRateMode) == ReserveLogic.InterestRateMode.STABLE
    ) {
      currentStableRate = reserve.currentStableBorrowRate;

      IStableDebtToken(reserve.stableDebtTokenAddress).mint(vars.user, vars.amount, currentStableRate);
    } else {
      IVariableDebtToken(reserve.variableDebtTokenAddress).mint(vars.user, vars.amount, reserve.variableBorrowIndex);
    }

    reserve.updateInterestRates(
      vars.asset,
      vars.aTokenAddress,
      0,
      vars.releaseUnderlying ? vars.amount : 0
    );

    if (vars.releaseUnderlying) {
      IAToken(vars.aTokenAddress).transferUnderlyingTo(vars.user, vars.amount);
    }

    emit Borrow(
      vars.asset,
      vars.user,
      vars.onBehalfOf,
      vars.amount,
      vars.interestRateMode,
      ReserveLogic.InterestRateMode(vars.interestRateMode) == ReserveLogic.InterestRateMode.STABLE
        ? currentStableRate
        : reserve.currentVariableBorrowRate,
      vars.referralCode
    );
  }

  /**
   * @dev adds a reserve to the array of the _reserves address
   **/
  function _addReserveToList(address asset) internal {
    bool reserveAlreadyAdded = false;
    for (uint256 i = 0; i < _reservesList.length; i++)
      if (_reservesList[i] == asset) {
        reserveAlreadyAdded = true;
      }
    if (!reserveAlreadyAdded) {
      _reserves[asset].id = uint8(_reservesList.length);
      _reservesList.push(asset);
    }
  }
}
