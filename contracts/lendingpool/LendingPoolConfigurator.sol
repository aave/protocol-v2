// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {VersionedInitializable} from '../libraries/aave-upgradeability/VersionedInitializable.sol';
import {
  InitializableImmutableAdminUpgradeabilityProxy
} from '../libraries/aave-upgradeability/InitializableImmutableAdminUpgradeabilityProxy.sol';
import {ReserveConfiguration} from '../libraries/configuration/ReserveConfiguration.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {ITokenConfiguration} from '../tokenization/interfaces/ITokenConfiguration.sol';
import {IERC20Detailed} from '../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {Errors} from '../libraries/helpers/Errors.sol';
import {PercentageMath} from '../libraries/math/PercentageMath.sol';
import {ReserveLogic} from '../libraries/logic/ReserveLogic.sol';

/**
 * @title LendingPoolConfigurator contract
 * @author Aave
 * @notice Executes configuration methods on the LendingPoolCore contract. Allows to enable/disable reserves
 * and set different protocol parameters.
 **/

contract LendingPoolConfigurator is VersionedInitializable {
  using SafeMath for uint256;
  using ReserveConfiguration for ReserveConfiguration.Map;

  /**
   * @dev emitted when a reserve is initialized.
   * @param asset the address of the reserve
   * @param aToken the address of the overlying aToken contract
   * @param stableDebtToken the address of the associated stable rate debt token
   * @param variableDebtToken the address of the associated variable rate debt token
   * @param interestRateStrategyAddress the address of the interest rate strategy for the reserve
   **/
  event ReserveInitialized(
    address indexed asset,
    address indexed aToken,
    address stableDebtToken,
    address variableDebtToken,
    address interestRateStrategyAddress
  );

  /**
   * @dev emitted when borrowing is enabled on a reserve
   * @param asset the address of the reserve
   * @param stableRateEnabled true if stable rate borrowing is enabled, false otherwise
   **/
  event BorrowingEnabledOnReserve(address indexed asset, bool stableRateEnabled);

  /**
   * @dev emitted when borrowing is disabled on a reserve
   * @param asset the address of the reserve
   **/
  event BorrowingDisabledOnReserve(address indexed asset);

  /**
   * @dev emitted when a a reserve collateralization risk parameters are updated.
   * @param asset the address of the reserve
   * @param ltv the loan to value of the asset when used as collateral
   * @param liquidationThreshold the threshold at which loans using this asset as collateral will be considered undercollateralized
   * @param liquidationBonus the bonus liquidators receive to liquidate this asset
   **/
  event CollateralConfigurationChanged(
    address indexed asset,
    uint256 ltv,
    uint256 liquidationThreshold,
    uint256 liquidationBonus
  );

  /**
   * @dev emitted when stable rate borrowing is enabled on a reserve
   * @param asset the address of the reserve
   **/
  event StableRateEnabledOnReserve(address indexed asset);

  /**
   * @dev emitted when stable rate borrowing is disabled on a reserve
   * @param asset the address of the reserve
   **/
  event StableRateDisabledOnReserve(address indexed asset);

  /**
   * @dev emitted when a reserve is activated
   * @param asset the address of the reserve
   **/
  event ReserveActivated(address indexed asset);

  /**
   * @dev emitted when a reserve is deactivated
   * @param asset the address of the reserve
   **/
  event ReserveDeactivated(address indexed asset);

  /**
   * @dev emitted when a reserve is frozen
   * @param asset the address of the reserve
   **/
  event ReserveFrozen(address indexed asset);

  /**
   * @dev emitted when a reserve is unfrozen
   * @param asset the address of the reserve
   **/
  event ReserveUnfrozen(address indexed asset);
 
  /**
   * @dev emitted when a reserve factor is updated
   * @param asset the address of the reserve
   * @param factor the new reserve factor
   **/
  event ReserveFactorChanged(address indexed asset, uint256 factor);
 
  /**
   * @dev emitted when the reserve decimals are updated
   * @param asset the address of the reserve
   * @param decimals the new decimals
   **/
  event ReserveDecimalsChanged(address indexed asset, uint256 decimals);

  /**
   * @dev emitted when a reserve interest strategy contract is updated
   * @param asset the address of the reserve
   * @param strategy the new address of the interest strategy contract
   **/
  event ReserveInterestRateStrategyChanged(address indexed asset, address strategy);

  /**
   * @dev emitted when an aToken implementation is upgraded
   * @param asset the address of the reserve
   * @param proxy the aToken proxy address
   * @param implementation the new aToken implementation
   **/
  event ATokenUpgraded(
    address indexed asset,
    address indexed proxy,
    address indexed implementation
  );

  /**
   * @dev emitted when the implementation of a stable debt token is upgraded
   * @param asset the address of the reserve
   * @param proxy the stable debt token proxy address
   * @param implementation the new aToken implementation
   **/
  event StableDebtTokenUpgraded(
    address indexed asset,
    address indexed proxy,
    address indexed implementation
  );

  /**
   * @dev emitted when the implementation of a variable debt token is upgraded
   * @param asset the address of the reserve
   * @param proxy the variable debt token proxy address
   * @param implementation the new aToken implementation
   **/
  event VariableDebtTokenUpgraded(
    address indexed asset,
    address indexed proxy,
    address indexed implementation
  );

  ILendingPoolAddressesProvider internal addressesProvider;
  ILendingPool internal pool;

  /**
   * @dev only the pool admin can call functions affected by this modifier
   **/
  modifier onlyPoolAdmin {
    require(addressesProvider.getPoolAdmin() == msg.sender, Errors.CALLER_NOT_POOL_ADMIN);
    _;
  }

  /**
   * @dev only the emergency admin can call functions affected by this modifier
   **/
  modifier onlyEmergencyAdmin {
    require(
      addressesProvider.getEmergencyAdmin() == msg.sender,
      Errors.LPC_CALLER_NOT_EMERGENCY_ADMIN
    );
    _;
  }

  uint256 internal constant CONFIGURATOR_REVISION = 0x3;

  function getRevision() internal override pure returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  function initialize(ILendingPoolAddressesProvider provider) public initializer {
    addressesProvider = provider;
    pool = ILendingPool(addressesProvider.getLendingPool());
  }

  /**
   * @dev initializes a reserve
   * @param aTokenImpl  the address of the aToken contract implementation
   * @param stableDebtTokenImpl the address of the stable debt token contract
   * @param variableDebtTokenImpl the address of the variable debt token contract
   * @param underlyingAssetDecimals the decimals of the reserve underlying asset
   * @param interestRateStrategyAddress the address of the interest rate strategy contract for this reserve
   **/
  function initReserve(
    address aTokenImpl,
    address stableDebtTokenImpl,
    address variableDebtTokenImpl,
    uint8 underlyingAssetDecimals,
    address interestRateStrategyAddress
  ) public onlyPoolAdmin {
    address asset = ITokenConfiguration(aTokenImpl).UNDERLYING_ASSET_ADDRESS();

    require(
      address(pool) == ITokenConfiguration(aTokenImpl).POOL(),
      Errors.LPC_INVALID_ATOKEN_POOL_ADDRESS
    );
    require(
      address(pool) == ITokenConfiguration(stableDebtTokenImpl).POOL(),
      Errors.LPC_INVALID_STABLE_DEBT_TOKEN_POOL_ADDRESS
    );
    require(
      address(pool) == ITokenConfiguration(variableDebtTokenImpl).POOL(),
      Errors.LPC_INVALID_VARIABLE_DEBT_TOKEN_POOL_ADDRESS
    );
    require(
      asset == ITokenConfiguration(stableDebtTokenImpl).UNDERLYING_ASSET_ADDRESS(),
      Errors.LPC_INVALID_STABLE_DEBT_TOKEN_UNDERLYING_ADDRESS
    );
    require(
      asset == ITokenConfiguration(variableDebtTokenImpl).UNDERLYING_ASSET_ADDRESS(),
      Errors.LPC_INVALID_VARIABLE_DEBT_TOKEN_UNDERLYING_ADDRESS
    );

    address aTokenProxyAddress = _initTokenWithProxy(aTokenImpl, underlyingAssetDecimals);

    address stableDebtTokenProxyAddress = _initTokenWithProxy(
      stableDebtTokenImpl,
      underlyingAssetDecimals
    );

    address variableDebtTokenProxyAddress = _initTokenWithProxy(
      variableDebtTokenImpl,
      underlyingAssetDecimals
    );

    pool.initReserve(
      asset,
      aTokenProxyAddress,
      stableDebtTokenProxyAddress,
      variableDebtTokenProxyAddress,
      interestRateStrategyAddress
    );

    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setDecimals(underlyingAssetDecimals);

    currentConfig.setActive(true);
    currentConfig.setFrozen(false);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveInitialized(
      asset,
      aTokenProxyAddress,
      stableDebtTokenProxyAddress,
      variableDebtTokenProxyAddress,
      interestRateStrategyAddress
    );
  }

  /**
   * @dev updates the aToken implementation for the asset
   * @param asset the address of the reserve to be updated
   * @param implementation the address of the new aToken implementation
   **/
  function updateAToken(address asset, address implementation) external onlyPoolAdmin {
    ReserveLogic.ReserveData memory reserveData = pool.getReserveData(asset);

    _upgradeTokenImplementation(asset, reserveData.aTokenAddress, implementation);

    emit ATokenUpgraded(asset, reserveData.aTokenAddress, implementation);
  }

  /**
   * @dev updates the stable debt token implementation for the asset
   * @param asset the address of the reserve to be updated
   * @param implementation the address of the new aToken implementation
   **/
  function updateStableDebtToken(address asset, address implementation) external onlyPoolAdmin {
    ReserveLogic.ReserveData memory reserveData = pool.getReserveData(asset);

    _upgradeTokenImplementation(asset, reserveData.stableDebtTokenAddress, implementation);

    emit StableDebtTokenUpgraded(asset, reserveData.stableDebtTokenAddress, implementation);
  }

  /**
   * @dev updates the variable debt token implementation for the asset
   * @param asset the address of the reserve to be updated
   * @param implementation the address of the new aToken implementation
   **/
  function updateVariableDebtToken(address asset, address implementation) external onlyPoolAdmin {
    ReserveLogic.ReserveData memory reserveData = pool.getReserveData(asset);

    _upgradeTokenImplementation(asset, reserveData.variableDebtTokenAddress, implementation);

    emit VariableDebtTokenUpgraded(asset, reserveData.variableDebtTokenAddress, implementation);
  }

  /**
   * @dev enables borrowing on a reserve
   * @param asset the address of the reserve
   * @param stableBorrowRateEnabled true if stable borrow rate needs to be enabled by default on this reserve
   **/
  function enableBorrowingOnReserve(address asset, bool stableBorrowRateEnabled)
    external
    onlyPoolAdmin
  {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setBorrowingEnabled(true);
    currentConfig.setStableRateBorrowingEnabled(stableBorrowRateEnabled);

    pool.setConfiguration(asset, currentConfig.data);

    emit BorrowingEnabledOnReserve(asset, stableBorrowRateEnabled);
  }

  /**
   * @dev disables borrowing on a reserve
   * @param asset the address of the reserve
   **/
  function disableBorrowingOnReserve(address asset) external onlyPoolAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setBorrowingEnabled(false);

    pool.setConfiguration(asset, currentConfig.data);
    emit BorrowingDisabledOnReserve(asset);
  }

  /**
   * @dev configures the reserve collateralization parameters.
   * all the values are expressed in percentages with two decimals of precision. A valid value is 10000, which means 100.00%
   * @param asset the address of the reserve
   * @param ltv the loan to value of the asset when used as collateral
   * @param liquidationThreshold the threshold at which loans using this asset as collateral will be considered undercollateralized
   * @param liquidationBonus the bonus liquidators receive to liquidate this asset. The values is always above 100%. A value of 105%
   * means the liquidator will receive a 5% bonus
   **/
  function configureReserveAsCollateral(
    address asset,
    uint256 ltv,
    uint256 liquidationThreshold,
    uint256 liquidationBonus
  ) external onlyPoolAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    //validation of the parameters: the LTV can
    //only be lower or equal than the liquidation threshold
    //(otherwise a loan against the asset would cause instantaneous liquidation)
    require(ltv <= liquidationThreshold, Errors.LPC_INVALID_CONFIGURATION);

    if (liquidationThreshold != 0) {
      //liquidation bonus must be bigger than 100.00%, otherwise the liquidator would receive less
      //collateral than needed to cover the debt.
      uint256 absoluteBonus = liquidationBonus.sub(PercentageMath.PERCENTAGE_FACTOR, Errors.LPC_INVALID_CONFIGURATION);
      require(absoluteBonus > 0, Errors.LPC_INVALID_CONFIGURATION);

      //we also need to require that the liq threshold is lower or equal than the liquidation bonus, to ensure that
      //there is always enough margin for liquidators to receive the bonus.
      require(liquidationThreshold.add(absoluteBonus) <= PercentageMath.PERCENTAGE_FACTOR, Errors.LPC_INVALID_CONFIGURATION);

    } else {
      require(liquidationBonus == 0, Errors.LPC_INVALID_CONFIGURATION);
      //if the liquidation threshold is being set to 0,
      // the reserve is being disabled as collateral. To do so,
      //we need to ensure no liquidity is deposited
      _checkNoLiquidity(asset);
    }

    currentConfig.setLtv(ltv);
    currentConfig.setLiquidationThreshold(liquidationThreshold);
    currentConfig.setLiquidationBonus(liquidationBonus);

    pool.setConfiguration(asset, currentConfig.data);

    emit CollateralConfigurationChanged(asset, ltv, liquidationThreshold, liquidationBonus);
  }

  /**
   * @dev enable stable rate borrowing on a reserve
   * @param asset the address of the reserve
   **/
  function enableReserveStableRate(address asset) external onlyPoolAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setStableRateBorrowingEnabled(true);

    pool.setConfiguration(asset, currentConfig.data);

    emit StableRateEnabledOnReserve(asset);
  }

  /**
   * @dev disable stable rate borrowing on a reserve
   * @param asset the address of the reserve
   **/
  function disableReserveStableRate(address asset) external onlyPoolAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setStableRateBorrowingEnabled(false);

    pool.setConfiguration(asset, currentConfig.data);

    emit StableRateDisabledOnReserve(asset);
  }

  /**
   * @dev activates a reserve
   * @param asset the address of the reserve
   **/
  function activateReserve(address asset) external onlyPoolAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setActive(true);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveActivated(asset);
  }

  /**
   * @dev deactivates a reserve
   * @param asset the address of the reserve
   **/
  function deactivateReserve(address asset) external onlyPoolAdmin {
    _checkNoLiquidity(asset);

    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setActive(false);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveDeactivated(asset);
  }

  /**
   * @dev freezes a reserve. A frozen reserve doesn't accept any new deposit, borrow or rate swap, but can accept repayments, liquidations, rate rebalances and redeems
   * @param asset the address of the reserve
   **/
  function freezeReserve(address asset) external onlyPoolAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setFrozen(true);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveFrozen(asset);
  }

  /**
   * @dev unfreezes a reserve
   * @param asset the address of the reserve
   **/
  function unfreezeReserve(address asset) external onlyPoolAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setFrozen(false);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveUnfrozen(asset);
  }

  /**
   * @dev updates the reserve factor of a reserve
   * @param asset the address of the reserve
   * @param reserveFactor the new reserve factor of the reserve
   **/
  function setReserveFactor(address asset, uint256 reserveFactor) external onlyPoolAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setReserveFactor(reserveFactor);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveFactorChanged(asset, reserveFactor);
  }

  /**
   * @dev sets the interest rate strategy of a reserve
   * @param asset the address of the reserve
   * @param rateStrategyAddress the new address of the interest strategy contract
   **/
  function setReserveInterestRateStrategyAddress(address asset, address rateStrategyAddress)
    external
    onlyPoolAdmin
  {
    pool.setReserveInterestRateStrategyAddress(asset, rateStrategyAddress);
    emit ReserveInterestRateStrategyChanged(asset, rateStrategyAddress);
  }

  /**
   * @dev initializes a token with a proxy and a specific implementation
   * @param implementation the address of the implementation
   * @param decimals the decimals of the token
   **/
  function _initTokenWithProxy(address implementation, uint8 decimals) internal returns (address) {

      InitializableImmutableAdminUpgradeabilityProxy proxy
     = new InitializableImmutableAdminUpgradeabilityProxy(address(this));

    bytes memory params = abi.encodeWithSignature(
      'initialize(uint8,string,string)',
      decimals,
      IERC20Detailed(implementation).name(),
      IERC20Detailed(implementation).symbol()
    );

    proxy.initialize(implementation, params);

    return address(proxy);
  }

  function _upgradeTokenImplementation(
    address asset,
    address proxyAddress,
    address implementation
  ) internal {

      InitializableImmutableAdminUpgradeabilityProxy proxy
     = InitializableImmutableAdminUpgradeabilityProxy(payable(proxyAddress));

    ReserveConfiguration.Map memory configuration = pool.getConfiguration(asset);

    (, , , uint256 decimals, ) = configuration.getParamsMemory();

    bytes memory params = abi.encodeWithSignature(
      'initialize(uint8,string,string)',
      uint8(decimals),
      IERC20Detailed(implementation).name(),
      IERC20Detailed(implementation).symbol()
    );

    proxy.upgradeToAndCall(implementation, params);
  }

  /**
   * @dev pauses or unpauses LendingPool actions
   * @param val the boolean value to set the current pause state of LendingPool
   **/
  function setPoolPause(bool val) external onlyEmergencyAdmin {
    pool.setPause(val);
  }

  function _checkNoLiquidity(address asset) internal view {
    ReserveLogic.ReserveData memory reserveData = pool.getReserveData(asset);

    uint256 availableLiquidity = IERC20Detailed(asset).balanceOf(reserveData.aTokenAddress);

    require(
      availableLiquidity == 0 && reserveData.currentLiquidityRate == 0,
      Errors.LPC_RESERVE_LIQUIDITY_NOT_0
    );
  }
}
