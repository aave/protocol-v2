// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {GeneralVault} from '../GeneralVault.sol';
import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IYearnVault} from '../../../interfaces/IYearnVault.sol';
import {IBalancerVault} from '../../../interfaces/IBalancerVault.sol';
import {IBalancerWeightedPool} from '../../../interfaces/IBalancerWeightedPool.sol';
import {IFBeetsToken} from '../../../interfaces/IFBeetsToken.sol';
import {IUniswapV2Router02} from '../../../interfaces/IUniswapV2Router02.sol';
import {Errors} from '../../libraries/helpers/Errors.sol';
import {SafeERC20} from '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {PercentageMath} from '../../libraries/math/PercentageMath.sol';
import {IERC20Detailed} from '../../../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {IPriceOracleGetter} from '../../../interfaces/IPriceOracleGetter.sol';
import {ILendingPool} from '../../../interfaces/ILendingPool.sol';
import {ILendingPoolAddressesProvider} from '../../../interfaces/ILendingPoolAddressesProvider.sol';

/**
 * @title YearnFBEETSVault
 * @notice yvfBEETS/fBEETS Vault by using Yearn on Fantom
 * @author Sturdy
 **/
contract YearnFBEETSVault is GeneralVault {
  using SafeERC20 for IERC20;
  using PercentageMath for uint256;

  address public beethovenVault = 0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce;
  bytes32 public beethovenSwapPoolId =
    0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019;
  bytes32 public beethoven_BEETS_FTM_PoolId =
    0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019;

  /**
   * @dev Set BeethOvenx Vault address
   */
  function setBeethovenVaultAddress(address _address) external payable onlyAdmin {
    beethovenVault = _address;
  }

  function getBeethovenVault() public view returns (IBalancerVault) {
    return IBalancerVault(beethovenVault);
  }

  /**
   * @dev Set BeethOvenx Swap Pool Id
   */
  function setBeethovenSwapPoolId(bytes32 _id) external payable onlyAdmin {
    beethovenSwapPoolId = _id;
  }

  /**
   * @dev Set BeethOvenx Liquidity Pool Id
   */
  function setBeethovenLiquidityPoolId(bytes32 _id) external payable onlyAdmin {
    beethoven_BEETS_FTM_PoolId = _id;
  }

  function processYield() external override onlyYieldProcessor {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    // Get yield from lendingPool
    address YVFBEETS = provider.getAddress('YVFBEETS');
    address BEETS = provider.getAddress('BEETS');
    address WFTM = provider.getAddress('WFTM');
    uint256 yieldYVFBEETS = _getYield(YVFBEETS);

    // move yield to treasury
    if (_vaultFee > 0) {
      uint256 treasuryYVFBEETS = _processTreasury(yieldYVFBEETS);
      yieldYVFBEETS -= treasuryYVFBEETS;
    }

    // Withdraw from Yearn Vault and receive fBEETS
    uint256 yieldFBEETS = IYearnVault(YVFBEETS).withdraw(yieldYVFBEETS, address(this), 1);

    uint256 _balanceOfBEETS = IERC20(BEETS).balanceOf(address(this));
    uint256 _balanceOfWFTM = IERC20(WFTM).balanceOf(address(this));

    // fBEETS -> (BEETS, WFTM)
    _withdrawLiquidityPool(yieldFBEETS);

    // BEETS -> WFTM
    uint256 balance = IERC20(BEETS).balanceOf(address(this));
    uint256 beetsAmount = balance - _balanceOfBEETS;
    require(beetsAmount > 0, Errors.LP_LIQUIDATION_CALL_FAILED);
    _swapBEETS2WFTM(beetsAmount);

    // WFTM -> stable coins
    balance = IERC20(WFTM).balanceOf(address(this));
    uint256 wftmAmount = balance - _balanceOfWFTM;
    AssetYield[] memory assetYields = _getAssetYields(wftmAmount);
    uint256 length = assetYields.length;
    for (uint256 i; i < length; ++i) {
      // WFTM -> Asset and Deposit to pool
      if (assetYields[i].amount > 0) {
        _convertAndDepositYield(assetYields[i].asset, assetYields[i].amount);
      }
    }

    emit ProcessYield(provider.getAddress('fBEETS'), yieldFBEETS);
  }

  function withdrawOnLiquidation(address _asset, uint256 _amount)
    external
    override
    returns (uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address fBEETS = provider.getAddress('fBEETS');

    require(_asset == fBEETS, Errors.LP_LIQUIDATION_CALL_FAILED);
    require(msg.sender == provider.getLendingPool(), Errors.LP_LIQUIDATION_CALL_FAILED);

    // Withdraw from Yearn Vault and receive fBEETS
    uint256 assetAmount = IYearnVault(provider.getAddress('YVFBEETS')).withdraw(
      _amount,
      address(this),
      1
    );

    // Deliver fBEETS to user
    IERC20(fBEETS).safeTransfer(msg.sender, assetAmount);

    return assetAmount;
  }

  /**
   * @dev Swap 'WFTM' using SpookySwap
   */
  function _convertAndDepositYield(address _tokenOut, uint256 _wftmAmount) internal {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address uniswapRouter = provider.getAddress('uniswapRouter');
    address WFTM = provider.getAddress('WFTM');
    address lendingPoolAddress = provider.getLendingPool();

    // Calculate minAmount from price with 2% slippage
    uint256 assetDecimal = IERC20Detailed(_tokenOut).decimals();
    IPriceOracleGetter oracle = IPriceOracleGetter(provider.getPriceOracle());
    uint256 minAmountFromPrice = ((((_wftmAmount *
      oracle.getAssetPrice(provider.getAddress('YVWFTM'))) / 10**18) * 10**assetDecimal) /
      oracle.getAssetPrice(_tokenOut)).percentMul(98_00);

    // Exchange WFTM -> _tokenOut via UniswapV2
    address[] memory path = new address[](2);
    path[0] = WFTM;
    path[1] = _tokenOut;

    IERC20(WFTM).safeApprove(uniswapRouter, 0);
    IERC20(WFTM).safeApprove(uniswapRouter, _wftmAmount);

    uint256[] memory receivedAmounts = IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
      _wftmAmount,
      minAmountFromPrice,
      path,
      address(this),
      block.timestamp
    );
    require(receivedAmounts[1] > 0, Errors.VT_PROCESS_YIELD_INVALID);
    require(
      IERC20(_tokenOut).balanceOf(address(this)) >= receivedAmounts[1],
      Errors.VT_PROCESS_YIELD_INVALID
    );

    // Make lendingPool to transfer required amount
    IERC20(_tokenOut).safeApprove(lendingPoolAddress, 0);
    IERC20(_tokenOut).safeApprove(lendingPoolAddress, receivedAmounts[1]);
    // Deposit yield to pool
    _depositYield(_tokenOut, receivedAmounts[1]);
  }

  function _calcSwapMinAmount(uint256 _beetsAmount) internal view returns (uint256) {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address WFTM = provider.getAddress('WFTM');
    uint256 assetDecimal = IERC20Detailed(WFTM).decimals();

    // Calculate minAmount from price with 2% slippage
    IPriceOracleGetter oracle = IPriceOracleGetter(provider.getPriceOracle());
    uint256 minAmountFromPrice = ((((_beetsAmount *
      oracle.getAssetPrice(provider.getAddress('BEETS'))) / 10**18) * 10**assetDecimal) /
      oracle.getAssetPrice(provider.getAddress('YVWFTM'))).percentMul(98_00);

    // Substract pool's swap fee
    (address swapPool, ) = getBeethovenVault().getPool(beethovenSwapPoolId);
    uint256 swapFee = IBalancerWeightedPool(swapPool).getSwapFeePercentage();

    return (minAmountFromPrice * (10**18 - swapFee)) / 10**18;
  }

  /**
   * @dev Swap BEETS -> WFTM
   */
  function _swapBEETS2WFTM(uint256 _beetsAmount) internal returns (uint256) {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    IBalancerVault.SingleSwap memory singleSwap;
    IBalancerVault.FundManagement memory funds;

    address BEETS = provider.getAddress('BEETS');
    address WFTM = provider.getAddress('WFTM');

    uint256 limit = _calcSwapMinAmount(_beetsAmount);
    // ToDo: Need to consider batchSwap, but, it's impossible now to implement Smart Order Router on-chain
    // Single Swap using The Fidelio Duetto Pool
    singleSwap.poolId = beethovenSwapPoolId;
    singleSwap.kind = IBalancerVault.SwapKind.GIVEN_IN;
    singleSwap.assetIn = BEETS;
    singleSwap.assetOut = WFTM;
    singleSwap.amount = _beetsAmount;

    funds.sender = address(this);
    funds.recipient = payable(address(this));
    funds.fromInternalBalance = false;
    funds.toInternalBalance = false;

    IERC20(BEETS).safeApprove(beethovenVault, 0);
    IERC20(BEETS).safeApprove(beethovenVault, _beetsAmount);

    uint256 receivedAmount = getBeethovenVault().swap(singleSwap, funds, limit, type(uint256).max);
    require(receivedAmount > 0, Errors.VT_PROCESS_YIELD_INVALID);

    return receivedAmount;
  }

  /**
   * @dev burn fBEETS token & withdraw (BEETS, WFTM)
   */
  function _withdrawLiquidityPool(uint256 _fbeetsAmount) internal {
    // burn fBEETS token
    address fBEETS = _addressesProvider.getAddress('fBEETS');
    address BEETS_FTM_Pool = IFBeetsToken(fBEETS).vestingToken();
    require(
      IBalancerWeightedPool(BEETS_FTM_Pool).getPoolId() == beethoven_BEETS_FTM_PoolId,
      Errors.VT_PROCESS_YIELD_INVALID
    );

    uint256 beforeOfBalance = IERC20(BEETS_FTM_Pool).balanceOf(address(this));
    IFBeetsToken(fBEETS).leave(_fbeetsAmount);
    uint256 afterOfBalance = IERC20(BEETS_FTM_Pool).balanceOf(address(this));
    uint256 _amount = afterOfBalance - beforeOfBalance;

    // Withdraw from LP
    // ToDo: calculate minimum amount from token balance
    // https://dev.balancer.fi/resources/joins-and-exits/pool-exits
    uint256 _totalAmount = IERC20(BEETS_FTM_Pool).totalSupply();
    (address[] memory tokens, uint256[] memory balances, ) = getBeethovenVault().getPoolTokens(
      beethoven_BEETS_FTM_PoolId
    );
    uint256 length = tokens.length;
    require(length == balances.length, Errors.VT_PROCESS_YIELD_INVALID);

    uint256[] memory amountsOut = new uint256[](length);
    for (uint256 i; i < length; ++i) {
      amountsOut[i] = ((balances[i] * _amount) / _totalAmount).percentMul(99_00);
    }

    getBeethovenVault().exitPool(
      beethoven_BEETS_FTM_PoolId,
      address(this),
      payable(address(this)),
      IBalancerVault.ExitPoolRequest({
        assets: tokens,
        minAmountsOut: amountsOut,
        userData: abi.encode(IBalancerWeightedPool.ExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT, _amount),
        toInternalBalance: false
      })
    );
  }

  /**
   * @dev Get yield amount based on strategy
   */
  function getYieldAmount() external view returns (uint256) {
    return _getYieldAmount(_addressesProvider.getAddress('YVFBEETS'));
  }

  /**
   * @dev Get price per share based on yield strategy
   */
  function pricePerShare() external view override returns (uint256) {
    return IYearnVault(_addressesProvider.getAddress('YVFBEETS')).pricePerShare();
  }

  /**
   * @dev Deposit to yield pool based on strategy and receive yvfBEETS
   */
  function _depositToYieldPool(address _asset, uint256 _amount)
    internal
    override
    returns (address, uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;
    address YVFBEETS = provider.getAddress('YVFBEETS');
    address fBEETS = provider.getAddress('fBEETS');
    address lendingPoolAddress = provider.getLendingPool();

    // receive fBEETS from user
    require(_asset == fBEETS, Errors.VT_COLLATERAL_DEPOSIT_INVALID);
    IERC20(fBEETS).safeTransferFrom(msg.sender, address(this), _amount);

    // Deposit fBEETS to Yearn Vault and receive yvfBEETS
    IERC20(fBEETS).safeApprove(YVFBEETS, 0);
    IERC20(fBEETS).safeApprove(YVFBEETS, _amount);
    uint256 assetAmount = IYearnVault(YVFBEETS).deposit(_amount, address(this));

    // Make lendingPool to transfer required amount
    IERC20(YVFBEETS).safeApprove(lendingPoolAddress, 0);
    IERC20(YVFBEETS).safeApprove(lendingPoolAddress, assetAmount);
    return (YVFBEETS, assetAmount);
  }

  /**
   * @dev Get Withdrawal amount of yvfBEETS based on strategy
   */
  function _getWithdrawalAmount(address _asset, uint256 _amount)
    internal
    view
    override
    returns (address, uint256)
  {
    ILendingPoolAddressesProvider provider = _addressesProvider;

    require(_asset == provider.getAddress('fBEETS'), Errors.VT_COLLATERAL_WITHDRAW_INVALID);

    // In this vault, return same amount of asset.
    return (provider.getAddress('YVFBEETS'), _amount);
  }

  /**
   * @dev Withdraw from yield pool based on strategy with yvfBEETS and deliver asset
   */
  function _withdrawFromYieldPool(
    address,
    uint256 _amount,
    address _to
  ) internal override returns (uint256) {
    ILendingPoolAddressesProvider provider = _addressesProvider;

    // Withdraw from Yearn Vault and receive fBEETS
    uint256 assetAmount = IYearnVault(provider.getAddress('YVFBEETS')).withdraw(
      _amount,
      address(this),
      1
    );

    // Deliver fBEETS to user
    address fBEETS = provider.getAddress('fBEETS');
    IERC20(fBEETS).safeTransfer(_to, assetAmount);
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
    IERC20(_addressesProvider.getAddress('YVFBEETS')).safeTransfer(
      _treasuryAddress,
      treasuryAmount
    );
    return treasuryAmount;
  }
}
