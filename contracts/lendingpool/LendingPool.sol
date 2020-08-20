// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  VersionedInitializable
} from '../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';
import {LendingPoolAddressesProvider} from '../configuration/LendingPoolAddressesProvider.sol';
import {AToken} from '../tokenization/AToken.sol';
import {Helpers} from '../libraries/helpers/Helpers.sol';
import {WadRayMath} from '../libraries/math/WadRayMath.sol';
import {ReserveLogic} from '../libraries/logic/ReserveLogic.sol';
import {GenericLogic} from '../libraries/logic/GenericLogic.sol';
import {ValidationLogic} from '../libraries/logic/ValidationLogic.sol';
import {ReserveConfiguration} from '../libraries/configuration/ReserveConfiguration.sol';
import {UserConfiguration} from '../libraries/configuration/UserConfiguration.sol';
import {IStableDebtToken} from '../tokenization/interfaces/IStableDebtToken.sol';
import {IVariableDebtToken} from '../tokenization/interfaces/IVariableDebtToken.sol';
import {IFlashLoanReceiver} from '../flashloan/interfaces/IFlashLoanReceiver.sol';
import {LendingPoolLiquidationManager} from './LendingPoolLiquidationManager.sol';
import {IPriceOracleGetter} from '../interfaces/IPriceOracleGetter.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

/**
 * @title LendingPool contract
 * @notice Implements the actions of the LendingPool, and exposes accessory methods to fetch the users and reserve data
 * @author Aave
 **/

