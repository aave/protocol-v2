// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {PercentageMath} from '../libraries/math/PercentageMath.sol';
import {Errors} from '../libraries/helpers/Errors.sol';
import {VersionedInitializable} from '../../protocol/libraries/sturdy-upgradeability/VersionedInitializable.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IERC20Detailed} from '../../dependencies/openzeppelin/contracts/IERC20Detailed.sol';

/**
 * @title GeneralVault
 * @notice Basic feature of vault
 * @author Sturdy
 **/

abstract contract GeneralVault is VersionedInitializable {
  using PercentageMath for uint256;

  event ProcessYield(address indexed collateralAsset, uint256 yieldAmount);
  event DepositCollateral(address indexed collateralAsset, address indexed from, uint256 amount);
  event WithdrawCollateral(address indexed collateralAsset, address indexed to, uint256 amount);
  event SetTreasuryInfo(address indexed treasuryAddress, uint256 fee);

  modifier onlyAdmin() {
    require(_addressesProvider.getPoolAdmin() == msg.sender, Errors.CALLER_NOT_POOL_ADMIN);
    _;
  }

  modifier onlyYieldProcessor() {
    require(
      _addressesProvider.getAddress('YIELD_PROCESSOR') == msg.sender,
      Errors.CALLER_NOT_YIELD_PROCESSOR
    );
    _;
  }

  struct AssetYield {
    address asset;
    uint256 amount;
  }

  ILendingPoolAddressesProvider internal _addressesProvider;

  // vault fee 20%
  uint256 internal _vaultFee;
  address internal _treasuryAddress;

  uint256 private constant VAULT_REVISION = 0x1;
  address constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  /**
   * @dev Function is invoked by the proxy contract when the Vault contract is deployed.
   * @param _provider The address of the provider
   **/
  function initialize(ILendingPoolAddressesProvider _provider) external initializer {
    _addressesProvider = _provider;
  }

  function getRevision() internal pure override returns (uint256) {
    return VAULT_REVISION;
  }

  /**
   * @dev Deposits an `amount` of asset as collateral to borrow other asset.
   * @param _asset The asset address for collateral
   *  _asset = 0x0000000000000000000000000000000000000000 means to use ETH as collateral
   * @param _amount The deposit amount
   */
  function depositCollateral(address _asset, uint256 _amount) external payable virtual {
    if (_asset != address(0)) {
      // asset = ERC20
      require(msg.value == 0, Errors.VT_COLLATERAL_DEPOSIT_INVALID);
    } else {
      // asset = ETH
      require(msg.value == _amount, Errors.VT_COLLATERAL_DEPOSIT_REQUIRE_ETH);
    }
    // Deposit asset to vault and receive stAsset
    // Ex: if user deposit 100ETH, this will deposit 100ETH to Lido and receive 100stETH
    (address _stAsset, uint256 _stAssetAmount) = _depositToYieldPool(_asset, _amount);

    // Deposit stAsset to lendingPool, then user will get aToken of stAsset
    ILendingPool(_addressesProvider.getLendingPool()).deposit(
      _stAsset,
      _stAssetAmount,
      msg.sender,
      0
    );

    emit DepositCollateral(_asset, msg.sender, _amount);
  }

  /**
   * @dev Withdraw an `amount` of asset used as collateral to user.
   * @param _asset The asset address for collateral
   *  _asset = 0x0000000000000000000000000000000000000000 means to use ETH as collateral
   * @param _amount The amount to be withdrawn
   * @param _slippage The slippage of the withdrawal amount. 1% = 100
   * @param _to Address that will receive the underlying, same as msg.sender if the user
   *   wants to receive it on his own wallet, or a different address if the beneficiary is a
   *   different wallet
   */
  function withdrawCollateral(
    address _asset,
    uint256 _amount,
    uint256 _slippage,
    address _to
  ) external virtual {
    // Before withdraw from lending pool, get the stAsset address and withdrawal amount
    // Ex: In Lido vault, it will return stETH address and same amount
    (address _stAsset, uint256 _stAssetAmount) = _getWithdrawalAmount(_asset, _amount);

    // withdraw from lendingPool, it will convert user's aToken to stAsset
    uint256 _amountToWithdraw = ILendingPool(_addressesProvider.getLendingPool()).withdrawFrom(
      _stAsset,
      _stAssetAmount,
      msg.sender,
      address(this)
    );

    // Withdraw from vault, it will convert stAsset to asset and send to user
    // Ex: In Lido vault, it will return ETH or stETH to user
    uint256 withdrawAmount = _withdrawFromYieldPool(_asset, _amountToWithdraw, _to);

    if (_amount == type(uint256).max) {
      uint256 decimal;
      if (_asset == address(0)) {
        decimal = 18;
      } else {
        decimal = IERC20Detailed(_asset).decimals();
      }

      _amount = (_amountToWithdraw * this.pricePerShare()) / 10**decimal;
    }
    require(
      withdrawAmount >= _amount.percentMul(PercentageMath.PERCENTAGE_FACTOR - _slippage),
      Errors.VT_WITHDRAW_AMOUNT_MISMATCH
    );

    emit WithdrawCollateral(_asset, _to, _amount);
  }

  /**
   * @dev Withdraw an `amount` of asset used as collateral to user on liquidation.
   *  _asset = 0x0000000000000000000000000000000000000000 means to use ETH as collateral
   * @param _amount The amount to be withdrawn
   */
  function withdrawOnLiquidation(address, uint256 _amount) external virtual returns (uint256) {
    return _amount;
  }

  /**
   * @dev Get yield based on strategy and re-deposit
   */
  function processYield() external virtual;

  /**
   * @dev Get price per share based on yield strategy
   */
  function pricePerShare() external view virtual returns (uint256);

  /**
   * @dev Set treasury address and vault fee
   * @param _treasury The treasury address
   * @param _fee The vault fee which has more two decimals, ex: 100% = 100_00
   */
  function setTreasuryInfo(address _treasury, uint256 _fee) external payable onlyAdmin {
    require(_treasury != address(0), Errors.VT_TREASURY_INVALID);
    require(_fee <= 30_00, Errors.VT_FEE_TOO_BIG);
    _treasuryAddress = _treasury;
    _vaultFee = _fee;

    emit SetTreasuryInfo(_treasury, _fee);
  }

  /**
   * @dev Get yield based on strategy and re-deposit
   */
  function _getYield(address _stAsset) internal returns (uint256) {
    uint256 yieldStAsset = _getYieldAmount(_stAsset);
    require(yieldStAsset > 0, Errors.VT_PROCESS_YIELD_INVALID);

    ILendingPool(_addressesProvider.getLendingPool()).getYield(_stAsset, yieldStAsset);
    return yieldStAsset;
  }

  /**
   * @dev Get yield amount based on strategy
   */
  function _getYieldAmount(address _stAsset) internal view returns (uint256) {
    (uint256 stAssetBalance, uint256 aTokenBalance) = ILendingPool(
      _addressesProvider.getLendingPool()
    ).getTotalBalanceOfAssetPair(_stAsset);

    // when deposit for collateral, stAssetBalance = aTokenBalance
    // But stAssetBalance should increase overtime, so vault can grab yield from lendingPool.
    // yield = stAssetBalance - aTokenBalance
    if (stAssetBalance > aTokenBalance) return stAssetBalance - aTokenBalance;

    return 0;
  }

  /**
   * @dev Deposit to yield pool based on strategy and receive stAsset
   */
  function _depositToYieldPool(address _asset, uint256 _amount)
    internal
    virtual
    returns (address, uint256);

  /**
   * @dev Withdraw from yield pool based on strategy with stAsset and deliver asset
   */
  function _withdrawFromYieldPool(
    address _asset,
    uint256 _amount,
    address _to
  ) internal virtual returns (uint256);

  /**
   * @dev Get Withdrawal amount of stAsset based on strategy
   */
  function _getWithdrawalAmount(address _asset, uint256 _amount)
    internal
    view
    virtual
    returns (address, uint256);
}
