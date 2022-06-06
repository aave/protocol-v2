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
 * @title YearnBOOVault
 * @notice yvBOO/BOO Vault by using Yearn on Fantom
 * @author Sturdy
 **/
contract YearnBOOVault is GeneralVault {
  using SafeERC20 for IERC20;
  using PercentageMath for uint256;

  function processYield() external override onlyYieldProcessor {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    // Get yield from lendingPool
    address YVBOO = provider.getAddress('YVBOO');
    uint256 yieldYVBOO = _getYield(YVBOO);

    // move yield to treasury
    if (_vaultFee > 0) {
      uint256 treasuryYVBOO = _processTreasury(yieldYVBOO);
      yieldYVBOO -= treasuryYVBOO;
    }

    // Withdraw from Yearn Vault and receive BOO
    uint256 yieldBOO = IYearnVault(YVBOO).withdraw(yieldYVBOO, address(this), 1);

    AssetYield[] memory assetYields = _getAssetYields(yieldBOO);
    uint256 length = assetYields.length;
    for (uint256 i; i < length; ++i) {
      // BOO -> Asset and Deposit to pool
      if (assetYields[i].amount > 0) {
        _convertAndDepositYield(assetYields[i].asset, assetYields[i].amount);
      }
    }

    emit ProcessYield(provider.getAddress('BOO'), yieldBOO);
  }

  function withdrawOnLiquidation(address _asset, uint256 _amount)
    external
    override
    returns (uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address BOO = provider.getAddress('BOO');

    require(_asset == BOO, Errors.LP_LIQUIDATION_CALL_FAILED);
    require(msg.sender == provider.getLendingPool(), Errors.LP_LIQUIDATION_CALL_FAILED);

    // Withdraw from Yearn Vault and receive BOO
    uint256 assetAmount = IYearnVault(provider.getAddress('YVBOO')).withdraw(
      _amount,
      address(this),
      1
    );

    // Deliver BOO to user
    IERC20(BOO).safeTransfer(msg.sender, assetAmount);

    return assetAmount;
  }

  function _convertAndDepositYield(address _tokenOut, uint256 _booAmount) internal {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address uniswapRouter = provider.getAddress('uniswapRouter');
    address BOO = provider.getAddress('BOO');
    address lendingPoolAddress = provider.getLendingPool();

    // Calculate minAmount from price with 2% slippage
    uint256 assetDecimal = IERC20Detailed(_tokenOut).decimals();
    IPriceOracleGetter oracle = IPriceOracleGetter(provider.getPriceOracle());
    uint256 minAmountFromPrice = ((((_booAmount *
      oracle.getAssetPrice(provider.getAddress('YVBOO'))) / 10**18) * 10**assetDecimal) /
      oracle.getAssetPrice(_tokenOut)).percentMul(98_00);

    // Exchange BOO -> _tokenOut via UniswapV2
    address[] memory path = new address[](3);
    path[0] = BOO;
    path[1] = provider.getAddress('WFTM');
    path[2] = _tokenOut;

    IERC20(BOO).safeApprove(uniswapRouter, 0);
    IERC20(BOO).safeApprove(uniswapRouter, _booAmount);

    uint256[] memory receivedAmounts = IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
      _booAmount,
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
    return _getYieldAmount(_addressesProvider.getAddress('YVBOO'));
  }

  /**
   * @dev Get price per share based on yield strategy
   */
  function pricePerShare() external view override returns (uint256) {
    return IYearnVault(_addressesProvider.getAddress('YVBOO')).pricePerShare();
  }

  /**
   * @dev Deposit to yield pool based on strategy and receive yvBOO
   */
  function _depositToYieldPool(address _asset, uint256 _amount)
    internal
    override
    returns (address, uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address YVBOO = provider.getAddress('YVBOO');
    address BOO = provider.getAddress('BOO');
    address lendingPoolAddress = provider.getLendingPool();

    // receive BOO from user
    require(_asset == BOO, Errors.VT_COLLATERAL_DEPOSIT_INVALID);
    IERC20(BOO).safeTransferFrom(msg.sender, address(this), _amount);

    // Deposit BOO to Yearn Vault and receive yvBOO
    IERC20(BOO).safeApprove(YVBOO, 0);
    IERC20(BOO).safeApprove(YVBOO, _amount);
    uint256 assetAmount = IYearnVault(YVBOO).deposit(_amount, address(this));

    // Make lendingPool to transfer required amount
    IERC20(YVBOO).safeApprove(lendingPoolAddress, 0);
    IERC20(YVBOO).safeApprove(lendingPoolAddress, assetAmount);
    return (YVBOO, assetAmount);
  }

  /**
   * @dev Get Withdrawal amount of yvBOO based on strategy
   */
  function _getWithdrawalAmount(address _asset, uint256 _amount)
    internal
    view
    override
    returns (address, uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;

    require(_asset == provider.getAddress('BOO'), Errors.VT_COLLATERAL_WITHDRAW_INVALID);

    // In this vault, return same amount of asset.
    return (provider.getAddress('YVBOO'), _amount);
  }

  /**
   * @dev Withdraw from yield pool based on strategy with yvBOO and deliver asset
   */
  function _withdrawFromYieldPool(
    address,
    uint256 _amount,
    address _to
  ) internal override returns (uint256) {
    ILendingPoolAddressesProvider provider = _addressesProvider;

    // Withdraw from Yearn Vault and receive BOO
    uint256 assetAmount = IYearnVault(provider.getAddress('YVBOO')).withdraw(
      _amount,
      address(this),
      1
    );

    // Deliver BOO to user
    address BOO = provider.getAddress('BOO');
    IERC20(BOO).safeTransfer(_to, assetAmount);
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
    IERC20(_addressesProvider.getAddress('YVBOO')).safeTransfer(_treasuryAddress, treasuryAmount);
    return treasuryAmount;
  }
}