contract LendingPool is ReentrancyGuard, VersionedInitializable {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using Address for address payable;
  using ReserveLogic for ReserveLogic.ReserveData;
  using ReserveConfiguration for ReserveConfiguration.Map;
  using UserConfiguration for UserConfiguration.Map;

  //main configuration parameters
  uint256 private constant REBALANCE_DOWN_RATE_DELTA = (1e27) / 5;
  uint256 private constant MAX_STABLE_RATE_BORROW_SIZE_PERCENT = 25;
  uint256 private constant FLASHLOAN_FEE_TOTAL = 9;

  LendingPoolAddressesProvider public addressesProvider;
  using SafeERC20 for IERC20;

  mapping(address => ReserveLogic.ReserveData) internal reserves;
  mapping(address => UserConfiguration.Map) internal usersConfig;

  address[] public reservesList;

  /**
   * @dev emitted on deposit
   * @param _reserve the address of the reserve
   * @param _user the address of the user
   * @param _amount the amount to be deposited
   * @param _referral the referral number of the action
   * @param _timestamp the timestamp of the action
   **/
  event Deposit(
    address indexed _reserve,
    address indexed _user,
    uint256 _amount,
    uint16 indexed _referral,
    uint256 _timestamp
  );

  /**
   * @dev emitted during a withdraw action.
   * @param _reserve the address of the reserve
   * @param _user the address of the user
   * @param _amount the amount to be withdrawn
   * @param _timestamp the timestamp of the action
   **/
  event Withdraw(
    address indexed _reserve,
    address indexed _user,
    uint256 _amount,
    uint256 _timestamp
  );

  /**
   * @dev emitted on borrow
   * @param _reserve the address of the reserve
   * @param _user the address of the user
   * @param _amount the amount to be deposited
   * @param _borrowRateMode the rate mode, can be either 1-stable or 2-variable
   * @param _borrowRate the rate at which the user has borrowed
   * @param _referral the referral number of the action
   * @param _timestamp the timestamp of the action
   **/
  event Borrow(
    address indexed _reserve,
    address indexed _user,
    uint256 _amount,
    uint256 _borrowRateMode,
    uint256 _borrowRate,
    uint16 indexed _referral,
    uint256 _timestamp
  );

  /**
   * @dev emitted on repay
   * @param _reserve the address of the reserve
   * @param _user the address of the user for which the repay has been executed
   * @param _repayer the address of the user that has performed the repay action
   * @param _amount the amount repaid
   * @param _timestamp the timestamp of the action
   **/
  event Repay(
    address indexed _reserve,
    address indexed _user,
    address indexed _repayer,
    uint256 _amount,
    uint256 _timestamp
  );

  /**
   * @dev emitted when a user performs a rate swap
   * @param _reserve the address of the reserve
   * @param _user the address of the user executing the swap
   * @param _timestamp the timestamp of the action
   **/
  event Swap(address indexed _reserve, address indexed _user, uint256 _timestamp);

  /**
   * @dev emitted when a user enables a reserve as collateral
   * @param _reserve the address of the reserve
   * @param _user the address of the user
   **/
  event ReserveUsedAsCollateralEnabled(address indexed _reserve, address indexed _user);

  /**
   * @dev emitted when a user disables a reserve as collateral
   * @param _reserve the address of the reserve
   * @param _user the address of the user
   **/
  event ReserveUsedAsCollateralDisabled(address indexed _reserve, address indexed _user);

  /**
   * @dev emitted when the stable rate of a user gets rebalanced
   * @param _reserve the address of the reserve
   * @param _user the address of the user for which the rebalance has been executed
   * @param _timestamp the timestamp of the action
   **/
  event RebalanceStableBorrowRate(
    address indexed _reserve,
    address indexed _user,
    uint256 _timestamp
  );

  /**
   * @dev emitted when a flashloan is executed
   * @param _target the address of the flashLoanReceiver
   * @param _reserve the address of the reserve
   * @param _amount the amount requested
   * @param _totalFee the total fee on the amount
   * @param _timestamp the timestamp of the action
   **/
  event FlashLoan(
    address indexed _target,
    address indexed _reserve,
    uint256 _amount,
    uint256 _totalFee,
    uint256 _timestamp
  );

  /**
   * @dev these events are not emitted directly by the LendingPool
   * but they are declared here as the LendingPoolLiquidationManager
   * is executed using a delegateCall().
   * This allows to have the events in the generated ABI for LendingPool.
   **/

  /**
   * @dev emitted when a borrow fee is liquidated
   * @param _collateral the address of the collateral being liquidated
   * @param _reserve the address of the reserve
   * @param _user the address of the user being liquidated
   * @param _feeLiquidated the total fee liquidated
   * @param _liquidatedCollateralForFee the amount of collateral received by the protocol in exchange for the fee
   * @param _timestamp the timestamp of the action
   **/
  event OriginationFeeLiquidated(
    address indexed _collateral,
    address indexed _reserve,
    address indexed _user,
    uint256 _feeLiquidated,
    uint256 _liquidatedCollateralForFee,
    uint256 _timestamp
  );

  /**
   * @dev emitted when a borrower is liquidated
   * @param _collateral the address of the collateral being liquidated
   * @param _reserve the address of the reserve
   * @param _user the address of the user being liquidated
   * @param _purchaseAmount the total amount liquidated
   * @param _liquidatedCollateralAmount the amount of collateral being liquidated
   * @param _accruedBorrowInterest the amount of interest accrued by the borrower since the last action
   * @param _liquidator the address of the liquidator
   * @param _receiveAToken true if the liquidator wants to receive aTokens, false otherwise
   * @param _timestamp the timestamp of the action
   **/
  event LiquidationCall(
    address indexed _collateral,
    address indexed _reserve,
    address indexed _user,
    uint256 _purchaseAmount,
    uint256 _liquidatedCollateralAmount,
    uint256 _accruedBorrowInterest,
    address _liquidator,
    bool _receiveAToken,
    uint256 _timestamp
  );

  /**
   * @dev only lending pools configurator can use functions affected by this modifier
   **/
  modifier onlyLendingPoolConfigurator {
    require(addressesProvider.getLendingPoolConfigurator() == msg.sender, '30');
    _;
  }

  uint256 public constant UINT_MAX_VALUE = uint256(-1);

  uint256 public constant LENDINGPOOL_REVISION = 0x2;

  function getRevision() internal override pure returns (uint256) {
    return LENDINGPOOL_REVISION;
  }

  /**
   * @dev this function is invoked by the proxy contract when the LendingPool contract is added to the
   * AddressesProvider.
   * @param _addressesProvider the address of the LendingPoolAddressesProvider registry
   **/
  function initialize(LendingPoolAddressesProvider _addressesProvider) public initializer {
    addressesProvider = _addressesProvider;
  }

  /**
   * @dev deposits The underlying asset into the reserve. A corresponding amount of the overlying asset (aTokens)
   * is minted.
   * @param _reserve the address of the reserve
   * @param _amount the amount to be deposited
   * @param _referralCode integrators are assigned a referral code and can potentially receive rewards.
   **/
  function deposit(
    address _reserve,
    uint256 _amount,
    uint16 _referralCode
  ) external payable nonReentrant {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];

    ValidationLogic.validateDeposit(reserve, _amount);

    AToken aToken = AToken(reserve.aTokenAddress);

    bool isFirstDeposit = aToken.balanceOf(msg.sender) == 0;

    reserve.updateCumulativeIndexesAndTimestamp();
    reserve.updateInterestRates(_reserve, _amount, 0);

    if (isFirstDeposit) {
      usersConfig[msg.sender].setUsingAsCollateral(reserve.index, true);
    }

    //minting AToken to user 1:1 with the specific exchange rate
    aToken.mint(msg.sender, _amount);

    //transfer to the aToken contract
    IERC20(_reserve).safeTransferFrom(msg.sender, address(aToken), _amount);

    //solium-disable-next-line
    emit Deposit(_reserve, msg.sender, _amount, _referralCode, block.timestamp);
  }

  /**
   * @dev withdraws the assets of _user.
   * @param _reserve the address of the reserve
   * @param _amount the underlying amount to be redeemed
   **/
  function withdraw(address _reserve, uint256 _amount) external nonReentrant {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];

    AToken aToken = AToken(payable(reserve.aTokenAddress));

    uint256 userBalance = aToken.balanceOf(msg.sender);

    uint256 amountToWithdraw = _amount;

    //if amount is equal to uint(-1), the user wants to redeem everything
    if (_amount == UINT_MAX_VALUE) {
      amountToWithdraw = userBalance;
    }

    ValidationLogic.validateWithdraw(
      _reserve,
      address(aToken),
      amountToWithdraw,
      userBalance,
      reserves,
      usersConfig[msg.sender],
      reservesList,
      addressesProvider.getPriceOracle()
    );

    reserve.updateCumulativeIndexesAndTimestamp();

    reserve.updateInterestRates(_reserve, 0, amountToWithdraw);

    if (amountToWithdraw == userBalance) {
      usersConfig[msg.sender].setUsingAsCollateral(reserve.index, false);
    }

    aToken.burn(msg.sender, msg.sender, amountToWithdraw);

    //solium-disable-next-line
    emit Withdraw(_reserve, msg.sender, _amount, block.timestamp);
  }

  /**
   * @dev Allows users to borrow a specific amount of the reserve currency, provided that the borrower
   * already deposited enough collateral.
   * @param _reserve the address of the reserve
   * @param _amount the amount to be borrowed
   * @param _interestRateMode the interest rate mode at which the user wants to borrow. Can be 0 (STABLE) or 1 (VARIABLE)
   **/
  function borrow(
    address _reserve,
    uint256 _amount,
    uint256 _interestRateMode,
    uint16 _referralCode
  ) external nonReentrant {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];
    UserConfiguration.Map storage userConfig = usersConfig[msg.sender];

    uint256 amountInETH = IPriceOracleGetter(addressesProvider.getPriceOracle())
      .getAssetPrice(_reserve)
      .mul(_amount)
      .div(10**reserve.configuration.getDecimals()); //price is in ether

    ValidationLogic.validateBorrow(
      reserve,
      _reserve,
      _amount,
      amountInETH,
      _interestRateMode,
      MAX_STABLE_RATE_BORROW_SIZE_PERCENT,
      reserves,
      usersConfig[msg.sender],
      reservesList,
      addressesProvider.getPriceOracle()
    );

    //caching the current stable borrow rate
    uint256 userStableRate = reserve.currentStableBorrowRate;

    reserve.updateCumulativeIndexesAndTimestamp();

    if (ReserveLogic.InterestRateMode(_interestRateMode) == ReserveLogic.InterestRateMode.STABLE) {
      IStableDebtToken(reserve.stableDebtTokenAddress).mint(msg.sender, _amount, userStableRate);
      uint40 stableRateLastUpdated = IStableDebtToken(reserve.stableDebtTokenAddress)
        .getUserLastUpdated(msg.sender);
    } else {
      IVariableDebtToken(reserve.variableDebtTokenAddress).mint(msg.sender, _amount);
    }

    reserve.updateInterestRates(_reserve, 0, _amount);

    if (!userConfig.isBorrowing(reserve.index)) {
      userConfig.setBorrowing(reserve.index, true);
    }

    //if we reached this point, we can transfer
    AToken(reserve.aTokenAddress).transferUnderlyingTo(msg.sender, _amount);

    emit Borrow(
      _reserve,
      msg.sender,
      _amount,
      _interestRateMode,
      ReserveLogic.InterestRateMode(_interestRateMode) == ReserveLogic.InterestRateMode.STABLE
        ? userStableRate
        : reserve.currentVariableBorrowRate,
      _referralCode,
      //solium-disable-next-line
      block.timestamp
    );
  }

  struct RepayLocalVars {
    uint256 stableDebt;
    uint256 variableDebt;
    uint256 paybackAmount;
    uint256 currentStableRate;
    uint256 totalDebt;
  }

  /**
   * @notice repays a borrow on the specific reserve, for the specified amount (or for the whole amount, if uint256(-1) is specified).
   * @dev the target user is defined by _onBehalfOf. If there is no repayment on behalf of another account,
   * _onBehalfOf must be equal to msg.sender.
   * @param _reserve the address of the reserve on which the user borrowed
   * @param _amount the amount to repay, or uint256(-1) if the user wants to repay everything
   * @param _onBehalfOf the address for which msg.sender is repaying.
   **/
  function repay(
    address _reserve,
    uint256 _amount,
    uint256 _rateMode,
    address payable _onBehalfOf
  ) external payable nonReentrant {
    RepayLocalVars memory vars;
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];

    (vars.stableDebt, vars.variableDebt) = Helpers.getUserCurrentDebt(_onBehalfOf, reserve);

    vars.totalDebt = vars.stableDebt.add(vars.variableDebt);

    ReserveLogic.InterestRateMode rateMode = ReserveLogic.InterestRateMode(_rateMode);

    //default to max amount
    vars.paybackAmount = rateMode == ReserveLogic.InterestRateMode.STABLE
      ? vars.stableDebt
      : vars.variableDebt;

    if (_amount != UINT_MAX_VALUE && _amount < vars.paybackAmount) {
      vars.paybackAmount = _amount;
    }

    ValidationLogic.validateRepay(
      reserve,
      _reserve,
      _amount,
      rateMode,
      _onBehalfOf,
      vars.stableDebt,
      vars.variableDebt,
      vars.paybackAmount,
      msg.value
    );

    reserve.updateCumulativeIndexesAndTimestamp();

    //burns an equivalent amount of debt tokens
    if (rateMode == ReserveLogic.InterestRateMode.STABLE) {
      IStableDebtToken(reserve.stableDebtTokenAddress).burn(_onBehalfOf, vars.paybackAmount);
    } else {
      IVariableDebtToken(reserve.variableDebtTokenAddress).burn(_onBehalfOf, vars.paybackAmount);
    }

    reserve.updateInterestRates(_reserve, vars.paybackAmount, 0);

    if (vars.totalDebt.sub(vars.paybackAmount) == 0) {
      usersConfig[_onBehalfOf].setBorrowing(reserve.index, false);
    }

    IERC20(_reserve).safeTransferFrom(msg.sender, reserve.aTokenAddress, vars.paybackAmount);

    emit Repay(
      _reserve,
      _onBehalfOf,
      msg.sender,
      vars.paybackAmount,
      //solium-disable-next-line
      block.timestamp
    );
  }

  /**
   * @dev borrowers can user this function to swap between stable and variable borrow rate modes.
   * @param _reserve the address of the reserve on which the user borrowed
   * @param _rateMode the rate mode that the user wants to swap
   **/
  function swapBorrowRateMode(address _reserve, uint256 _rateMode) external nonReentrant {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];

    (uint256 stableDebt, uint256 variableDebt) = Helpers.getUserCurrentDebt(msg.sender, reserve);

    ReserveLogic.InterestRateMode rateMode = ReserveLogic.InterestRateMode(_rateMode);

    ValidationLogic.validateSwapRateMode(
      reserve,
      usersConfig[msg.sender],
      stableDebt,
      variableDebt,
      rateMode
    );

    reserve.updateCumulativeIndexesAndTimestamp();

    if (rateMode == ReserveLogic.InterestRateMode.STABLE) {
      //burn stable rate tokens, mint variable rate tokens
      IStableDebtToken(reserve.stableDebtTokenAddress).burn(msg.sender, stableDebt);
      IVariableDebtToken(reserve.variableDebtTokenAddress).mint(msg.sender, stableDebt);
    } else {
      //do the opposite
      IVariableDebtToken(reserve.variableDebtTokenAddress).burn(msg.sender, variableDebt);
      IStableDebtToken(reserve.stableDebtTokenAddress).mint(
        msg.sender,
        variableDebt,
        reserve.currentStableBorrowRate
      );
    }

    reserve.updateInterestRates(_reserve, 0, 0);

    emit Swap(
      _reserve,
      msg.sender,
      //solium-disable-next-line
      block.timestamp
    );
  }

  /**
   * @dev rebalances the stable interest rate of a user if current liquidity rate > user stable rate.
   * this is regulated by Aave to ensure that the protocol is not abused, and the user is paying a fair
   * rate. Anyone can call this function.
   * @param _reserve the address of the reserve
   * @param _user the address of the user to be rebalanced
   **/
  function rebalanceStableBorrowRate(address _reserve, address _user) external nonReentrant {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];

    IStableDebtToken stableDebtToken = IStableDebtToken(reserve.stableDebtTokenAddress);

    uint256 stableBorrowBalance = IERC20(address(stableDebtToken)).balanceOf(_user);

    // user must be borrowing on _reserve at a stable rate
    require(stableBorrowBalance > 0, 'User does not have any stable rate loan for this reserve');

    uint256 rebalanceDownRateThreshold = reserve.currentStableBorrowRate.rayMul(
      WadRayMath.ray().add(REBALANCE_DOWN_RATE_DELTA)
    );

    //1. user stable borrow rate is below the current liquidity rate. The loan needs to be rebalanced,
    //as this situation can be abused (user putting back the borrowed liquidity in the same reserve to earn on it)
    //2. user stable rate is above the market avg borrow rate of a certain delta, and utilization rate is low.
    //In this case, the user is paying an interest that is too high, and needs to be rescaled down.

    uint256 userStableRate = stableDebtToken.getUserStableRate(_user);

    require(
      userStableRate < reserve.currentLiquidityRate || userStableRate > rebalanceDownRateThreshold,
      'Interest rate rebalance conditions were not met'
    );

    //burn old debt tokens, mint new ones

    reserve.updateCumulativeIndexesAndTimestamp();

    stableDebtToken.burn(_user, stableBorrowBalance);
    stableDebtToken.mint(_user, stableBorrowBalance, reserve.currentStableBorrowRate);

    reserve.updateInterestRates(_reserve, 0, 0);

    emit RebalanceStableBorrowRate(
      _reserve,
      _user,
      //solium-disable-next-line
      block.timestamp
    );

    return;
  }

  /**
   * @dev allows depositors to enable or disable a specific deposit as collateral.
   * @param _reserve the address of the reserve
   * @param _useAsCollateral true if the user wants to user the deposit as collateral, false otherwise.
   **/
  function setUserUseReserveAsCollateral(address _reserve, bool _useAsCollateral)
    external
    nonReentrant
  {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];

    ValidationLogic.validateSetUseReserveAsCollateral(
      reserve,
      _reserve,
      reserves,
      usersConfig[msg.sender],
      reservesList,
      addressesProvider.getPriceOracle()
    );

    usersConfig[msg.sender].setUsingAsCollateral(reserve.index, _useAsCollateral);

    if (_useAsCollateral) {
      emit ReserveUsedAsCollateralEnabled(_reserve, msg.sender);
    } else {
      emit ReserveUsedAsCollateralDisabled(_reserve, msg.sender);
    }
  }

  /**
   * @dev users can invoke this function to liquidate an undercollateralized position.
   * @param _reserve the address of the collateral to liquidated
   * @param _reserve the address of the principal reserve
   * @param _user the address of the borrower
   * @param _purchaseAmount the amount of principal that the liquidator wants to repay
   * @param _receiveAToken true if the liquidators wants to receive the aTokens, false if
   * he wants to receive the underlying asset directly
   **/
  function liquidationCall(
    address _collateral,
    address _reserve,
    address _user,
    uint256 _purchaseAmount,
    bool _receiveAToken
  ) external payable nonReentrant {
    address liquidationManager = addressesProvider.getLendingPoolLiquidationManager();

    //solium-disable-next-line
    (bool success, bytes memory result) = liquidationManager.delegatecall(
      abi.encodeWithSignature(
        'liquidationCall(address,address,address,uint256,bool)',
        _collateral,
        _reserve,
        _user,
        _purchaseAmount,
        _receiveAToken
      )
    );
    require(success, 'Liquidation call failed');

    (uint256 returnCode, string memory returnMessage) = abi.decode(result, (uint256, string));

    if (returnCode != 0) {
      //error found
      revert(string(abi.encodePacked(returnMessage)));
    }
  }

  /**
   * @dev allows smartcontracts to access the liquidity of the pool within one transaction,
   * as long as the amount taken plus a fee is returned. NOTE There are security concerns for developers of flashloan receiver contracts
   * that must be kept into consideration. For further details please visit https://developers.aave.com
   * @param _receiver The address of the contract receiving the funds. The receiver should implement the IFlashLoanReceiver interface.
   * @param _reserve the address of the principal reserve
   * @param _amount the amount requested for this flashloan
   **/
  function flashLoan(
    address _receiver,
    address _reserve,
    uint256 _amount,
    bytes memory _params
  ) public nonReentrant {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];

    address payable aTokenAddress = payable(reserve.aTokenAddress);

    //check that the reserve has enough available liquidity
    uint256 availableLiquidityBefore = IERC20(_reserve).balanceOf(aTokenAddress);

    //calculate amount fee
    uint256 amountFee = _amount.mul(FLASHLOAN_FEE_TOTAL).div(10000);

    require(
      availableLiquidityBefore >= _amount,
      'There is not enough liquidity available to borrow'
    );
    require(amountFee > 0, 'The requested amount is too small for a FlashLoan.');

    //get the FlashLoanReceiver instance
    IFlashLoanReceiver receiver = IFlashLoanReceiver(_receiver);

    address payable userPayable = address(uint160(_receiver));

    //transfer funds to the receiver
    AToken(aTokenAddress).transferUnderlyingTo(userPayable, _amount);

    //execute action of the receiver
    receiver.executeOperation(_reserve, aTokenAddress, _amount, amountFee, _params);

    //check that the actual balance of the core contract includes the returned amount
    uint256 availableLiquidityAfter = IERC20(_reserve).balanceOf(aTokenAddress);

    require(
      availableLiquidityAfter == availableLiquidityBefore.add(amountFee),
      'The actual balance of the protocol is inconsistent'
    );

    reserve.updateStateOnFlashLoan(_reserve, availableLiquidityBefore, amountFee);

    //solium-disable-next-line
    emit FlashLoan(_receiver, _reserve, _amount, amountFee, block.timestamp);
  }

  /**
   * @dev accessory functions to fetch data from the core contract
   **/

  function getReserveConfigurationData(address _reserve)
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
    )
  {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];

    return (
      reserve.configuration.getDecimals(),
      reserve.configuration.getLtv(),
      reserve.configuration.getLiquidationThreshold(),
      reserve.configuration.getLiquidationBonus(),
      reserve.interestRateStrategyAddress,
      reserve.configuration.getLtv() != 0,
      reserve.configuration.getBorrowingEnabled(),
      reserve.configuration.getStableRateBorrowingEnabled(),
      reserve.configuration.getActive(),
      reserve.configuration.getFrozen()
    );
  }

  function getReserveTokensAddresses(address _reserve)
    external
    view
    returns (
      address aTokenAddress,
      address stableDebtTokenAddress,
      address variableDebtTokenAddress
    )
  {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];

    return (
      reserve.aTokenAddress,
      reserve.stableDebtTokenAddress,
      reserve.variableDebtTokenAddress
    );
  }

  function getReserveData(address _reserve)
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
    )
  {
    ReserveLogic.ReserveData memory reserve = reserves[_reserve];
    return (
      IERC20(_reserve).balanceOf(reserve.aTokenAddress),
      IERC20(reserve.stableDebtTokenAddress).totalSupply(),
      IERC20(reserve.variableDebtTokenAddress).totalSupply(),
      reserve.currentLiquidityRate,
      reserve.currentVariableBorrowRate,
      reserve.currentStableBorrowRate,
      IStableDebtToken(reserve.stableDebtTokenAddress).getAverageStableRate(),
      reserve.lastLiquidityCumulativeIndex,
      reserve.lastVariableBorrowCumulativeIndex,
      reserve.lastUpdateTimestamp
    );
  }

  function getUserAccountData(address _user)
    external
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
      _user,
      reserves,
      usersConfig[_user],
      reservesList,
      addressesProvider.getPriceOracle()
    );

    availableBorrowsETH = GenericLogic.calculateAvailableBorrowsETH(
      totalCollateralETH,
      totalBorrowsETH,
      ltv
    );
  }

  function getUserReserveData(address _reserve, address _user)
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
    )
  {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];

    currentATokenBalance = IERC20(reserve.aTokenAddress).balanceOf(_user);
    (currentStableDebt, currentVariableDebt) = Helpers.getUserCurrentDebt(_user, reserve);
    (principalStableDebt, principalVariableDebt) = Helpers.getUserPrincipalDebt(_user, reserve);
    liquidityRate = reserve.currentLiquidityRate;
    stableBorrowRate = IStableDebtToken(reserve.stableDebtTokenAddress).getUserStableRate(_user);
    stableRateLastUpdated = IStableDebtToken(reserve.stableDebtTokenAddress).getUserLastUpdated(
      _user
    );
    usageAsCollateralEnabled = usersConfig[_user].isUsingAsCollateral(reserve.index);
    variableBorrowIndex = IVariableDebtToken(reserve.variableDebtTokenAddress).getUserIndex(_user);
  }

  function getReserves() external view returns (address[] memory) {
    return reservesList;
  }

  receive() external payable {
    revert();
  }

  /**
   * @dev initializes a reserve
   * @param _reserve the address of the reserve
   * @param _aTokenAddress the address of the overlying aToken contract
   * @param _interestRateStrategyAddress the address of the interest rate strategy contract
   **/
  function initReserve(
    address _reserve,
    address _aTokenAddress,
    address _stableDebtAddress,
    address _variableDebtAddress,
    address _interestRateStrategyAddress
  ) external onlyLendingPoolConfigurator {
    reserves[_reserve].init(
      _aTokenAddress,
      _stableDebtAddress,
      _variableDebtAddress,
      _interestRateStrategyAddress
    );
    addReserveToListInternal(_reserve);
  }

  /**
   * @dev updates the address of the interest rate strategy contract
   * @param _reserve the address of the reserve
   * @param _rateStrategyAddress the address of the interest rate strategy contract
   **/

  function setReserveInterestRateStrategyAddress(address _reserve, address _rateStrategyAddress)
    external
    onlyLendingPoolConfigurator
  {
    reserves[_reserve].interestRateStrategyAddress = _rateStrategyAddress;
  }

  function setConfiguration(address _reserve, uint256 _configuration)
    external
    onlyLendingPoolConfigurator
  {
    reserves[_reserve].configuration.data = _configuration;
  }

  function getConfiguration(address _reserve)
    external
    view
    returns (ReserveConfiguration.Map memory)
  {
    return reserves[_reserve].configuration;
  }

  /**
   * @notice internal functions
   **/

  /**
   * @dev adds a reserve to the array of the reserves address
   **/
  function addReserveToListInternal(address _reserve) internal {
    bool reserveAlreadyAdded = false;
    for (uint256 i = 0; i < reservesList.length; i++)
      if (reservesList[i] == _reserve) {
        reserveAlreadyAdded = true;
      }
    if (!reserveAlreadyAdded) {
      reserves[_reserve].index = uint8(reservesList.length);
      reservesList.push(_reserve);
    }
  }

  function getReserveNormalizedIncome(address _reserve) external view returns (uint256) {
    return reserves[_reserve].getNormalizedIncome();
  }

  function getReserveNormalizedVariableDebt(address _reserve) external view returns (uint256) {
    return reserves[_reserve].getNormalizedDebt();
  }

  function balanceDecreaseAllowed(
    address _reserve,
    address _user,
    uint256 _amount
  ) external view returns (bool) {
    return
      GenericLogic.balanceDecreaseAllowed(
        _reserve,
        _user,
        _amount,
        reserves,
        usersConfig[_user],
        reservesList,
        addressesProvider.getPriceOracle()
      );
  }
}
