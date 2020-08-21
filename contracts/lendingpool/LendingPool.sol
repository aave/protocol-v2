// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  VersionedInitializable
} from '../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IAToken} from '../tokenization/interfaces/IAToken.sol';
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
import {ILendingPool} from '../interfaces/ILendingPool.sol';

/**
 * @title LendingPool contract
 * @notice Implements the actions of the LendingPool, and exposes accessory methods to fetch the users and reserve data
 * @author Aave
 **/

contract LendingPool is ReentrancyGuard, VersionedInitializable, ILendingPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using ReserveLogic for ReserveLogic.ReserveData;
  using ReserveConfiguration for ReserveConfiguration.Map;
  using UserConfiguration for UserConfiguration.Map;
  using SafeERC20 for IERC20;

  //main configuration parameters
  uint256 public constant REBALANCE_DOWN_RATE_DELTA = (1e27) / 5;
  uint256 public constant MAX_STABLE_RATE_BORROW_SIZE_PERCENT = 25;
  uint256 public constant FLASHLOAN_FEE_TOTAL = 9;

  ILendingPoolAddressesProvider internal addressesProvider;

  mapping(address => ReserveLogic.ReserveData) internal _reserves;
  mapping(address => UserConfiguration.Map) internal _usersConfig;

  address[] internal reservesList;

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
   * @param provider the address of the LendingPoolAddressesProvider registry
   **/
  function initialize(ILendingPoolAddressesProvider provider) public initializer {
    addressesProvider = provider;
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
    uint16 referralCode
  ) external override nonReentrant {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    ValidationLogic.validateDeposit(reserve, amount);

    IAToken aToken = IAToken(reserve.aTokenAddress);

    bool isFirstDeposit = aToken.balanceOf(msg.sender) == 0;

    reserve.updateCumulativeIndexesAndTimestamp();
    reserve.updateInterestRates(asset, amount, 0);

    if (isFirstDeposit) {
      _usersConfig[msg.sender].setUsingAsCollateral(reserve.index, true);
    }

    //minting AToken to user 1:1 with the specific exchange rate
    aToken.mint(msg.sender, amount);

    //transfer to the aToken contract
    IERC20(asset).safeTransferFrom(msg.sender, address(aToken), amount);

    //solium-disable-next-line
    emit Deposit(asset, msg.sender, amount, referralCode);
  }

  /**
   * @dev withdraws the _reserves of _user.
   * @param asset the address of the reserve
   * @param amount the underlying amount to be redeemed
   **/
  function withdraw(address asset, uint256 amount) external override nonReentrant {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    IAToken aToken = IAToken(reserve.aTokenAddress);

    uint256 userBalance = aToken.balanceOf(msg.sender);

    uint256 amountToWithdraw = amount;

    //if amount is equal to uint(-1), the user wants to redeem everything
    if (amount == UINT_MAX_VALUE) {
      amountToWithdraw = userBalance;
    }

    ValidationLogic.validateWithdraw(
      asset,
      address(aToken),
      amountToWithdraw,
      userBalance,
      _reserves,
      _usersConfig[msg.sender],
      reservesList,
      addressesProvider.getPriceOracle()
    );

    reserve.updateCumulativeIndexesAndTimestamp();

    reserve.updateInterestRates(asset, 0, amountToWithdraw);

    if (amountToWithdraw == userBalance) {
      _usersConfig[msg.sender].setUsingAsCollateral(reserve.index, false);
    }

    aToken.burn(msg.sender, msg.sender, amountToWithdraw);

    //solium-disable-next-line
    emit Withdraw(asset, msg.sender, amount);
  }

  /**
   * @dev Allows users to borrow a specific amount of the reserve currency, provided that the borrower
   * already deposited enough collateral.
   * @param asset the address of the reserve
   * @param amount the amount to be borrowed
   * @param interestRateMode the interest rate mode at which the user wants to borrow. Can be 0 (STABLE) or 1 (VARIABLE)
   **/
  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referralCode
  ) external override nonReentrant {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];
    UserConfiguration.Map storage userConfig = _usersConfig[msg.sender];

    uint256 amountInETH = IPriceOracleGetter(addressesProvider.getPriceOracle())
      .getAssetPrice(asset)
      .mul(amount)
      .div(10**reserve.configuration.getDecimals()); //price is in ether

    ValidationLogic.validateBorrow(
      reserve,
      asset,
      amount,
      amountInETH,
      interestRateMode,
      MAX_STABLE_RATE_BORROW_SIZE_PERCENT,
      _reserves,
      _usersConfig[msg.sender],
      reservesList,
      addressesProvider.getPriceOracle()
    );

    //caching the current stable borrow rate
    uint256 userStableRate = reserve.currentStableBorrowRate;

    reserve.updateCumulativeIndexesAndTimestamp();

    if (ReserveLogic.InterestRateMode(interestRateMode) == ReserveLogic.InterestRateMode.STABLE) {
      IStableDebtToken(reserve.stableDebtTokenAddress).mint(msg.sender, amount, userStableRate);
    } else {
      IVariableDebtToken(reserve.variableDebtTokenAddress).mint(msg.sender, amount);
    }

    reserve.updateInterestRates(asset, 0, amount);

    if (!userConfig.isBorrowing(reserve.index)) {
      userConfig.setBorrowing(reserve.index, true);
    }

    //if we reached this point, we can transfer
    IAToken(reserve.aTokenAddress).transferUnderlyingTo(msg.sender, amount);

    emit Borrow(
      asset,
      msg.sender,
      amount,
      interestRateMode,
      ReserveLogic.InterestRateMode(interestRateMode) == ReserveLogic.InterestRateMode.STABLE
        ? userStableRate
        : reserve.currentVariableBorrowRate,
      referralCode
    );
  }

  /**
   * @notice repays a borrow on the specific reserve, for the specified amount (or for the whole amount, if uint256(-1) is specified).
   * @dev the target user is defined by _onBehalfOf. If there is no repayment on behalf of another account,
   * _onBehalfOf must be equal to msg.sender.
   * @param asset the address of the reserve on which the user borrowed
   * @param amount the amount to repay, or uint256(-1) if the user wants to repay everything
   * @param _onBehalfOf the address for which msg.sender is repaying.
   **/
  function repay(
    address asset,
    uint256 amount,
    uint256 _rateMode,
    address _onBehalfOf
  ) external override nonReentrant {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    (uint256 stableDebt, uint256 variableDebt) = Helpers.getUserCurrentDebt(_onBehalfOf, reserve);

    ReserveLogic.InterestRateMode rateMode = ReserveLogic.InterestRateMode(_rateMode);
    
    //default to max amount
    uint256 paybackAmount = rateMode == ReserveLogic.InterestRateMode.STABLE
      ? IERC20(reserve.stableDebtTokenAddress).balanceOf(_onBehalfOf)
      : IERC20(reserve.variableDebtTokenAddress).balanceOf(_onBehalfOf);

    if (amount != UINT_MAX_VALUE && amount < paybackAmount) {
      paybackAmount = amount;
    }

    ValidationLogic.validateRepay(
      reserve,
      amount,
      rateMode,
      _onBehalfOf,
      stableDebt,
      variableDebt
    );

    reserve.updateCumulativeIndexesAndTimestamp();

    //burns an equivalent amount of debt tokens
    if (rateMode == ReserveLogic.InterestRateMode.STABLE) {
      IStableDebtToken(reserve.stableDebtTokenAddress).burn(_onBehalfOf, paybackAmount);
    } else {
      IVariableDebtToken(reserve.variableDebtTokenAddress).burn(_onBehalfOf, paybackAmount);
    }

    reserve.updateInterestRates(asset, paybackAmount, 0);

    if (stableDebt.add(variableDebt).sub(paybackAmount) == 0) {
      _usersConfig[_onBehalfOf].setBorrowing(reserve.index, false);
    }

    IERC20(asset).safeTransferFrom(msg.sender, reserve.aTokenAddress, paybackAmount);

    emit Repay(asset, _onBehalfOf, msg.sender, paybackAmount);
  }

  /**
   * @dev borrowers can user this function to swap between stable and variable borrow rate modes.
   * @param asset the address of the reserve on which the user borrowed
   * @param _rateMode the rate mode that the user wants to swap
   **/
  function swapBorrowRateMode(address asset, uint256 _rateMode) external override nonReentrant {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    (uint256 stableDebt, uint256 variableDebt) = Helpers.getUserCurrentDebt(msg.sender, reserve);

    ReserveLogic.InterestRateMode rateMode = ReserveLogic.InterestRateMode(_rateMode);

    ValidationLogic.validateSwapRateMode(
      reserve,
      _usersConfig[msg.sender],
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

    reserve.updateInterestRates(asset, 0, 0);

    emit Swap(
      asset,
      msg.sender,
      //solium-disable-next-line
      block.timestamp
    );
  }

  /**
   * @dev rebalances the stable interest rate of a user if current liquidity rate > user stable rate.
   * this is regulated by Aave to ensure that the protocol is not abused, and the user is paying a fair
   * rate. Anyone can call this function.
   * @param asset the address of the reserve
   * @param _user the address of the user to be rebalanced
   **/
  function rebalanceStableBorrowRate(address asset, address _user) external override nonReentrant {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    IStableDebtToken stableDebtToken = IStableDebtToken(reserve.stableDebtTokenAddress);

    uint256 stableBorrowBalance = IERC20(address(stableDebtToken)).balanceOf(_user);

    // user must be borrowing on asset at a stable rate
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

    reserve.updateInterestRates(asset, 0, 0);

    emit RebalanceStableBorrowRate(asset, _user);

    return;
  }

  /**
   * @dev allows depositors to enable or disable a specific deposit as collateral.
   * @param asset the address of the reserve
   * @param _useAsCollateral true if the user wants to user the deposit as collateral, false otherwise.
   **/
  function setUserUseReserveAsCollateral(address asset, bool _useAsCollateral)
    external
    override
    nonReentrant
  {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    ValidationLogic.validateSetUseReserveAsCollateral(
      reserve,
      asset,
      _reserves,
      _usersConfig[msg.sender],
      reservesList,
      addressesProvider.getPriceOracle()
    );

    _usersConfig[msg.sender].setUsingAsCollateral(reserve.index, _useAsCollateral);

    if (_useAsCollateral) {
      emit ReserveUsedAsCollateralEnabled(asset, msg.sender);
    } else {
      emit ReserveUsedAsCollateralDisabled(asset, msg.sender);
    }
  }

  /**
   * @dev users can invoke this function to liquidate an undercollateralized position.
   * @param asset the address of the collateral to liquidated
   * @param asset the address of the principal reserve
   * @param _user the address of the borrower
   * @param _purchaseAmount the amount of principal that the liquidator wants to repay
   * @param _receiveAToken true if the liquidators wants to receive the aTokens, false if
   * he wants to receive the underlying asset directly
   **/
  function liquidationCall(
    address _collateral,
    address asset,
    address _user,
    uint256 _purchaseAmount,
    bool _receiveAToken
  ) external override nonReentrant {
    address liquidationManager = addressesProvider.getLendingPoolLiquidationManager();

    //solium-disable-next-line
    (bool success, bytes memory result) = liquidationManager.delegatecall(
      abi.encodeWithSignature(
        'liquidationCall(address,address,address,uint256,bool)',
        _collateral,
        asset,
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
   * @param receiverAddress The address of the contract receiving the funds. The receiver should implement the IFlashLoanReceiver interface.
   * @param asset the address of the principal reserve
   * @param amount the amount requested for this flashloan
   **/
  function flashLoan(
    address receiverAddress,
    address asset,
    uint256 amount,
    bytes calldata params
  ) external override nonReentrant {
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    address aTokenAddress = reserve.aTokenAddress;

    //check that the reserve has enough available liquidity
    uint256 availableLiquidityBefore = IERC20(asset).balanceOf(aTokenAddress);

    //calculate amount fee
    uint256 amountFee = amount.mul(FLASHLOAN_FEE_TOTAL).div(10000);

    require(
      availableLiquidityBefore >= amount,
      'There is not enough liquidity available to borrow'
    );
    require(amountFee > 0, 'The requested amount is too small for a FlashLoan.');

    //get the FlashLoanReceiver instance
    IFlashLoanReceiver receiver = IFlashLoanReceiver(receiverAddress);

    //transfer funds to the receiver
    IAToken(aTokenAddress).transferUnderlyingTo(receiverAddress, amount);

    //execute action of the receiver
    receiver.executeOperation(asset, aTokenAddress, amount, amountFee, params);

    //check that the actual balance of the core contract includes the returned amount
    uint256 availableLiquidityAfter = IERC20(asset).balanceOf(aTokenAddress);

    require(
      availableLiquidityAfter == availableLiquidityBefore.add(amountFee),
      'The actual balance of the protocol is inconsistent'
    );

       //compounding the cumulated interest
    reserve.updateCumulativeIndexesAndTimestamp();

    uint256 totalLiquidityBefore = availableLiquidityBefore
      .add(IERC20(reserve.variableDebtTokenAddress).totalSupply())
      .add(IERC20(reserve.stableDebtTokenAddress).totalSupply());

    //compounding the received fee into the reserve
    reserve.cumulateToLiquidityIndex(totalLiquidityBefore, amountFee);

    //refresh interest rates
    reserve.updateInterestRates(asset, amountFee, 0);

    //solium-disable-next-line
    emit FlashLoan(receiverAddress, asset, amount, amountFee);
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
    ReserveLogic.ReserveData memory reserve = _reserves[asset];
    return (
      IERC20(asset).balanceOf(reserve.aTokenAddress),
      IERC20(reserve.stableDebtTokenAddress).totalSupply(),
      IERC20(reserve.variableDebtTokenAddress).totalSupply(),
      reserve.currentLiquidityRate,
      reserve.currentVariableBorrowRate,
      reserve.currentStableBorrowRate,
      IStableDebtToken(reserve.stableDebtTokenAddress).getAverageStableRate(),
      reserve.lastLiquidityIndex,
      reserve.lastVariableBorrowIndex,
      reserve.lastUpdateTimestamp
    );
  }

  function getUserAccountData(address _user)
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
      _user,
      _reserves,
      _usersConfig[_user],
      reservesList,
      addressesProvider.getPriceOracle()
    );

    availableBorrowsETH = GenericLogic.calculateAvailableBorrowsETH(
      totalCollateralETH,
      totalBorrowsETH,
      ltv
    );
  }

  function getUserReserveData(address asset, address _user)
    external
    override
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
    ReserveLogic.ReserveData storage reserve = _reserves[asset];

    currentATokenBalance = IERC20(reserve.aTokenAddress).balanceOf(_user);
    (currentStableDebt, currentVariableDebt) = Helpers.getUserCurrentDebt(_user, reserve);
    (principalStableDebt, principalVariableDebt) = Helpers.getUserPrincipalDebt(_user, reserve);
    liquidityRate = reserve.currentLiquidityRate;
    stableBorrowRate = IStableDebtToken(reserve.stableDebtTokenAddress).getUserStableRate(_user);
    stableRateLastUpdated = IStableDebtToken(reserve.stableDebtTokenAddress).getUserLastUpdated(
      _user
    );
    usageAsCollateralEnabled = _usersConfig[_user].isUsingAsCollateral(reserve.index);
    variableBorrowIndex = IVariableDebtToken(reserve.variableDebtTokenAddress).getUserIndex(_user);
  }

  function getReserves() external override view returns (address[] memory) {
    return reservesList;
  }

  receive() external payable {
    revert();
  }

  /**
   * @dev initializes a reserve
   * @param asset the address of the reserve
   * @param _aTokenAddress the address of the overlying aToken contract
   * @param _interestRateStrategyAddress the address of the interest rate strategy contract
   **/
  function initReserve(
    address asset,
    address _aTokenAddress,
    address _stableDebtAddress,
    address _variableDebtAddress,
    address _interestRateStrategyAddress
  ) external override onlyLendingPoolConfigurator {
    _reserves[asset].init(
      _aTokenAddress,
      _stableDebtAddress,
      _variableDebtAddress,
      _interestRateStrategyAddress
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
    onlyLendingPoolConfigurator
  {
    _reserves[asset].interestRateStrategyAddress = rateStrategyAddress;
  }

  function setConfiguration(address asset, uint256 configuration)
    external
    override
    onlyLendingPoolConfigurator
  {
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
   * @notice internal functions
   **/

  /**
   * @dev adds a reserve to the array of the _reserves address
   **/
  function _addReserveToList(address asset) internal {
    bool reserveAlreadyAdded = false;
    for (uint256 i = 0; i < reservesList.length; i++)
      if (reservesList[i] == asset) {
        reserveAlreadyAdded = true;
      }
    if (!reserveAlreadyAdded) {
      _reserves[asset].index = uint8(reservesList.length);
      reservesList.push(asset);
    }
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
        reservesList,
        addressesProvider.getPriceOracle()
      );
  }

  /**
   * @dev returns the list of the initialized reserves
   **/
  function getReservesList() external view returns (address[] memory) {
    return reservesList;
  }

  /**
   * @dev returns the addresses provider
   **/
  function getAddressesProvider() external view returns (ILendingPoolAddressesProvider) {
    return addressesProvider;
  }
}
