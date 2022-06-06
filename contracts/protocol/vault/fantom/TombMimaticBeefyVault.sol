// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {GeneralVault} from '../GeneralVault.sol';
import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IBeefyVault} from '../../../interfaces/IBeefyVault.sol';
import {IERC20Detailed} from '../../../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {IPriceOracleGetter} from '../../../interfaces/IPriceOracleGetter.sol';
import {IUniswapV2Router02} from '../../../interfaces/IUniswapV2Router02.sol';
import {Errors} from '../../libraries/helpers/Errors.sol';
import {SafeERC20} from '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {PercentageMath} from '../../libraries/math/PercentageMath.sol';
import {ILendingPool} from '../../../interfaces/ILendingPool.sol';
import {ILendingPoolAddressesProvider} from '../../../interfaces/ILendingPoolAddressesProvider.sol';

/**
 * @title TombMimaticBeefyVault
 * @notice mooTombTOMB-MIMATIC/TOMB_MIMATIC_LP Vault by using Beefy on Fantom
 * @author Sturdy
 **/
contract TombMimaticBeefyVault is GeneralVault {
  using SafeERC20 for IERC20;
  using PercentageMath for uint256;

  function processYield() external override onlyYieldProcessor {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    // Get yield from lendingPool
    address MOO_TOMB_MIMATIC = provider.getAddress('mooTombTOMB-MIMATIC');
    address TOMB_MIMATIC_LP = provider.getAddress('TOMB_MIMATIC_LP');
    uint256 yieldMOO_TOMB_MIMATIC = _getYield(MOO_TOMB_MIMATIC);

    // move yield to treasury
    if (_vaultFee > 0) {
      uint256 treasuryMOO_TOMB_MIMATIC = _processTreasury(yieldMOO_TOMB_MIMATIC);
      yieldMOO_TOMB_MIMATIC -= treasuryMOO_TOMB_MIMATIC;
    }

    // Withdraw from Beefy Vault and receive TOMB_MIMATIC_LP
    uint256 before = IERC20(TOMB_MIMATIC_LP).balanceOf(address(this));
    IBeefyVault(MOO_TOMB_MIMATIC).withdraw(yieldMOO_TOMB_MIMATIC);
    uint256 yieldTOMB_MIMATIC_LP = IERC20(TOMB_MIMATIC_LP).balanceOf(address(this)) - before;

    // Withdraw TOMB_MIMATIC_LP from spookyswap pool and receive MIMATIC and TOMB
    (uint256 yieldTOMB, uint256 yieldMIMATIC) = _withdrawLiquidityPool(
      TOMB_MIMATIC_LP,
      yieldTOMB_MIMATIC_LP
    );

    // Deposit TOMB Yield
    AssetYield[] memory assetYields = _getAssetYields(yieldTOMB);
    uint256 length = assetYields.length;
    for (uint256 i; i < length; ++i) {
      // TOMB -> Asset and Deposit to pool
      if (assetYields[i].amount > 0) {
        _convertAndDepositTokenYield(
          provider.getAddress('TOMB'),
          assetYields[i].asset,
          assetYields[i].amount
        );
      }
    }

    // Deposit MIMATIC Yield
    assetYields = _getAssetYields(yieldMIMATIC);
    length = assetYields.length;
    for (uint256 i; i < length; ++i) {
      // MIMATIC -> Asset and Deposit to pool
      if (assetYields[i].amount > 0) {
        _convertAndDepositTokenYield(
          provider.getAddress('MIMATIC'),
          assetYields[i].asset,
          assetYields[i].amount
        );
      }
    }

    emit ProcessYield(TOMB_MIMATIC_LP, yieldTOMB_MIMATIC_LP);
  }

  function withdrawOnLiquidation(address _asset, uint256 _amount)
    external
    override
    returns (uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address TOMB_MIMATIC_LP = provider.getAddress('TOMB_MIMATIC_LP');
    address MOO_TOMB_MIMATIC = provider.getAddress('mooTombTOMB-MIMATIC');

    require(_asset == TOMB_MIMATIC_LP, Errors.LP_LIQUIDATION_CALL_FAILED);
    require(msg.sender == provider.getLendingPool(), Errors.LP_LIQUIDATION_CALL_FAILED);

    // Withdraw from Beefy Vault and receive TOMB_MIMATIC_LP
    uint256 before = IERC20(TOMB_MIMATIC_LP).balanceOf(address(this));
    IBeefyVault(MOO_TOMB_MIMATIC).withdraw(_amount);
    uint256 assetAmount = IERC20(TOMB_MIMATIC_LP).balanceOf(address(this)) - before;

    // Deliver TOMB_MIMATIC_LP to user
    IERC20(TOMB_MIMATIC_LP).safeTransfer(msg.sender, assetAmount);

    return assetAmount;
  }

  function _withdrawLiquidityPool(address _poolAddress, uint256 _amount)
    internal
    returns (uint256 amountTOMB, uint256 amountMIMATIC)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address tombSwapRouter = provider.getAddress('tombSwapRouter');

    // Calculate minAmount from price with 1% slippage
    IPriceOracleGetter oracle = IPriceOracleGetter(provider.getPriceOracle());
    uint256 minTotalPrice = ((_amount *
      oracle.getAssetPrice(provider.getAddress('mooTombTOMB-MIMATIC'))) / 2).percentMul(99_00);

    uint256 minMiMaticAmountFromPrice = minTotalPrice /
      oracle.getAssetPrice(provider.getAddress('MIMATIC'));

    uint256 minTombAmountFromPrice = minTotalPrice /
      oracle.getAssetPrice(provider.getAddress('TOMB'));

    IERC20(_poolAddress).safeApprove(tombSwapRouter, 0);
    IERC20(_poolAddress).safeApprove(tombSwapRouter, _amount);
    (amountTOMB, amountMIMATIC) = IUniswapV2Router02(tombSwapRouter).removeLiquidity(
      provider.getAddress('TOMB'),
      provider.getAddress('MIMATIC'),
      _amount,
      minTombAmountFromPrice,
      minMiMaticAmountFromPrice,
      address(this),
      block.timestamp
    );
  }

  function _convertAndDepositTokenYield(
    address _tokenIn,
    address _tokenOut,
    uint256 _tokenAmount
  ) internal {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address uniswapRouter = provider.getAddress('uniswapRouter');
    address lendingPoolAddress = provider.getLendingPool();

    // Calculate minAmount from price with 2% slippage
    (uint256 minAmount, address[] memory path) = _getPathAndMinAmount(
      _tokenIn,
      _tokenOut,
      _tokenAmount
    );

    IERC20(_tokenIn).safeApprove(uniswapRouter, 0);
    IERC20(_tokenIn).safeApprove(uniswapRouter, _tokenAmount);

    uint256[] memory receivedAmounts = IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
      _tokenAmount,
      minAmount,
      path,
      address(this),
      block.timestamp
    );
    require(receivedAmounts[path.length - 1] > 0, Errors.VT_PROCESS_YIELD_INVALID);
    require(
      IERC20(_tokenOut).balanceOf(address(this)) >= receivedAmounts[path.length - 1],
      Errors.VT_PROCESS_YIELD_INVALID
    );

    // Make lendingPool to transfer required amount
    IERC20(_tokenOut).safeApprove(lendingPoolAddress, 0);
    IERC20(_tokenOut).safeApprove(lendingPoolAddress, receivedAmounts[path.length - 1]);
    // Deposit yield to pool
    _depositYield(_tokenOut, receivedAmounts[path.length - 1]);
  }

  function _getPathAndMinAmount(
    address _tokenIn,
    address _tokenOut,
    uint256 _tokenAmount
  ) internal view returns (uint256 minAmount, address[] memory path) {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    uint256 inputAssetDecimal = IERC20Detailed(_tokenIn).decimals();
    uint256 outputAssetDecimal = IERC20Detailed(_tokenOut).decimals();
    IPriceOracleGetter oracle = IPriceOracleGetter(provider.getPriceOracle());

    uint256 minTotalPrice = (_tokenAmount * oracle.getAssetPrice(_tokenIn)) / 10**inputAssetDecimal;

    minAmount = ((minTotalPrice * 10**outputAssetDecimal) / oracle.getAssetPrice(_tokenOut))
      .percentMul(98_00);

    if (_tokenIn == provider.getAddress('TOMB')) {
      path = new address[](3);
      path[0] = _tokenIn;
      path[1] = provider.getAddress('WFTM');
      path[2] = _tokenOut;
    } else if (_tokenOut == provider.getAddress('USDC')) {
      // _tokenIn = MIMATIC
      path = new address[](2);
      path[0] = _tokenIn;
      path[1] = provider.getAddress('USDC');
    } else {
      path = new address[](3);
      path[0] = _tokenIn;
      path[1] = provider.getAddress('USDC');
      path[2] = _tokenOut;
    }
  }

  /**
   * @dev Get yield amount based on strategy
   */
  function getYieldAmount() external view returns (uint256) {
    return _getYieldAmount(_addressesProvider.getAddress('mooTombTOMB-MIMATIC'));
  }

  /**
   * @dev Get price per share based on yield strategy
   */
  function pricePerShare() external view override returns (uint256) {
    return IBeefyVault(_addressesProvider.getAddress('mooTombTOMB-MIMATIC')).getPricePerFullShare();
  }

  /**
   * @dev Deposit to yield pool based on strategy and receive mooTombTOMB-MIMATIC
   */
  function _depositToYieldPool(address _asset, uint256 _amount)
    internal
    override
    returns (address, uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address MOO_TOMB_MIMATIC = provider.getAddress('mooTombTOMB-MIMATIC');
    address TOMB_MIMATIC_LP = provider.getAddress('TOMB_MIMATIC_LP');
    address lendingPoolAddress = provider.getLendingPool();

    require(_asset == TOMB_MIMATIC_LP, Errors.VT_COLLATERAL_DEPOSIT_INVALID);
    IERC20(TOMB_MIMATIC_LP).safeTransferFrom(msg.sender, address(this), _amount);

    // Deposit TOMB_MIMATIC_LP to Beefy Vault and receive mooTombTOMB-MIMATIC
    IERC20(TOMB_MIMATIC_LP).safeApprove(MOO_TOMB_MIMATIC, 0);
    IERC20(TOMB_MIMATIC_LP).safeApprove(MOO_TOMB_MIMATIC, _amount);

    uint256 before = IERC20(MOO_TOMB_MIMATIC).balanceOf(address(this));
    IBeefyVault(MOO_TOMB_MIMATIC).deposit(_amount);
    uint256 assetAmount = IERC20(MOO_TOMB_MIMATIC).balanceOf(address(this)) - before;

    // Make lendingPool to transfer required amount
    IERC20(MOO_TOMB_MIMATIC).safeApprove(lendingPoolAddress, 0);
    IERC20(MOO_TOMB_MIMATIC).safeApprove(lendingPoolAddress, assetAmount);
    return (MOO_TOMB_MIMATIC, assetAmount);
  }

  /**
   * @dev Get Withdrawal amount of mooTombTOMB-MIMATIC based on strategy
   */
  function _getWithdrawalAmount(address _asset, uint256 _amount)
    internal
    view
    override
    returns (address, uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;

    require(
      _asset == provider.getAddress('TOMB_MIMATIC_LP'),
      Errors.VT_COLLATERAL_WITHDRAW_INVALID
    );

    // In this vault, return same amount of asset.
    return (provider.getAddress('mooTombTOMB-MIMATIC'), _amount);
  }

  /**
   * @dev Withdraw from yield pool based on strategy with mooTombTOMB-MIMATIC and deliver asset
   */
  function _withdrawFromYieldPool(
    address,
    uint256 _amount,
    address _to
  ) internal override returns (uint256) {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address TOMB_MIMATIC_LP = provider.getAddress('TOMB_MIMATIC_LP');

    // Withdraw from Beefy Vault and receive TOMB_MIMATIC_LP
    uint256 before = IERC20(TOMB_MIMATIC_LP).balanceOf(address(this));
    IBeefyVault(provider.getAddress('mooTombTOMB-MIMATIC')).withdraw(_amount);
    uint256 assetAmount = IERC20(TOMB_MIMATIC_LP).balanceOf(address(this)) - before;

    // Deliver TOMB_MIMATIC_LP to user
    IERC20(TOMB_MIMATIC_LP).safeTransfer(_to, assetAmount);
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
    IERC20(_addressesProvider.getAddress('mooTombTOMB-MIMATIC')).safeTransfer(
      _treasuryAddress,
      treasuryAmount
    );
    return treasuryAmount;
  }
}
