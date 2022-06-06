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
 * @title YearnSPELLVault
 * @notice yvSPELL/SPELL Vault by using Yearn on Fantom
 * @author Sturdy
 **/
contract YearnSPELLVault is GeneralVault {
  using SafeERC20 for IERC20;
  using PercentageMath for uint256;

  function processYield() external override onlyYieldProcessor {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    // Get yield from lendingPool
    address YVSPELL = provider.getAddress('YVSPELL');
    uint256 yieldYVSPELL = _getYield(YVSPELL);

    // move yield to treasury
    if (_vaultFee > 0) {
      uint256 treasuryYVSPELL = _processTreasury(yieldYVSPELL);
      yieldYVSPELL -= treasuryYVSPELL;
    }

    // Withdraw from Yearn Vault and receive SPELL
    uint256 yieldSPELL = IYearnVault(YVSPELL).withdraw(yieldYVSPELL, address(this), 1);

    AssetYield[] memory assetYields = _getAssetYields(yieldSPELL);
    uint256 length = assetYields.length;
    for (uint256 i; i < length; ++i) {
      // SPELL -> Asset and Deposit to pool
      if (assetYields[i].amount > 0) {
        _convertAndDepositYield(assetYields[i].asset, assetYields[i].amount);
      }
    }

    emit ProcessYield(provider.getAddress('SPELL'), yieldSPELL);
  }

  function withdrawOnLiquidation(address _asset, uint256 _amount)
    external
    override
    returns (uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address SPELL = provider.getAddress('SPELL');

    require(_asset == SPELL, Errors.LP_LIQUIDATION_CALL_FAILED);
    require(msg.sender == provider.getLendingPool(), Errors.LP_LIQUIDATION_CALL_FAILED);

    // Withdraw from Yearn Vault and receive SPELL
    uint256 assetAmount = IYearnVault(provider.getAddress('YVSPELL')).withdraw(
      _amount,
      address(this),
      1
    );

    // Deliver SPELL to user
    IERC20(SPELL).safeTransfer(msg.sender, assetAmount);

    return assetAmount;
  }

  function _convertAndDepositYield(address _tokenOut, uint256 _spellAmount) internal {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address uniswapRouter = provider.getAddress('uniswapRouter');
    address SPELL = provider.getAddress('SPELL');
    address lendingPoolAddress = provider.getLendingPool();

    // Calculate minAmount from price with 2% slippage
    uint256 assetDecimal = IERC20Detailed(_tokenOut).decimals();
    IPriceOracleGetter oracle = IPriceOracleGetter(provider.getPriceOracle());
    uint256 minAmountFromPrice = ((((_spellAmount *
      oracle.getAssetPrice(provider.getAddress('YVSPELL'))) / 10**18) * 10**assetDecimal) /
      oracle.getAssetPrice(_tokenOut)).percentMul(98_00);

    // Exchange SPELL -> _tokenOut via UniswapV2
    address[] memory path = new address[](3);
    path[0] = SPELL;
    path[1] = provider.getAddress('WFTM');
    path[2] = _tokenOut;

    IERC20(SPELL).safeApprove(uniswapRouter, 0);
    IERC20(SPELL).safeApprove(uniswapRouter, _spellAmount);

    uint256[] memory receivedAmounts = IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
      _spellAmount,
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
    return _getYieldAmount(_addressesProvider.getAddress('YVSPELL'));
  }

  /**
   * @dev Get price per share based on yield strategy
   */
  function pricePerShare() external view override returns (uint256) {
    return IYearnVault(_addressesProvider.getAddress('YVSPELL')).pricePerShare();
  }

  /**
   * @dev Deposit to yield pool based on strategy and receive yvSPELL
   */
  function _depositToYieldPool(address _asset, uint256 _amount)
    internal
    override
    returns (address, uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address YVSPELL = provider.getAddress('YVSPELL');
    address SPELL = provider.getAddress('SPELL');
    address lendingPoolAddress = provider.getLendingPool();

    // receive SPELL from user
    require(_asset == SPELL, Errors.VT_COLLATERAL_DEPOSIT_INVALID);
    IERC20(SPELL).safeTransferFrom(msg.sender, address(this), _amount);

    // Deposit SPELL to Yearn Vault and receive yvSPELL
    IERC20(SPELL).safeApprove(YVSPELL, 0);
    IERC20(SPELL).safeApprove(YVSPELL, _amount);
    uint256 assetAmount = IYearnVault(YVSPELL).deposit(_amount, address(this));

    // Make lendingPool to transfer required amount
    IERC20(YVSPELL).safeApprove(lendingPoolAddress, 0);
    IERC20(YVSPELL).safeApprove(lendingPoolAddress, assetAmount);
    return (YVSPELL, assetAmount);
  }

  /**
   * @dev Get Withdrawal amount of yvSPELL based on strategy
   */
  function _getWithdrawalAmount(address _asset, uint256 _amount)
    internal
    view
    override
    returns (address, uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;

    require(_asset == provider.getAddress('SPELL'), Errors.VT_COLLATERAL_WITHDRAW_INVALID);

    // In this vault, return same amount of asset.
    return (provider.getAddress('YVSPELL'), _amount);
  }

  /**
   * @dev Withdraw from yield pool based on strategy with yvSPELL and deliver asset
   */
  function _withdrawFromYieldPool(
    address,
    uint256 _amount,
    address _to
  ) internal override returns (uint256) {
    ILendingPoolAddressesProvider provider = _addressesProvider;

    // Withdraw from Yearn Vault and receive SPELL
    uint256 assetAmount = IYearnVault(provider.getAddress('YVSPELL')).withdraw(
      _amount,
      address(this),
      1
    );

    // Deliver SPELL to user
    address SPELL = provider.getAddress('SPELL');
    IERC20(SPELL).safeTransfer(_to, assetAmount);
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
    IERC20(_addressesProvider.getAddress('YVSPELL')).safeTransfer(_treasuryAddress, treasuryAmount);
    return treasuryAmount;
  }
}
