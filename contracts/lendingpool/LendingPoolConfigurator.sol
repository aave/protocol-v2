// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IERC20Detailed.sol';
import '../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';
import '../libraries/ReserveConfiguration.sol';
import '../configuration/LendingPoolAddressesProvider.sol';
import '../tokenization/AToken.sol';

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
   * @param _reserve the address of the reserve
   * @param _aToken the address of the overlying aToken contract
   * @param _interestRateStrategyAddress the address of the interest rate strategy for the reserve
   **/
  event ReserveInitialized(
    address indexed _reserve,
    address indexed _aToken,
    address _interestRateStrategyAddress
  );

  /**
   * @dev emitted when borrowing is enabled on a reserve
   * @param _reserve the address of the reserve
   * @param _stableRateEnabled true if stable rate borrowing is enabled, false otherwise
   **/
  event BorrowingEnabledOnReserve(address _reserve, bool _stableRateEnabled);

  /**
   * @dev emitted when borrowing is disabled on a reserve
   * @param _reserve the address of the reserve
   **/
  event BorrowingDisabledOnReserve(address indexed _reserve);

  /**
   * @dev emitted when a reserve is enabled as collateral.
   * @param _reserve the address of the reserve
   * @param _ltv the loan to value of the asset when used as collateral
   * @param _liquidationThreshold the threshold at which loans using this asset as collateral will be considered undercollateralized
   * @param _liquidationBonus the bonus liquidators receive to liquidate this asset
   **/
  event ReserveEnabledAsCollateral(
    address indexed _reserve,
    uint256 _ltv,
    uint256 _liquidationThreshold,
    uint256 _liquidationBonus
  );

  /**
   * @dev emitted when a reserve is disabled as collateral
   * @param _reserve the address of the reserve
   **/
  event ReserveDisabledAsCollateral(address indexed _reserve);

  /**
   * @dev emitted when stable rate borrowing is enabled on a reserve
   * @param _reserve the address of the reserve
   **/
  event StableRateEnabledOnReserve(address indexed _reserve);

  /**
   * @dev emitted when stable rate borrowing is disabled on a reserve
   * @param _reserve the address of the reserve
   **/
  event StableRateDisabledOnReserve(address indexed _reserve);

  /**
   * @dev emitted when a reserve is activated
   * @param _reserve the address of the reserve
   **/
  event ReserveActivated(address indexed _reserve);

  /**
   * @dev emitted when a reserve is deactivated
   * @param _reserve the address of the reserve
   **/
  event ReserveDeactivated(address indexed _reserve);

  /**
   * @dev emitted when a reserve is freezed
   * @param _reserve the address of the reserve
   **/
  event ReserveFreezed(address indexed _reserve);

  /**
   * @dev emitted when a reserve is unfreezed
   * @param _reserve the address of the reserve
   **/
  event ReserveUnfreezed(address indexed _reserve);

  /**
   * @dev emitted when a reserve loan to value is updated
   * @param _reserve the address of the reserve
   * @param _ltv the new value for the loan to value
   **/
  event ReserveBaseLtvChanged(address _reserve, uint256 _ltv);

  /**
   * @dev emitted when a reserve liquidation threshold is updated
   * @param _reserve the address of the reserve
   * @param _threshold the new value for the liquidation threshold
   **/
  event ReserveLiquidationThresholdChanged(address _reserve, uint256 _threshold);

  /**
   * @dev emitted when a reserve liquidation bonus is updated
   * @param _reserve the address of the reserve
   * @param _bonus the new value for the liquidation bonus
   **/
  event ReserveLiquidationBonusChanged(address _reserve, uint256 _bonus);

  /**
   * @dev emitted when the reserve decimals are updated
   * @param _reserve the address of the reserve
   * @param _decimals the new decimals
   **/
  event ReserveDecimalsChanged(address _reserve, uint256 _decimals);

  /**
   * @dev emitted when a reserve interest strategy contract is updated
   * @param _reserve the address of the reserve
   * @param _strategy the new address of the interest strategy contract
   **/
  event ReserveInterestRateStrategyChanged(address _reserve, address _strategy);

  LendingPoolAddressesProvider public poolAddressesProvider;
  LendingPool public pool;

  /**
   * @dev only the lending pool manager can call functions affected by this modifier
   **/
  modifier onlyLendingPoolManager {
    require(
      poolAddressesProvider.getLendingPoolManager() == msg.sender,
      'The caller must be a lending pool manager'
    );
    _;
  }

  uint256 public constant CONFIGURATOR_REVISION = 0x3;

  function getRevision() internal override pure returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  function initialize(LendingPoolAddressesProvider _poolAddressesProvider) public initializer {
    poolAddressesProvider = _poolAddressesProvider;
    pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
  }

  /**
   * @dev initializes a reserve
   * @param _reserve the address of the reserve to be initialized
   * @param _underlyingAssetDecimals the decimals of the reserve underlying asset
   * @param _interestRateStrategyAddress the address of the interest rate strategy contract for this reserve
   **/
  function initReserve(
    address _reserve,
    uint8 _underlyingAssetDecimals,
    address _interestRateStrategyAddress,
    address _stableDebtTokenAddress,
    address _variableDebtTokenAddress
  ) external onlyLendingPoolManager {
    string memory aTokenName = string(
      abi.encodePacked('Aave Interest bearing ', IERC20Detailed(_reserve).name())
    );
    string memory aTokenSymbol = string(abi.encodePacked('a', IERC20Detailed(_reserve).symbol()));

    initReserveWithData(
      _reserve,
      aTokenName,
      aTokenSymbol,
      _stableDebtTokenAddress,
      _variableDebtTokenAddress,
      _underlyingAssetDecimals,
      _interestRateStrategyAddress
    );
  }

  /**
   * @dev initializes a reserve using aTokenData provided externally (useful if the underlying ERC20 contract doesn't expose name or decimals)
   * @param _reserve the address of the reserve to be initialized
   * @param _aTokenName the name of the aToken contract
   * @param _aTokenSymbol the symbol of the aToken contract
   * @param _underlyingAssetDecimals the decimals of the reserve underlying asset
   * @param _interestRateStrategyAddress the address of the interest rate strategy contract for this reserve
   **/
  function initReserveWithData(
    address _reserve,
    string memory _aTokenName,
    string memory _aTokenSymbol,
    address _stableDebtTokenAddress,
    address _variableDebtTokenAddress,
    uint8 _underlyingAssetDecimals,
    address _interestRateStrategyAddress
  ) public onlyLendingPoolManager {
    AToken aTokenInstance = new AToken(
      poolAddressesProvider,
      _reserve,
      _underlyingAssetDecimals,
      _aTokenName,
      _aTokenSymbol
    );

    pool.initReserve(
      _reserve,
      address(aTokenInstance),
      _stableDebtTokenAddress,
      _variableDebtTokenAddress,
      _interestRateStrategyAddress
    );

    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setDecimals(_underlyingAssetDecimals);

    currentConfig.setActive(true);
    currentConfig.setFrozen(false);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit ReserveInitialized(_reserve, address(aTokenInstance), _interestRateStrategyAddress);
  }

  /**
   * @dev enables borrowing on a reserve
   * @param _reserve the address of the reserve
   * @param _stableBorrowRateEnabled true if stable borrow rate needs to be enabled by default on this reserve
   **/
  function enableBorrowingOnReserve(address _reserve, bool _stableBorrowRateEnabled)
    external
    onlyLendingPoolManager
  {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setBorrowingEnabled(true);
    currentConfig.setStableRateBorrowingEnabled(_stableBorrowRateEnabled);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit BorrowingEnabledOnReserve(_reserve, _stableBorrowRateEnabled);
  }

  /**
   * @dev disables borrowing on a reserve
   * @param _reserve the address of the reserve
   **/
  function disableBorrowingOnReserve(address _reserve) external onlyLendingPoolManager {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setBorrowingEnabled(false);

    pool.setConfiguration(_reserve, currentConfig.data);
    emit BorrowingDisabledOnReserve(_reserve);
  }

  /**
   * @dev enables a reserve to be used as collateral
   * @param _reserve the address of the reserve
   * @param _baseLTVasCollateral the loan to value of the asset when used as collateral
   * @param _liquidationThreshold the threshold at which loans using this asset as collateral will be considered undercollateralized
   * @param _liquidationBonus the bonus liquidators receive to liquidate this asset
   **/
  function enableReserveAsCollateral(
    address _reserve,
    uint256 _baseLTVasCollateral,
    uint256 _liquidationThreshold,
    uint256 _liquidationBonus
  ) external onlyLendingPoolManager {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setLtv(_baseLTVasCollateral);
    currentConfig.setLiquidationThreshold(_liquidationThreshold);
    currentConfig.setLiquidationBonus(_liquidationBonus);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit ReserveEnabledAsCollateral(
      _reserve,
      _baseLTVasCollateral,
      _liquidationThreshold,
      _liquidationBonus
    );
  }

  /**
   * @dev disables a reserve as collateral
   * @param _reserve the address of the reserve
   **/
  function disableReserveAsCollateral(address _reserve) external onlyLendingPoolManager {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setLtv(0);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit ReserveDisabledAsCollateral(_reserve);
  }

  /**
   * @dev enable stable rate borrowing on a reserve
   * @param _reserve the address of the reserve
   **/
  function enableReserveStableRate(address _reserve) external onlyLendingPoolManager {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setStableRateBorrowingEnabled(true);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit StableRateEnabledOnReserve(_reserve);
  }

  /**
   * @dev disable stable rate borrowing on a reserve
   * @param _reserve the address of the reserve
   **/
  function disableReserveStableRate(address _reserve) external onlyLendingPoolManager {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setStableRateBorrowingEnabled(false);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit StableRateDisabledOnReserve(_reserve);
  }

  /**
   * @dev activates a reserve
   * @param _reserve the address of the reserve
   **/
  function activateReserve(address _reserve) external onlyLendingPoolManager {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setActive(true);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit ReserveActivated(_reserve);
  }

  /**
   * @dev deactivates a reserve
   * @param _reserve the address of the reserve
   **/
  function deactivateReserve(address _reserve) external onlyLendingPoolManager {
    (
      uint256 availableLiquidity,
      uint256 totalBorrowsStable,
      uint256 totalBorrowsVariable,
      ,
      ,
      ,
      ,
      ,
      ,

    ) = pool.getReserveData(_reserve);
    require(
      availableLiquidity == 0 && totalBorrowsStable == 0 && totalBorrowsVariable == 0,
      'The liquidity of the reserve needs to be 0'
    );

    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setActive(false);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit ReserveDeactivated(_reserve);
  }

  /**
   * @dev freezes a reserve. A freezed reserve doesn't accept any new deposit, borrow or rate swap, but can accept repayments, liquidations, rate rebalances and redeems
   * @param _reserve the address of the reserve
   **/
  function freezeReserve(address _reserve) external onlyLendingPoolManager {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setFrozen(true);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit ReserveFreezed(_reserve);
  }

  /**
   * @dev unfreezes a reserve
   * @param _reserve the address of the reserve
   **/
  function unfreezeReserve(address _reserve) external onlyLendingPoolManager {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setFrozen(false);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit ReserveUnfreezed(_reserve);
  }

  /**
   * @dev emitted when a reserve loan to value is updated
   * @param _reserve the address of the reserve
   * @param _ltv the new value for the loan to value
   **/
  function setLtv(address _reserve, uint256 _ltv) external onlyLendingPoolManager {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setLtv(_ltv);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit ReserveBaseLtvChanged(_reserve, _ltv);
  }

  /**
   * @dev updates the liquidation threshold of a reserve.
   * @param _reserve the address of the reserve
   * @param _threshold the new value for the liquidation threshold
   **/
  function setLiquidationThreshold(address _reserve, uint256 _threshold)
    external
    onlyLendingPoolManager
  {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setLiquidationThreshold(_threshold);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit ReserveLiquidationThresholdChanged(_reserve, _threshold);
  }

  /**
   * @dev updates the liquidation bonus of a reserve
   * @param _reserve the address of the reserve
   * @param _bonus the new value for the liquidation bonus
   **/
  function setLiquidationBonus(address _reserve, uint256 _bonus) external onlyLendingPoolManager {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setLiquidationBonus(_bonus);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit ReserveLiquidationBonusChanged(_reserve, _bonus);
  }

  /**
   * @dev updates the reserve decimals
   * @param _reserve the address of the reserve
   * @param _decimals the new number of decimals
   **/
  function setReserveDecimals(address _reserve, uint256 _decimals) external onlyLendingPoolManager {
    ReserveConfiguration.Map memory currentConfig = pool.getConfiguration(_reserve);

    currentConfig.setDecimals(_decimals);

    pool.setConfiguration(_reserve, currentConfig.data);

    emit ReserveDecimalsChanged(_reserve, _decimals);
  }

  /**
   * @dev sets the interest rate strategy of a reserve
   * @param _reserve the address of the reserve
   * @param _rateStrategyAddress the new address of the interest strategy contract
   **/
  function setReserveInterestRateStrategyAddress(address _reserve, address _rateStrategyAddress)
    external
    onlyLendingPoolManager
  {
    pool.setReserveInterestRateStrategyAddress(_reserve, _rateStrategyAddress);
    emit ReserveInterestRateStrategyChanged(_reserve, _rateStrategyAddress);
  }
}
