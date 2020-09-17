// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {
  VersionedInitializable
} from '../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';
import {
  InitializableAdminUpgradeabilityProxy
} from '../libraries/openzeppelin-upgradeability/InitializableAdminUpgradeabilityProxy.sol';
import {ReserveConfiguration} from '../libraries/configuration/ReserveConfiguration.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {IERC20Detailed} from '../interfaces/IERC20Detailed.sol';
import {Errors} from '../libraries/helpers/Errors.sol';

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
  event BorrowingEnabledOnReserve(address asset, bool stableRateEnabled);

  /**
   * @dev emitted when borrowing is disabled on a reserve
   * @param asset the address of the reserve
   **/
  event BorrowingDisabledOnReserve(address indexed asset);

  /**
   * @dev emitted when a reserve is enabled as collateral.
   * @param asset the address of the reserve
   * @param ltv the loan to value of the asset when used as collateral
   * @param liquidationThreshold the threshold at which loans using this asset as collateral will be considered undercollateralized
   * @param liquidationBonus the bonus liquidators receive to liquidate this asset
   **/
  event ReserveEnabledAsCollateral(
    address indexed asset,
    uint256 ltv,
    uint256 liquidationThreshold,
    uint256 liquidationBonus
  );

  /**
   * @dev emitted when a reserve is disabled as collateral
   * @param asset the address of the reserve
   **/
  event ReserveDisabledAsCollateral(address indexed asset);

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
   * @dev emitted when a reserve is freezed
   * @param asset the address of the reserve
   **/
  event ReserveFreezed(address indexed asset);

  /**
   * @dev emitted when a reserve is unfreezed
   * @param asset the address of the reserve
   **/
  event ReserveUnfreezed(address indexed asset);

  /**
   * @dev emitted when a reserve loan to value is updated
   * @param asset the address of the reserve
   * @param ltv the new value for the loan to value
   **/
  event ReserveBaseLtvChanged(address asset, uint256 ltv);

  /**
   * @dev emitted when a reserve factor is updated
   * @param asset the address of the reserve
   * @param factor the new reserve factor
   **/
  event ReserveFactorChanged(address asset, uint256 factor);

  /**
   * @dev emitted when a reserve liquidation threshold is updated
   * @param asset the address of the reserve
   * @param threshold the new value for the liquidation threshold
   **/
  event ReserveLiquidationThresholdChanged(address asset, uint256 threshold);

  /**
   * @dev emitted when a reserve liquidation bonus is updated
   * @param asset the address of the reserve
   * @param bonus the new value for the liquidation bonus
   **/
  event ReserveLiquidationBonusChanged(address asset, uint256 bonus);

  /**
   * @dev emitted when the reserve decimals are updated
   * @param asset the address of the reserve
   * @param decimals the new decimals
   **/
  event ReserveDecimalsChanged(address asset, uint256 decimals);

  /**
   * @dev emitted when a reserve interest strategy contract is updated
   * @param asset the address of the reserve
   * @param strategy the new address of the interest strategy contract
   **/
  event ReserveInterestRateStrategyChanged(address asset, address strategy);

  /**
   * @dev emitted when an aToken implementation is upgraded
   * @param asset the address of the reserve
   * @param proxy the aToken proxy address
   * @param implementation the new aToken implementation
   **/
  event ATokenUpgraded(address asset, address proxy, address implementation);

  /**
   * @dev emitted when the implementation of a stable debt token is upgraded
   * @param asset the address of the reserve
   * @param proxy the stable debt token proxy address
   * @param implementation the new aToken implementation
   **/
  event StableDebtTokenUpgraded(address asset, address proxy, address implementation);

  /**
   * @dev emitted when the implementation of a variable debt token is upgraded
   * @param asset the address of the reserve
   * @param proxy the variable debt token proxy address
   * @param implementation the new aToken implementation
   **/
  event VariableDebtTokenUpgraded(address asset, address proxy, address implementation);

  ILendingPoolAddressesProvider internal addressesProvider;
  ILendingPool internal pool;

  /**
   * @dev only the lending pool manager can call functions affected by this modifier
   **/
  modifier onlyAaveAdmin {
    require(addressesProvider.getAaveAdmin() == msg.sender, Errors.CALLER_NOT_AAVE_ADMIN);
    _;
  }

  uint256 public constant CONFIGURATOR_REVISION = 0x3;

  function getRevision() internal override pure returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  function initialize(ILendingPoolAddressesProvider provider) public initializer {
    addressesProvider = provider;
    pool = ILendingPool(addressesProvider.getLendingPool());
  }

  /**
   * @dev initializes a reserve
   * @param asset the address of the reserve to be initialized
   * @param aTokenImpl  the address of the aToken contract implementation
   * @param stableDebtTokenImpl the address of the stable debt token contract
   * @param variableDebtTokenImpl the address of the variable debt token contract
   * @param underlyingAssetDecimals the decimals of the reserve underlying asset
   * @param interestRateStrategyAddress the address of the interest rate strategy contract for this reserve
   **/
  function initReserve(
    address asset,
    address aTokenImpl,
    address stableDebtTokenImpl,
    address variableDebtTokenImpl,
    uint8 underlyingAssetDecimals,
    address interestRateStrategyAddress
  ) public onlyAaveAdmin {
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
  function updateAToken(address asset, address implementation) external onlyAaveAdmin {
    (address aTokenAddress, , ) = pool.getReserveTokensAddresses(asset);

    _upgradeTokenImplementation(asset, aTokenAddress, implementation);

    emit ATokenUpgraded(asset, aTokenAddress, implementation);
  }

  /**
   * @dev updates the stable debt token implementation for the asset
   * @param asset the address of the reserve to be updated
   * @param implementation the address of the new aToken implementation
   **/
  function updateStableDebtToken(address asset, address implementation) external onlyAaveAdmin {
    (, address stableDebtToken, ) = pool.getReserveTokensAddresses(asset);

    _upgradeTokenImplementation(asset, stableDebtToken, implementation);

    emit StableDebtTokenUpgraded(asset, stableDebtToken, implementation);
  }

  /**
   * @dev updates the variable debt token implementation for the asset
   * @param asset the address of the reserve to be updated
   * @param implementation the address of the new aToken implementation
   **/
  function updateVariableDebtToken(address asset, address implementation) external onlyAaveAdmin {
    (, , address variableDebtToken) = pool.getReserveTokensAddresses(asset);

    _upgradeTokenImplementation(asset, variableDebtToken, implementation);

    emit VariableDebtTokenUpgraded(asset, variableDebtToken, implementation);
  }

  /**
   * @dev enables borrowing on a reserve
   * @param asset the address of the reserve
   * @param stableBorrowRateEnabled true if stable borrow rate needs to be enabled by default on this reserve
   **/
  function enableBorrowingOnReserve(address asset, bool stableBorrowRateEnabled)
    external
    onlyAaveAdmin
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
  function disableBorrowingOnReserve(address asset) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setBorrowingEnabled(false);

    pool.setConfiguration(asset, currentConfig.data);
    emit BorrowingDisabledOnReserve(asset);
  }

  /**
   * @dev enables a reserve to be used as collateral
   * @param asset the address of the reserve
   * @param ltv the loan to value of the asset when used as collateral
   * @param liquidationThreshold the threshold at which loans using this asset as collateral will be considered undercollateralized
   * @param liquidationBonus the bonus liquidators receive to liquidate this asset
   **/
  function enableReserveAsCollateral(
    address asset,
    uint256 ltv,
    uint256 liquidationThreshold,
    uint256 liquidationBonus
  ) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setLtv(ltv);
    currentConfig.setLiquidationThreshold(liquidationThreshold);
    currentConfig.setLiquidationBonus(liquidationBonus);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveEnabledAsCollateral(asset, ltv, liquidationThreshold, liquidationBonus);
  }

  /**
   * @dev disables a reserve as collateral
   * @param asset the address of the reserve
   **/
  function disableReserveAsCollateral(address asset) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setLtv(0);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveDisabledAsCollateral(asset);
  }

  /**
   * @dev enable stable rate borrowing on a reserve
   * @param asset the address of the reserve
   **/
  function enableReserveStableRate(address asset) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setStableRateBorrowingEnabled(true);

    pool.setConfiguration(asset, currentConfig.data);

    emit StableRateEnabledOnReserve(asset);
  }

  /**
   * @dev disable stable rate borrowing on a reserve
   * @param asset the address of the reserve
   **/
  function disableReserveStableRate(address asset) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setStableRateBorrowingEnabled(false);

    pool.setConfiguration(asset, currentConfig.data);

    emit StableRateDisabledOnReserve(asset);
  }

  /**
   * @dev activates a reserve
   * @param asset the address of the reserve
   **/
  function activateReserve(address asset) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setActive(true);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveActivated(asset);
  }

  /**
   * @dev deactivates a reserve
   * @param asset the address of the reserve
   **/
  function deactivateReserve(address asset) external onlyAaveAdmin {
    (
      uint256 availableLiquidity,
      uint256 totalStableDebt,
      uint256 totalVariableDebt,
      ,
      ,
      ,
      ,
      ,
      ,

    ) = pool.getReserveData(asset);
    require(
      availableLiquidity == 0 && totalStableDebt == 0 && totalVariableDebt == 0,
      Errors.RESERVE_LIQUIDITY_NOT_0
    );

    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setActive(false);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveDeactivated(asset);
  }

  /**
   * @dev freezes a reserve. A freezed reserve doesn't accept any new deposit, borrow or rate swap, but can accept repayments, liquidations, rate rebalances and redeems
   * @param asset the address of the reserve
   **/
  function freezeReserve(address asset) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setFrozen(true);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveFreezed(asset);
  }

  /**
   * @dev unfreezes a reserve
   * @param asset the address of the reserve
   **/
  function unfreezeReserve(address asset) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setFrozen(false);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveUnfreezed(asset);
  }

  /**
   * @dev updates the ltv of a reserve
   * @param asset the address of the reserve
   * @param ltv the new value for the loan to value
   **/
  function setLtv(address asset, uint256 ltv) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setLtv(ltv);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveBaseLtvChanged(asset, ltv);
  }

    /**
   * @dev updates the reserve factor of a reserve
   * @param asset the address of the reserve
   * @param reserveFactor the new reserve factor of the reserve
   **/
  function setReserveFactor(address asset, uint256 reserveFactor) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setReserveFactor(reserveFactor);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveFactorChanged(asset, reserveFactor);
  }


  /**
   * @dev updates the liquidation threshold of a reserve.
   * @param asset the address of the reserve
   * @param threshold the new value for the liquidation threshold
   **/
  function setLiquidationThreshold(address asset, uint256 threshold) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setLiquidationThreshold(threshold);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveLiquidationThresholdChanged(asset, threshold);
  }

  /**
   * @dev updates the liquidation bonus of a reserve
   * @param asset the address of the reserve
   * @param bonus the new value for the liquidation bonus
   **/
  function setLiquidationBonus(address asset, uint256 bonus) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setLiquidationBonus(bonus);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveLiquidationBonusChanged(asset, bonus);
  }

  /**
   * @dev updates the reserve decimals
   * @param asset the address of the reserve
   * @param decimals the new number of decimals
   **/
  function setReserveDecimals(address asset, uint256 decimals) external onlyAaveAdmin {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(asset);

    currentConfig.setDecimals(decimals);

    pool.setConfiguration(asset, currentConfig.data);

    emit ReserveDecimalsChanged(asset, decimals);
  }

  /**
   * @dev sets the interest rate strategy of a reserve
   * @param asset the address of the reserve
   * @param rateStrategyAddress the new address of the interest strategy contract
   **/
  function setReserveInterestRateStrategyAddress(address asset, address rateStrategyAddress)
    external
    onlyAaveAdmin
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
    InitializableAdminUpgradeabilityProxy proxy = new InitializableAdminUpgradeabilityProxy();

    bytes memory params = abi.encodeWithSignature(
      'initialize(uint8,string,string)',
      decimals,
      IERC20Detailed(implementation).name(),
      IERC20Detailed(implementation).symbol()
    );

    proxy.initialize(implementation, address(this), params);

    return address(proxy);
  }

  function _upgradeTokenImplementation(
    address asset,
    address proxyAddress,
    address implementation
  ) internal {
    InitializableAdminUpgradeabilityProxy proxy = InitializableAdminUpgradeabilityProxy(
      payable(proxyAddress)
    );

    (uint256 decimals, , , , , , , , , , ) = pool.getReserveConfigurationData(asset);

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
  function setPoolPause(bool val) external onlyAaveAdmin {
    pool.setPause(val);
  }
}
