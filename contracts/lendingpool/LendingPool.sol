// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';

import '../configuration/LendingPoolAddressesProvider.sol';
import '../tokenization/AToken.sol';
import '../libraries/WadRayMath.sol';
import '../libraries/ReserveLogic.sol';
import '../libraries/UserLogic.sol';
import '../libraries/GenericLogic.sol';
import '../libraries/ValidationLogic.sol';
import '../libraries/UniversalERC20.sol';
import '../tokenization/interfaces/IStableDebtToken.sol';
import '../tokenization/interfaces/IVariableDebtToken.sol';

import '../interfaces/IFeeProvider.sol';
import '../flashloan/interfaces/IFlashLoanReceiver.sol';
import './LendingPoolLiquidationManager.sol';
import '../interfaces/IPriceOracleGetter.sol';
import '@nomiclabs/buidler/console.sol';

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
  using UserLogic for UserLogic.UserReserveData;

  //main configuration parameters
  uint256 private constant REBALANCE_DOWN_RATE_DELTA = (1e27) / 5;
  uint256 private constant MAX_STABLE_RATE_BORROW_SIZE_PERCENT = 25;
  uint256 private constant FLASHLOAN_FEE_TOTAL = 9;
  uint256 private constant FLASHLOAN_FEE_PROTOCOL = 3000;

  LendingPoolAddressesProvider public addressesProvider;
  IFeeProvider feeProvider;
  using UniversalERC20 for IERC20;

  mapping(address => ReserveLogic.ReserveData) internal reserves;
  mapping(address => mapping(address => UserLogic.UserReserveData)) internal usersReserveData;

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
   * @dev emitted during a redeem action.
   * @param _reserve the address of the reserve
   * @param _user the address of the user
   * @param _amount the amount to be deposited
   * @param _timestamp the timestamp of the action
   **/
  event RedeemUnderlying(
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
   * @param _protocolFee the part of the fee for the protocol
   * @param _timestamp the timestamp of the action
   **/
  event FlashLoan(
    address indexed _target,
    address indexed _reserve,
    uint256 _amount,
    uint256 _totalFee,
    uint256 _protocolFee,
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
    feeProvider = IFeeProvider(addressesProvider.getFeeProvider());
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
    UserLogic.UserReserveData storage user = usersReserveData[msg.sender][_reserve];

    ValidationLogic.validateDeposit(reserve, _amount);

    AToken aToken = AToken(payable(reserve.aTokenAddress));

    bool isFirstDeposit = aToken.balanceOf(msg.sender) == 0;

    reserve.updateCumulativeIndexesAndTimestamp();
    reserve.updateInterestRates(_reserve, _amount, 0);

    if (isFirstDeposit) {
      user.useAsCollateral = true;
    }

    //minting AToken to user 1:1 with the specific exchange rate
    aToken.mintOnDeposit(msg.sender, _amount);

    //transfer to the aToken contract
    IERC20(_reserve).universalTransferFrom(msg.sender, address(aToken), _amount, true);

    //solium-disable-next-line
    emit Deposit(_reserve, msg.sender, _amount, _referralCode, block.timestamp);
  }

  /**
   * @dev Redeems the underlying amount of assets requested by _user.
   * This function is executed by the overlying aToken contract in response to a redeem action.
   * @param _reserve the address of the reserve
   * @param _user the address of the user performing the action
   * @param _amount the underlying amount to be redeemed
   **/
  function redeemUnderlying(
    address _reserve,
    address payable _user,
    uint256 _amount,
    uint256 _aTokenBalanceAfterRedeem
  ) external nonReentrant {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];
    UserLogic.UserReserveData storage user = usersReserveData[_user][_reserve];

    AToken aToken = AToken(payable(reserve.aTokenAddress));

    ValidationLogic.validateRedeem(reserve, _reserve, _amount);

    reserve.updateCumulativeIndexesAndTimestamp();

    reserve.updateInterestRates(_reserve, 0, _amount);

    if (_aTokenBalanceAfterRedeem == 0) {
      user.useAsCollateral = false;
    }

    AToken(reserve.aTokenAddress).transferUnderlyingTo(_user, _amount);

    //solium-disable-next-line
    emit RedeemUnderlying(_reserve, _user, _amount, block.timestamp);
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
    UserLogic.UserReserveData storage user = usersReserveData[msg.sender][_reserve];

    uint256 amountInETH = IPriceOracleGetter(addressesProvider.getPriceOracle())
      .getAssetPrice(_reserve)
      .mul(_amount)
      .div(10**reserve.decimals); //price is in ether

    ValidationLogic.validateBorrow(
      reserve,
      user,
      _reserve,
      _amount,
      amountInETH,
      _interestRateMode,
      MAX_STABLE_RATE_BORROW_SIZE_PERCENT,
      reserves,
      usersReserveData,
      reservesList,
      addressesProvider.getPriceOracle()
    );

    //borrow passed
    reserve.updateCumulativeIndexesAndTimestamp();

    //solium-disable-next-line
    reserve.lastUpdateTimestamp = uint40(block.timestamp);

    uint256 userStableRate = reserve.currentStableBorrowRate;

    if (ReserveLogic.InterestRateMode(_interestRateMode) == ReserveLogic.InterestRateMode.STABLE) {
      IStableDebtToken(reserve.stableDebtTokenAddress).mint(msg.sender, _amount, userStableRate);
      uint40 stableRateLastUpdated = IStableDebtToken(reserve.stableDebtTokenAddress)
        .getUserLastUpdated(msg.sender);
    } else {
      IVariableDebtToken(reserve.variableDebtTokenAddress).mint(msg.sender, _amount);
    }

    reserve.updateInterestRates(_reserve, 0, _amount);

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

  /**
   * @notice repays a borrow on the specific reserve, for the specified amount (or for the whole amount, if uint256(-1) is specified).
   * @dev the target user is defined by _onBehalfOf. If there is no repayment on behalf of another account,
   * _onBehalfOf must be equal to msg.sender.
   * @param _reserve the address of the reserve on which the user borrowed
   * @param _amount the amount to repay, or uint256(-1) if the user wants to repay everything
   * @param _onBehalfOf the address for which msg.sender is repaying.
   **/

  struct RepayLocalVars {
    uint256 stableDebt;
    uint256 variableDebt;
    uint256 paybackAmount;
    uint256 currentStableRate;
  }

  function repay(
    address _reserve,
    uint256 _amount,
    uint256 _rateMode,
    address payable _onBehalfOf
  ) external payable nonReentrant {
    RepayLocalVars memory vars;
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];
    UserLogic.UserReserveData storage user = usersReserveData[_onBehalfOf][_reserve];

    (vars.stableDebt, vars.variableDebt) = UserLogic.getUserCurrentDebt(_onBehalfOf, reserve);

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

    IERC20(_reserve).universalTransferFrom(
      msg.sender,
      reserve.aTokenAddress,
      vars.paybackAmount,
      false
    );

    if (IERC20(_reserve).isETH()) {
      //send excess ETH back to the caller if needed
      uint256 exceedAmount = msg.value.sub(vars.paybackAmount);

      if (exceedAmount > 0) {
        IERC20(_reserve).universalTransfer(msg.sender, exceedAmount);
      }
    }

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
    UserLogic.UserReserveData storage user = usersReserveData[msg.sender][_reserve];

    (uint256 stableDebt, uint256 variableDebt) = UserLogic.getUserCurrentDebt(msg.sender, reserve);

    ReserveLogic.InterestRateMode rateMode = ReserveLogic.InterestRateMode(_rateMode);

    ValidationLogic.validateSwapRateMode(reserve, user, stableDebt, variableDebt, rateMode);

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
    UserLogic.UserReserveData storage user = usersReserveData[msg.sender][_reserve];

    ValidationLogic.validateSetUseReserveAsCollateral(
      reserve,
      _reserve,
      reserves,
      usersReserveData,
      reservesList,
      addressesProvider.getPriceOracle()
    );

    user.useAsCollateral = _useAsCollateral;

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

  struct FlashLoanLocalVars {
    uint256 availableLiquidityBefore;
    uint256 totalFeeBips;
    uint256 protocolFeeBips;
    uint256 amountFee;
    uint256 protocolFee;
    address payable aTokenAddress;
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
    FlashLoanLocalVars memory vars;

    ReserveLogic.ReserveData storage reserve = reserves[_reserve];

    vars.aTokenAddress = payable(reserve.aTokenAddress);

    //check that the reserve has enough available liquidity
    vars.availableLiquidityBefore = IERC20(_reserve).universalBalanceOf(vars.aTokenAddress);

    //calculate amount fee
    vars.amountFee = _amount.mul(FLASHLOAN_FEE_TOTAL).div(10000);

    //protocol fee is the part of the amountFee reserved for the protocol - the rest goes to depositors
    vars.protocolFee = vars.amountFee.mul(FLASHLOAN_FEE_PROTOCOL).div(10000);

    require(
      vars.availableLiquidityBefore >= _amount,
      'There is not enough liquidity available to borrow'
    );
    require(
      vars.amountFee > 0 && vars.protocolFee > 0,
      'The requested amount is too small for a FlashLoan.'
    );

    //get the FlashLoanReceiver instance
    IFlashLoanReceiver receiver = IFlashLoanReceiver(_receiver);

    address payable userPayable = address(uint160(_receiver));

    //transfer funds to the receiver
    AToken(vars.aTokenAddress).transferUnderlyingTo(userPayable, _amount);

    //execute action of the receiver
    receiver.executeOperation(_reserve, vars.aTokenAddress, _amount, vars.amountFee, _params);

    //check that the actual balance of the core contract includes the returned amount
    uint256 availableLiquidityAfter = IERC20(_reserve).universalBalanceOf(vars.aTokenAddress);

    require(
      availableLiquidityAfter == vars.availableLiquidityBefore.add(vars.amountFee),
      'The actual balance of the protocol is inconsistent'
    );

    reserve.updateStateOnFlashLoan(
      _reserve,
      vars.availableLiquidityBefore,
      vars.amountFee.sub(vars.protocolFee),
      vars.protocolFee
    );

    //transfer funds to the receiver
    AToken(vars.aTokenAddress).transferUnderlyingTo(
      addressesProvider.getTokenDistributor(),
      vars.protocolFee
    );

    //solium-disable-next-line
    emit FlashLoan(_receiver, _reserve, _amount, vars.amountFee, vars.protocolFee, block.timestamp);
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
      reserve.decimals,
      reserve.baseLTVasCollateral,
      reserve.liquidationThreshold,
      reserve.liquidationBonus,
      reserve.interestRateStrategyAddress,
      reserve.usageAsCollateralEnabled,
      reserve.borrowingEnabled,
      reserve.isStableBorrowRateEnabled,
      reserve.isActive,
      reserve.isFreezed
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
      IERC20(_reserve).universalBalanceOf(reserve.aTokenAddress),
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
      uint256 totalFeesETH,
      uint256 availableBorrowsETH,
      uint256 currentLiquidationThreshold,
      uint256 ltv,
      uint256 healthFactor
    )
  {
    (
      totalCollateralETH,
      totalBorrowsETH,
      totalFeesETH,
      ltv,
      currentLiquidationThreshold,
      healthFactor
    ) = GenericLogic.calculateUserAccountData(
      _user,
      reserves,
      usersReserveData,
      reservesList,
      addressesProvider.getPriceOracle()
    );

    availableBorrowsETH = GenericLogic.calculateAvailableBorrowsETH(
      totalCollateralETH,
      totalBorrowsETH,
      totalFeesETH,
      ltv,
      address(feeProvider)
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
    (currentStableDebt, currentVariableDebt) = UserLogic.getUserCurrentDebt(_user, reserve);
    (principalStableDebt, principalVariableDebt) = UserLogic.getUserPrincipalDebt(_user, reserve);
    liquidityRate = reserve.currentLiquidityRate;
    stableBorrowRate = IStableDebtToken(reserve.stableDebtTokenAddress).getUserStableRate(_user);
    stableRateLastUpdated = IStableDebtToken(reserve.stableDebtTokenAddress).getUserLastUpdated(
      _user
    );
    usageAsCollateralEnabled = usersReserveData[_user][_reserve].useAsCollateral;
    variableBorrowIndex = IVariableDebtToken(reserve.variableDebtTokenAddress).getUserIndex(_user);
  }

  function getReserves() external view returns (address[] memory) {
    return reservesList;
  }

  receive() external payable {
    //only contracts can send ETH to the core
    require(msg.sender.isContract(), '22');
  }

  /**
   * @dev initializes a reserve
   * @param _reserve the address of the reserve
   * @param _aTokenAddress the address of the overlying aToken contract
   * @param _decimals the decimals of the reserve currency
   * @param _interestRateStrategyAddress the address of the interest rate strategy contract
   **/
  function initReserve(
    address _reserve,
    address _aTokenAddress,
    address _stableDebtAddress,
    address _variableDebtAddress,
    uint256 _decimals,
    address _interestRateStrategyAddress
  ) external onlyLendingPoolConfigurator {
    reserves[_reserve].init(
      _aTokenAddress,
      _stableDebtAddress,
      _variableDebtAddress,
      _decimals,
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

  /**
   * @dev enables borrowing on a reserve. Also sets the stable rate borrowing
   * @param _reserve the address of the reserve
   * @param _stableBorrowRateEnabled true if the stable rate needs to be enabled, false otherwise
   **/

  function setReserveBorrowingEnabled(
    address _reserve,
    bool _borrowingEnabled,
    bool _stableBorrowRateEnabled
  ) external onlyLendingPoolConfigurator {
    if (_borrowingEnabled) {
      reserves[_reserve].enableBorrowing(_stableBorrowRateEnabled);
    } else {
      reserves[_reserve].disableBorrowing();
    }
  }

  /**
   * @dev enables a reserve to be used as collateral
   * @param _reserve the address of the reserve
   **/
  function enableReserveAsCollateral(
    address _reserve,
    uint256 _baseLTVasCollateral,
    uint256 _liquidationThreshold,
    uint256 _liquidationBonus
  ) external onlyLendingPoolConfigurator {
    reserves[_reserve].enableAsCollateral(
      _baseLTVasCollateral,
      _liquidationThreshold,
      _liquidationBonus
    );
  }

  /**
   * @dev disables a reserve to be used as collateral
   * @param _reserve the address of the reserve
   **/
  function disableReserveAsCollateral(address _reserve) external onlyLendingPoolConfigurator {
    reserves[_reserve].disableAsCollateral();
  }

  /**
   * @dev enable the stable borrow rate mode on a reserve
   * @param _reserve the address of the reserve
   **/
  function setReserveStableBorrowRateEnabled(address _reserve, bool _enabled)
    external
    onlyLendingPoolConfigurator
  {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];
    reserve.isStableBorrowRateEnabled = _enabled;
  }

  /**
   * @dev activates a reserve
   * @param _reserve the address of the reserve
   **/
  function setReserveActive(address _reserve, bool _active) external onlyLendingPoolConfigurator {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];

    if (!_active) {
      reserve.isActive = false;
    } else {
      require(
        reserve.lastLiquidityCumulativeIndex > 0 && reserve.lastVariableBorrowCumulativeIndex > 0,
        'Reserve has not been initialized yet'
      );
      reserve.isActive = true;
    }
  }

  /**
   * @notice allows the configurator to freeze the reserve.
   * A freezed reserve does not allow any action apart from repay, redeem, liquidationCall, rebalance.
   * @param _reserve the address of the reserve
   **/
  function setReserveFreeze(address _reserve, bool _isFreezed)
    external
    onlyLendingPoolConfigurator
  {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];
    reserve.isFreezed = _isFreezed;
  }

  /**
   * @notice allows the configurator to update the loan to value of a reserve
   * @param _reserve the address of the reserve
   * @param _ltv the new loan to value
   **/
  function setReserveBaseLTVasCollateral(address _reserve, uint256 _ltv)
    external
    onlyLendingPoolConfigurator
  {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];
    reserve.baseLTVasCollateral = _ltv;
  }

  /**
   * @notice allows the configurator to update the liquidation threshold of a reserve
   * @param _reserve the address of the reserve
   * @param _threshold the new liquidation threshold
   **/
  function setReserveLiquidationThreshold(address _reserve, uint256 _threshold)
    external
    onlyLendingPoolConfigurator
  {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];
    reserve.liquidationThreshold = _threshold;
  }

  /**
   * @notice allows the configurator to update the liquidation bonus of a reserve
   * @param _reserve the address of the reserve
   * @param _bonus the new liquidation bonus
   **/
  function setReserveLiquidationBonus(address _reserve, uint256 _bonus)
    external
    onlyLendingPoolConfigurator
  {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];
    reserve.liquidationBonus = _bonus;
  }

  /**
   * @notice allows the configurator to update the reserve decimals
   * @param _reserve the address of the reserve
   * @param _decimals the decimals of the reserve
   **/
  function setReserveDecimals(address _reserve, uint256 _decimals)
    external
    onlyLendingPoolConfigurator
  {
    ReserveLogic.ReserveData storage reserve = reserves[_reserve];
    reserve.decimals = _decimals;
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
    if (!reserveAlreadyAdded) reservesList.push(_reserve);
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
        usersReserveData,
        reservesList,
        addressesProvider.getPriceOracle()
      );
  }
}
