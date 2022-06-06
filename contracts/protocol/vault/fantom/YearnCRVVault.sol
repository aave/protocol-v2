// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {GeneralVault} from '../GeneralVault.sol';
import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IYearnVault} from '../../../interfaces/IYearnVault.sol';
import {IUniswapV2Router02} from '../../../interfaces/IUniswapV2Router02.sol';
import {Errors} from '../../libraries/helpers/Errors.sol';
import {SafeERC20} from '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {PercentageMath} from '../../libraries/math/PercentageMath.sol';
import {IERC20Detailed} from '../../../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {IPriceOracleGetter} from '../../../interfaces/IPriceOracleGetter.sol';
import {ILendingPool} from '../../../interfaces/ILendingPool.sol';
import {ILendingPoolAddressesProvider} from '../../../interfaces/ILendingPoolAddressesProvider.sol';

/**
 * @title YearnCRVVault
 * @notice yvCRV/CRV Vault by using Yearn on Fantom
 * @author Sturdy
 **/
contract YearnCRVVault is GeneralVault {
  using SafeERC20 for IERC20;
  using PercentageMath for uint256;

  function processYield() external override onlyYieldProcessor {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    // Get yield from lendingPool
    address YVCRV = provider.getAddress('YVCRV');
    uint256 yieldYVCRV = _getYield(YVCRV);

    // move yield to treasury
    if (_vaultFee > 0) {
      uint256 treasuryYVCRV = _processTreasury(yieldYVCRV);
      yieldYVCRV -= treasuryYVCRV;
    }

    // Withdraw from Yearn Vault and receive CRV
    uint256 yieldCRV = IYearnVault(YVCRV).withdraw(yieldYVCRV, address(this), 1);

    AssetYield[] memory assetYields = _getAssetYields(yieldCRV);
    uint256 length = assetYields.length;
    for (uint256 i; i < length; ++i) {
      // CRV -> Asset and Deposit to pool
      if (assetYields[i].amount > 0) {
        _convertAndDepositYield(assetYields[i].asset, assetYields[i].amount);
      }
    }

    emit ProcessYield(provider.getAddress('CRV'), yieldCRV);
  }

  function withdrawOnLiquidation(address _asset, uint256 _amount)
    external
    override
    returns (uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address CRV = provider.getAddress('CRV');

    require(_asset == CRV, Errors.LP_LIQUIDATION_CALL_FAILED);
    require(msg.sender == provider.getLendingPool(), Errors.LP_LIQUIDATION_CALL_FAILED);

    // Withdraw from Yearn Vault and receive CRV
    uint256 assetAmount = IYearnVault(provider.getAddress('YVCRV')).withdraw(
      _amount,
      address(this),
      1
    );

    // Deliver CRV to user
    IERC20(CRV).safeTransfer(msg.sender, assetAmount);

    return assetAmount;
  }

  function _convertAndDepositYield(address _tokenOut, uint256 _linkAmount) internal {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address uniswapRouter = provider.getAddress('uniswapRouter');
    address CRV = provider.getAddress('CRV');
    address lendingPoolAddress = provider.getLendingPool();

    // Calculate minAmount from price with 2% slippage
    uint256 assetDecimal = IERC20Detailed(_tokenOut).decimals();
    IPriceOracleGetter oracle = IPriceOracleGetter(provider.getPriceOracle());
    uint256 minAmountFromPrice = ((((_linkAmount *
      oracle.getAssetPrice(provider.getAddress('YVCRV'))) / 10**18) * 10**assetDecimal) /
      oracle.getAssetPrice(_tokenOut)).percentMul(98_00);

    // Exchange CRV -> _tokenOut via UniswapV2
    address[] memory path = new address[](3);
    path[0] = CRV;
    path[1] = provider.getAddress('WFTM');
    path[2] = _tokenOut;

    IERC20(CRV).safeApprove(uniswapRouter, 0);
    IERC20(CRV).safeApprove(uniswapRouter, _linkAmount);

    uint256[] memory receivedAmounts = IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
      _linkAmount,
      minAmountFromPrice,
      path,
      address(this),
      block.timestamp
    );
    require(receivedAmounts[2] > 0, Errors.VT_PROCESS_YIELD_INVALID);
    require(
      IERC20(_tokenOut).balanceOf(address(this)) >= receivedAmounts[2],
      Errors.VT_PROCESS_YIELD_INVALID
    );

    // Make lendingPool to transfer required amount
    IERC20(_tokenOut).safeApprove(lendingPoolAddress, 0);
    IERC20(_tokenOut).safeApprove(lendingPoolAddress, receivedAmounts[2]);
    // Deposit yield to pool
    _depositYield(_tokenOut, receivedAmounts[2]);
  }

  /**
   * @dev Get yield amount based on strategy
   */
  function getYieldAmount() external view returns (uint256) {
    return _getYieldAmount(_addressesProvider.getAddress('YVCRV'));
  }

  /**
   * @dev Get price per share based on yield strategy
   */
  function pricePerShare() external view override returns (uint256) {
    return IYearnVault(_addressesProvider.getAddress('YVCRV')).pricePerShare();
  }

  /**
   * @dev Deposit to yield pool based on strategy and receive yvCRV
   */
  function _depositToYieldPool(address _asset, uint256 _amount)
    internal
    override
    returns (address, uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address YVCRV = provider.getAddress('YVCRV');
    address CRV = provider.getAddress('CRV');
    address lendingPoolAddress = provider.getLendingPool();

    // receive CRV from user
    require(_asset == CRV, Errors.VT_COLLATERAL_DEPOSIT_INVALID);
    IERC20(CRV).safeTransferFrom(msg.sender, address(this), _amount);

    // Deposit CRV to Yearn Vault and receive yvCRV
    IERC20(CRV).safeApprove(YVCRV, 0);
    IERC20(CRV).safeApprove(YVCRV, _amount);
    uint256 assetAmount = IYearnVault(YVCRV).deposit(_amount, address(this));

    // Make lendingPool to transfer required amount
    IERC20(YVCRV).safeApprove(lendingPoolAddress, 0);
    IERC20(YVCRV).safeApprove(lendingPoolAddress, assetAmount);
    return (YVCRV, assetAmount);
  }

  /**
   * @dev Get Withdrawal amount of yvCRV based on strategy
   */
  function _getWithdrawalAmount(address _asset, uint256 _amount)
    internal
    view
    override
    returns (address, uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;

    require(_asset == provider.getAddress('CRV'), Errors.VT_COLLATERAL_WITHDRAW_INVALID);

    // In this vault, return same amount of asset.
    return (provider.getAddress('YVCRV'), _amount);
  }

  /**
   * @dev Withdraw from yield pool based on strategy with yvCRV and deliver asset
   */
  function _withdrawFromYieldPool(
    address,
    uint256 _amount,
    address _to
  ) internal override returns (uint256) {
    ILendingPoolAddressesProvider provider = _addressesProvider;

    // Withdraw from Yearn Vault and receive CRV
    uint256 assetAmount = IYearnVault(provider.getAddress('YVCRV')).withdraw(
      _amount,
      address(this),
      1
    );

    // Deliver CRV to user
    address CRV = provider.getAddress('CRV');
    IERC20(CRV).safeTransfer(_to, assetAmount);
    return assetAmount;
  }

  /**
   * @dev Get the list of asset and asset's yield amount
   **/
  function _getAssetYields(uint256 _amount) internal view returns (AssetYield[] memory) {
    // Get total borrowing asset volume and volumes and assets
    (
      uint256 totalVolume,
      uint256[] memory volumes,
      address[] memory assets,
      uint256 length
    ) = ILendingPool(_addressesProvider.getLendingPool()).getBorrowingAssetAndVolumes();

    if (totalVolume == 0) return new AssetYield[](0);

    AssetYield[] memory assetYields = new AssetYield[](length);
    uint256 extraWETHAmount = _amount;

    for (uint256 i; i < length; ++i) {
      assetYields[i].asset = assets[i];
      if (i == length - 1) {
        // without calculation, set remained extra amount
        assetYields[i].amount = extraWETHAmount;
      } else {
        // Distribute wethAmount based on percent of asset volume
        assetYields[i].amount = _amount.percentMul(
          (volumes[i] * PercentageMath.PERCENTAGE_FACTOR) / totalVolume
        );
        extraWETHAmount -= assetYields[i].amount;
      }
    }

    return assetYields;
  }

  function _depositYield(address _asset, uint256 _amount) internal {
    ILendingPool(_addressesProvider.getLendingPool()).depositYield(_asset, _amount);
  }

  /**
   * @dev Move some yield to treasury
   */
  function _processTreasury(uint256 _yieldAmount) internal returns (uint256) {
    uint256 treasuryAmount = _yieldAmount.percentMul(_vaultFee);
    IERC20(_addressesProvider.getAddress('YVCRV')).safeTransfer(_treasuryAddress, treasuryAmount);
    return treasuryAmount;
  }
}
