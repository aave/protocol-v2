// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IERC20Detailed.sol';
import '../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';
import '../configuration/LendingPoolAddressesProvider.sol';
import '../tokenization/AToken.sol';

/**
 * @title LendingPoolConfigurator contract
 * @author Aave
 * @notice Executes configuration methods on the LendingPoolCore contract. Allows to enable/disable reserves,
 * and set different protocol parameters.
 **/

contract LendingPoolConfigurator is VersionedInitializable {
  using SafeMath for uint256;

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
   * @dev emitted when a reserve is removed.
   * @param _reserve the address of the reserve
   **/
  event ReserveRemoved(address indexed _reserve);

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
    address _interestRateStrategyAddress
  ) external onlyLendingPoolManager {
    IERC20Detailed asset = IERC20Detailed(_reserve);

    string memory aTokenName = string(abi.encodePacked('Aave Interest bearing ', asset.name()));
    string memory aTokenSymbol = string(abi.encodePacked('a', asset.symbol()));

    initReserveWithData(
      _reserve,
      aTokenName,
      aTokenSymbol,
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
    uint8 _underlyingAssetDecimals,
    address _interestRateStrategyAddress
  ) public onlyLendingPoolManager {
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));

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
      _underlyingAssetDecimals,
      _interestRateStrategyAddress
    );

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
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.setReserveBorrowingEnabled(_reserve, _stableBorrowRateEnabled, true);
    emit BorrowingEnabledOnReserve(_reserve, _stableBorrowRateEnabled);
  }

  /**
   * @dev disables borrowing on a reserve
   * @param _reserve the address of the reserve
   **/
  function disableBorrowingOnReserve(address _reserve) external onlyLendingPoolManager {
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.setReserveBorrowingEnabled(_reserve, false, false);
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
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.enableReserveAsCollateral(
      _reserve,
      _baseLTVasCollateral,
      _liquidationThreshold,
      _liquidationBonus
    );
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
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.disableReserveAsCollateral(_reserve);

    emit ReserveDisabledAsCollateral(_reserve);
  }

  /**
   * @dev enable stable rate borrowing on a reserve
   * @param _reserve the address of the reserve
   **/
  function enableReserveStableRate(address _reserve) external onlyLendingPoolManager {
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.setReserveStableBorrowRateEnabled(_reserve, true);

    emit StableRateEnabledOnReserve(_reserve);
  }

  /**
   * @dev disable stable rate borrowing on a reserve
   * @param _reserve the address of the reserve
   **/
  function disableReserveStableBorrowRate(address _reserve) external onlyLendingPoolManager {
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.setReserveStableBorrowRateEnabled(_reserve, false);

    emit StableRateDisabledOnReserve(_reserve);
  }

  /**
   * @dev activates a reserve
   * @param _reserve the address of the reserve
   **/
  function activateReserve(address _reserve) external onlyLendingPoolManager {
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.setReserveActive(_reserve, true);

    emit ReserveActivated(_reserve);
  }

  /**
   * @dev deactivates a reserve
   * @param _reserve the address of the reserve
   **/
  function deactivateReserve(address _reserve) external onlyLendingPoolManager {
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
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
    pool.setReserveActive(_reserve, false);

    emit ReserveDeactivated(_reserve);
  }

  /**
   * @dev freezes a reserve. A freezed reserve doesn't accept any new deposit, borrow or rate swap, but can accept repayments, liquidations, rate rebalances and redeems
   * @param _reserve the address of the reserve
   **/
  function freezeReserve(address _reserve) external onlyLendingPoolManager {
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.setReserveFreeze(_reserve, true);

    emit ReserveFreezed(_reserve);
  }

  /**
   * @dev unfreezes a reserve
   * @param _reserve the address of the reserve
   **/
  function unfreezeReserve(address _reserve) external onlyLendingPoolManager {
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.setReserveFreeze(_reserve, false);

    emit ReserveUnfreezed(_reserve);
  }

  /**
   * @dev emitted when a reserve loan to value is updated
   * @param _reserve the address of the reserve
   * @param _ltv the new value for the loan to value
   **/
  function setReserveBaseLTVasCollateral(address _reserve, uint256 _ltv)
    external
    onlyLendingPoolManager
  {
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.setReserveBaseLTVasCollateral(_reserve, _ltv);
    emit ReserveBaseLtvChanged(_reserve, _ltv);
  }

  /**
   * @dev updates the liquidation threshold of a reserve.
   * @param _reserve the address of the reserve
   * @param _threshold the new value for the liquidation threshold
   **/
  function setReserveLiquidationThreshold(address _reserve, uint256 _threshold)
    external
    onlyLendingPoolManager
  {
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.setReserveLiquidationThreshold(_reserve, _threshold);
    emit ReserveLiquidationThresholdChanged(_reserve, _threshold);
  }

  /**
   * @dev updates the liquidation bonus of a reserve
   * @param _reserve the address of the reserve
   * @param _bonus the new value for the liquidation bonus
   **/
  function setReserveLiquidationBonus(address _reserve, uint256 _bonus)
    external
    onlyLendingPoolManager
  {
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.setReserveLiquidationBonus(_reserve, _bonus);
    emit ReserveLiquidationBonusChanged(_reserve, _bonus);
  }

  /**
   * @dev updates the reserve decimals
   * @param _reserve the address of the reserve
   * @param _decimals the new number of decimals
   **/
  function setReserveDecimals(address _reserve, uint256 _decimals) external onlyLendingPoolManager {
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.setReserveDecimals(_reserve, _decimals);
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
    LendingPool pool = LendingPool(payable(poolAddressesProvider.getLendingPool()));
    pool.setReserveInterestRateStrategyAddress(_reserve, _rateStrategyAddress);
    emit ReserveInterestRateStrategyChanged(_reserve, _rateStrategyAddress);
  }
}
