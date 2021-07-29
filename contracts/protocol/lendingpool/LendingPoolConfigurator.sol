// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {VersionedInitializable} from '../libraries/aave-upgradeability/VersionedInitializable.sol';
import {ReserveConfiguration} from '../libraries/configuration/ReserveConfiguration.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {IERC20Detailed} from '../../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {Errors} from '../libraries/helpers/Errors.sol';
import {PercentageMath} from '../libraries/math/PercentageMath.sol';
import {DataTypes} from '../libraries/types/DataTypes.sol';
import {ConfiguratorInputTypes} from '../libraries/types/ConfiguratorInputTypes.sol';
import {ILendingPoolConfigurator} from '../../interfaces/ILendingPoolConfigurator.sol';
import {ConfiguratorLogic} from '../libraries/logic/ConfiguratorLogic.sol';

/**
 * @title LendingPoolConfigurator contract
 * @author Aave
 * @dev Implements the configuration methods for the Aave protocol
 **/

contract LendingPoolConfigurator is VersionedInitializable, ILendingPoolConfigurator {
  using SafeMath for uint256;
  using PercentageMath for uint256;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using ConfiguratorLogic for DataTypes.ReserveConfigurationMap;

  ILendingPoolAddressesProvider internal _addressesProvider;
  ILendingPool internal _pool;

  mapping(address => bool) private _riskAdmins;

  modifier onlyPoolAdmin {
    require(_addressesProvider.getPoolAdmin() == msg.sender, Errors.CALLER_NOT_POOL_ADMIN);
    _;
  }

  modifier onlyEmergencyAdmin {
    require(
      _addressesProvider.getEmergencyAdmin() == msg.sender,
      Errors.LPC_CALLER_NOT_EMERGENCY_ADMIN
    );
    _;
  }

  modifier onlyEmergencyOrPoolAdmin {
    require(
      _addressesProvider.getEmergencyAdmin() == msg.sender ||
        _addressesProvider.getPoolAdmin() == msg.sender,
      Errors.LPC_CALLER_NOT_EMERGENCY_OR_POOL_ADMIN
    );
    _;
  }

  modifier onlyRiskOrPoolAdmins {
    require(
      _riskAdmins[msg.sender] || _addressesProvider.getPoolAdmin() == msg.sender,
      Errors.LPC_CALLER_NOT_RISK_OR_POOL_ADMIN
    );
    _;
  }

  uint256 internal constant CONFIGURATOR_REVISION = 0x1;

  function getRevision() internal pure override returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  function initialize(ILendingPoolAddressesProvider provider) public initializer {
    _addressesProvider = provider;
    _pool = ILendingPool(_addressesProvider.getLendingPool());
  }

  /// @inheritdoc ILendingPoolConfigurator
  function batchInitReserve(ConfiguratorInputTypes.InitReserveInput[] calldata input)
    external
    override
    onlyPoolAdmin
  {
    ILendingPool cachedPool = _pool;
    for (uint256 i = 0; i < input.length; i++) {
      ConfiguratorLogic._initReserve(cachedPool, input[i]);
    }
  }

  /// @inheritdoc ILendingPoolConfigurator
  function dropReserve(address asset) external override onlyPoolAdmin {
    ConfiguratorLogic.dropReserve(_pool, asset);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function updateAToken(ConfiguratorInputTypes.UpdateATokenInput calldata input)
    external
    override
    onlyPoolAdmin
  {
    ConfiguratorLogic.updateAToken(_pool, input);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function updateStableDebtToken(ConfiguratorInputTypes.UpdateDebtTokenInput calldata input)
    external
    override
    onlyPoolAdmin
  {
    ConfiguratorLogic.updateStableDebtToken(_pool, input);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function updateVariableDebtToken(ConfiguratorInputTypes.UpdateDebtTokenInput calldata input)
    external
    override
    onlyPoolAdmin
  {
    ConfiguratorLogic.updateStableDebtToken(_pool, input);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function enableBorrowingOnReserve(
    address asset,
    uint256 borrowCap,
    bool stableBorrowRateEnabled
  ) external override onlyRiskOrPoolAdmins {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);
    currentConfig.enableBorrowingOnReserve(_pool, asset, borrowCap, stableBorrowRateEnabled);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function disableBorrowingOnReserve(address asset) external override onlyRiskOrPoolAdmins {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);
    currentConfig.disableBorrowingOnReserve(_pool, asset);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function configureReserveAsCollateral(
    address asset,
    uint256 ltv,
    uint256 liquidationThreshold,
    uint256 liquidationBonus
  ) external override onlyRiskOrPoolAdmins {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);

    //validation of the parameters: the LTV can
    //only be lower or equal than the liquidation threshold
    //(otherwise a loan against the asset would cause instantaneous liquidation)
    require(ltv <= liquidationThreshold, Errors.LPC_INVALID_CONFIGURATION);

    if (liquidationThreshold != 0) {
      //liquidation bonus must be bigger than 100.00%, otherwise the liquidator would receive less
      //collateral than needed to cover the debt
      require(
        liquidationBonus > PercentageMath.PERCENTAGE_FACTOR,
        Errors.LPC_INVALID_CONFIGURATION
      );

      //if threshold * bonus is less than PERCENTAGE_FACTOR, it's guaranteed that at the moment
      //a loan is taken there is enough collateral available to cover the liquidation bonus
      require(
        liquidationThreshold.percentMul(liquidationBonus) <= PercentageMath.PERCENTAGE_FACTOR,
        Errors.LPC_INVALID_CONFIGURATION
      );
    } else {
      require(liquidationBonus == 0, Errors.LPC_INVALID_CONFIGURATION);
      //if the liquidation threshold is being set to 0,
      // the reserve is being disabled as collateral. To do so,
      //we need to ensure no liquidity is deposited
      _checkNoLiquidity(asset);
    }

    currentConfig.configureReserveAsCollateral(_pool, asset, ltv, liquidationThreshold, liquidationBonus);  
  }

  /// @inheritdoc ILendingPoolConfigurator
  function enableReserveStableRate(address asset) external override onlyRiskOrPoolAdmins {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);
    currentConfig.enableReserveStableRate(_pool, asset);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function disableReserveStableRate(address asset) external override onlyRiskOrPoolAdmins {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);
    currentConfig.disableReserveStableRate(_pool, asset);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function activateReserve(address asset) external override onlyPoolAdmin {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);
    currentConfig.activateReserve(_pool, asset);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function deactivateReserve(address asset) external override onlyPoolAdmin {
    _checkNoLiquidity(asset);

    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);
    currentConfig.deactivateReserve(_pool, asset);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function freezeReserve(address asset) external override onlyRiskOrPoolAdmins {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);
    currentConfig.freezeReserve(_pool, asset);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function unfreezeReserve(address asset) external override onlyRiskOrPoolAdmins {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);
    currentConfig.unfreezeReserve(_pool, asset);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function setReservePause(address asset, bool paused) public override onlyEmergencyOrPoolAdmin {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);
    currentConfig.setReservePause(_pool, asset, paused);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function setReserveFactor(address asset, uint256 reserveFactor)
    external
    override
    onlyRiskOrPoolAdmins
  {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);
    currentConfig.setReserveFactor(_pool, asset, reserveFactor);
  }

  ///@inheritdoc ILendingPoolConfigurator
  function setBorrowCap(address asset, uint256 borrowCap) external override onlyRiskOrPoolAdmins {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);
    currentConfig.setBorrowCap(_pool, asset, borrowCap);
  }

  ///@inheritdoc ILendingPoolConfigurator
  function setSupplyCap(address asset, uint256 supplyCap) external override onlyRiskOrPoolAdmins {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getConfiguration(asset);
    currentConfig.setSupplyCap(_pool, asset, supplyCap);
  }

  ///@inheritdoc ILendingPoolConfigurator
  function setReserveInterestRateStrategyAddress(address asset, address rateStrategyAddress)
    external
    override
    onlyRiskOrPoolAdmins
  {
    _pool.setReserveInterestRateStrategyAddress(asset, rateStrategyAddress);
    emit ReserveInterestRateStrategyChanged(asset, rateStrategyAddress);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function setPoolPause(bool paused) external override onlyEmergencyAdmin {
    address[] memory reserves = _pool.getReservesList();

    for (uint256 i = 0; i < reserves.length; i++) {
      if (reserves[i] != address(0)) {
        //might happen is a reserve was dropped
        setReservePause(reserves[i], paused);
      }
    }
  }

  /// @inheritdoc ILendingPoolConfigurator
  function registerRiskAdmin(address admin) external override onlyPoolAdmin {
    _riskAdmins[admin] = true;
    emit RiskAdminRegistered(admin);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function unregisterRiskAdmin(address admin) external override onlyPoolAdmin {
    _riskAdmins[admin] = false;
    emit RiskAdminUnregistered(admin);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function authorizeFlashBorrower(address flashBorrower) external override onlyPoolAdmin {
    _pool.updateFlashBorrowerAuthorization(flashBorrower, true);
    emit FlashBorrowerAuthorized(flashBorrower);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function unauthorizeFlashBorrower(address flashBorrower) external override onlyPoolAdmin {
    _pool.updateFlashBorrowerAuthorization(flashBorrower, false);
    emit FlashBorrowerUnauthorized(flashBorrower);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function isRiskAdmin(address admin) external view override onlyPoolAdmin returns (bool) {
    return _riskAdmins[admin];
  }

  /// @inheritdoc ILendingPoolConfigurator
  function updateFlashloanPremiumTotal(uint256 flashloanPremiumTotal)
    external
    override
    onlyPoolAdmin
  {
    require(
      flashloanPremiumTotal < PercentageMath.PERCENTAGE_FACTOR,
      Errors.LPC_FLASHLOAN_PREMIUM_INVALID
    );
    require(
      flashloanPremiumTotal >= _pool.FLASHLOAN_PREMIUM_TO_PROTOCOL(),
      Errors.LPC_FLASHLOAN_PREMIUMS_MISMATCH
    );
    _pool.updateFlashloanPremiums(flashloanPremiumTotal, _pool.FLASHLOAN_PREMIUM_TO_PROTOCOL());
    emit FlashloanPremiumTotalUpdated(flashloanPremiumTotal);
  }

  /// @inheritdoc ILendingPoolConfigurator
  function updateFlashloanPremiumToProtocol(uint256 flashloanPremiumToProtocol)
    external
    override
    onlyPoolAdmin
  {
    require(
      flashloanPremiumToProtocol < PercentageMath.PERCENTAGE_FACTOR,
      Errors.LPC_FLASHLOAN_PREMIUM_INVALID
    );
    require(
      flashloanPremiumToProtocol <= _pool.FLASHLOAN_PREMIUM_TOTAL(),
      Errors.LPC_FLASHLOAN_PREMIUMS_MISMATCH
    );
    _pool.updateFlashloanPremiums(_pool.FLASHLOAN_PREMIUM_TOTAL(), flashloanPremiumToProtocol);
    emit FlashloanPremiumToProcolUpdated(flashloanPremiumToProtocol);
  }

  function _checkNoLiquidity(address asset) internal view {
    DataTypes.ReserveData memory reserveData = _pool.getReserveData(asset);

    uint256 availableLiquidity = IERC20Detailed(asset).balanceOf(reserveData.aTokenAddress);

    require(
      availableLiquidity == 0 && reserveData.currentLiquidityRate == 0,
      Errors.LPC_RESERVE_LIQUIDITY_NOT_0
    );
  }
}
