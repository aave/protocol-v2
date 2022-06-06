// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {GeneralVault} from '../GeneralVault.sol';
import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IYearnVault} from '../../../interfaces/IYearnVault.sol';
import {ICurvePool} from '../../../interfaces/ICurvePool.sol';
import {IWstETH} from '../../../interfaces/IWstETH.sol';
import {IWETH} from '../../../misc/interfaces/IWETH.sol';
import {Errors} from '../../libraries/helpers/Errors.sol';
import {SafeERC20} from '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {CurveswapAdapter} from '../../libraries/swap/CurveswapAdapter.sol';
import {PercentageMath} from '../../libraries/math/PercentageMath.sol';
import {ILendingPoolAddressesProvider} from '../../../interfaces/ILendingPoolAddressesProvider.sol';

/**
 * @title YearnRETHWstETHVault
 * @notice yvCurve-rETHwstETH/rETHwstETH-f Vault by using Yearn on Fantom
 * @author Sturdy
 **/
contract YearnRETHWstETHVault is GeneralVault {
  using SafeERC20 for IERC20;
  using PercentageMath for uint256;

  /**
   * @dev Receive Ether
   */
  receive() external payable {}

  function processYield() external override {
    // Get yield from lendingPool
    address YVRETH_WSTETH = _addressesProvider.getAddress('YVRETH_WSTETH');
    uint256 yieldYVRETH_WSTETH = _getYield(YVRETH_WSTETH);

    // move yield to treasury
    if (_vaultFee > 0) {
      uint256 treasuryYVRETH_WSTETH = _processTreasury(yieldYVRETH_WSTETH);
      yieldYVRETH_WSTETH -= treasuryYVRETH_WSTETH;
    }

    // Withdraw from Yearn Vault and receive rETHwstETH-f
    uint256 yieldRETH_WSTETH = IYearnVault(YVRETH_WSTETH).withdraw(
      yieldYVRETH_WSTETH,
      address(this),
      1
    );

    // Withdraw rETHwstETH-f from curve finance pool and receive wstETH
    uint256 yieldWstETH = _withdrawLiquidityPool(
      _addressesProvider.getAddress('RETH_WSTETH'),
      yieldRETH_WSTETH
    );

    // Unwrap wstETH and receive stETH
    uint256 yieldStETH = IWstETH(_addressesProvider.getAddress('WSTETH')).unwrap(yieldWstETH);

    // Exchange stETH -> ETH via Curve
    uint256 receivedETHAmount = CurveswapAdapter.swapExactTokensForTokens(
      _addressesProvider,
      _addressesProvider.getAddress('STETH_ETH_POOL'),
      _addressesProvider.getAddress('LIDO'),
      ETH,
      yieldStETH,
      200
    );

    // ETH -> WETH
    address weth = _addressesProvider.getAddress('WETH');
    IWETH(weth).deposit{value: receivedETHAmount}();

    // transfer WETH to yieldManager
    address yieldManager = _addressesProvider.getAddress('YIELD_MANAGER');
    IERC20(weth).safeTransfer(yieldManager, receivedETHAmount);

    emit ProcessYield(_addressesProvider.getAddress('RETH_WSTETH'), yieldRETH_WSTETH);
  }

  function withdrawOnLiquidation(address _asset, uint256 _amount)
    external
    override
    returns (uint256)
  {
    address RETH_WSTETH = _addressesProvider.getAddress('RETH_WSTETH');

    require(_asset == RETH_WSTETH, Errors.LP_LIQUIDATION_CALL_FAILED);
    require(msg.sender == _addressesProvider.getLendingPool(), Errors.LP_LIQUIDATION_CALL_FAILED);

    // Withdraw from Yearn Vault and receive RETH_WSTETH
    uint256 assetAmount = IYearnVault(_addressesProvider.getAddress('YVRETH_WSTETH')).withdraw(
      _amount,
      address(this),
      1
    );

    // Deliver RETH_WSTETH to user
    IERC20(RETH_WSTETH).safeTransfer(msg.sender, assetAmount);

    return assetAmount;
  }

  function _withdrawLiquidityPool(address _poolAddress, uint256 _amount)
    internal
    returns (uint256 amountWstETH)
  {
    uint256 minWstETHAmount = ICurvePool(_poolAddress).calc_withdraw_one_coin(_amount, 1, false);
    amountWstETH = ICurvePool(_poolAddress).remove_liquidity_one_coin(
      _amount,
      1,
      minWstETHAmount,
      address(this)
    );
  }

  /**
   * @dev Get yield amount based on strategy
   */
  function getYieldAmount() external view returns (uint256) {
    return _getYieldAmount(_addressesProvider.getAddress('YVRETH_WSTETH'));
  }

  /**
   * @dev Get price per share based on yield strategy
   */
  function pricePerShare() external view override returns (uint256) {
    return IYearnVault(_addressesProvider.getAddress('YVRETH_WSTETH')).pricePerShare();
  }

  /**
   * @dev Deposit to yield pool based on strategy and receive YVRETH_WSTETH
   */
  function _depositToYieldPool(address _asset, uint256 _amount)
    internal
    override
    returns (address, uint256)
  {
    address YVRETH_WSTETH = _addressesProvider.getAddress('YVRETH_WSTETH');
    address RETH_WSTETH = _addressesProvider.getAddress('RETH_WSTETH');
    address lendingPoolAddress = _addressesProvider.getLendingPool();

    // receive RETH_WSTETH from user
    require(_asset == RETH_WSTETH, Errors.VT_COLLATERAL_DEPOSIT_INVALID);
    IERC20(RETH_WSTETH).safeTransferFrom(msg.sender, address(this), _amount);

    // Deposit RETH_WSTETH to Yearn Vault and receive YVRETH_WSTETH
    IERC20(RETH_WSTETH).safeApprove(YVRETH_WSTETH, 0);
    IERC20(RETH_WSTETH).safeApprove(YVRETH_WSTETH, _amount);
    uint256 assetAmount = IYearnVault(YVRETH_WSTETH).deposit(_amount, address(this));

    // Make lendingPool to transfer required amount
    IERC20(YVRETH_WSTETH).safeApprove(lendingPoolAddress, 0);
    IERC20(YVRETH_WSTETH).safeApprove(lendingPoolAddress, assetAmount);
    return (YVRETH_WSTETH, assetAmount);
  }

  /**
   * @dev Get Withdrawal amount of YVRETH_WSTETH based on strategy
   */
  function _getWithdrawalAmount(address _asset, uint256 _amount)
    internal
    view
    override
    returns (address, uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;

    require(_asset == provider.getAddress('RETH_WSTETH'), Errors.VT_COLLATERAL_WITHDRAW_INVALID);

    // In this vault, return same amount of asset.
    return (provider.getAddress('YVRETH_WSTETH'), _amount);
  }

  /**
   * @dev Withdraw from yield pool based on strategy with YVRETH_WSTETH and deliver asset
   */
  function _withdrawFromYieldPool(
    address,
    uint256 _amount,
    address _to
  ) internal override returns (uint256) {
    ILendingPoolAddressesProvider provider = _addressesProvider;

    // Withdraw from Yearn Vault and receive RETH_WSTETH
    uint256 assetAmount = IYearnVault(provider.getAddress('YVRETH_WSTETH')).withdraw(
      _amount,
      address(this),
      1
    );

    // Deliver RETH_WSTETH to user
    address RETH_WSTETH = _addressesProvider.getAddress('RETH_WSTETH');
    IERC20(RETH_WSTETH).safeTransfer(_to, assetAmount);
    return assetAmount;
  }

  /**
   * @dev Move some yield to treasury
   */
  function _processTreasury(uint256 _yieldAmount) internal returns (uint256) {
    uint256 treasuryAmount = _yieldAmount.percentMul(_vaultFee);
    IERC20(_addressesProvider.getAddress('YVRETH_WSTETH')).safeTransfer(
      _treasuryAddress,
      treasuryAmount
    );
    return treasuryAmount;
  }
}
