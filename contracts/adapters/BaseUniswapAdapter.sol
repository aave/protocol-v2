// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {PercentageMath} from '../libraries/math/PercentageMath.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {ReserveLogic} from '../libraries/logic/ReserveLogic.sol';
import {ReserveConfiguration} from '../libraries/configuration/ReserveConfiguration.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import {IPriceOracleGetter} from '../interfaces/IPriceOracleGetter.sol';


/**
 * @title BaseUniswapAdapter
 * @notice Implements the logic for performing assets swaps in Uniswap V2
 * @author Aave
 **/
contract BaseUniswapAdapter {
  using SafeMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;
  using ReserveConfiguration for ReserveConfiguration.Map;

  // Max slippage percent allow by param
  uint256 public constant MAX_SLIPPAGE_PERCENT = 3000; // 30%
  // Min slippage percent allow by param
  uint256 public constant MIN_SLIPPAGE_PERCENT = 10; // 0,1%

  ILendingPoolAddressesProvider public immutable addressesProvider;
  IUniswapV2Router02 public immutable uniswapRouter;
  ILendingPool public immutable pool;

  event Swapped(address fromAsset, address toAsset, uint256 fromAmount, uint256 receivedAmount);

  constructor(ILendingPoolAddressesProvider _addressesProvider, IUniswapV2Router02 _uniswapRouter) public {
    addressesProvider = _addressesProvider;
    pool = ILendingPool(_addressesProvider.getLendingPool());
    uniswapRouter = _uniswapRouter;
  }

  /**
   * @dev Swaps an `amountToSwap` of an asset to another
   * @param assetToSwapFrom Origin asset
   * @param assetToSwapTo Destination asset
   * @param amountToSwap Exact amount of `assetToSwapFrom` to be swapped
   * @param slippage the max slippage percentage allowed for the swap
   * @return the amount received from the swap
   */
  function swapExactTokensForTokens(
    address assetToSwapFrom,
    address assetToSwapTo,
    uint256 amountToSwap,
    uint256 slippage
  )
    internal
    returns (uint256)
  {
    uint256 fromAssetDecimals = getDecimals(assetToSwapFrom);
    uint256 toAssetDecimals = getDecimals(assetToSwapTo);

    (uint256 fromAssetPrice, uint256 toAssetPrice) = getPrices(assetToSwapFrom, assetToSwapTo);

    uint256 amountOutMin = amountToSwap
    .mul(fromAssetPrice.mul(10**toAssetDecimals))
    .div(toAssetPrice.mul(10**fromAssetDecimals))
    .percentMul(PercentageMath.PERCENTAGE_FACTOR.sub(slippage));

    IERC20(assetToSwapFrom).approve(address(uniswapRouter), amountToSwap);

    address[] memory path = new address[](2);
    path[0] = assetToSwapFrom;
    path[1] = assetToSwapTo;
    uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(amountToSwap, amountOutMin, path, address(this), block.timestamp);

    require(amounts[1] >= amountOutMin, 'INSUFFICIENT_OUTPUT_AMOUNT');

    emit Swapped(assetToSwapFrom, assetToSwapTo, amounts[0], amounts[1]);

    return amounts[1];
  }

  /**
   * @dev Receive an exact amount `amountToReceive` of `assetToSwapTo` tokens for as few `assetToSwapFrom` tokens as
   * possible.
   * @param assetToSwapFrom Origin asset
   * @param assetToSwapTo Destination asset
   * @param maxAmountToSwap Max amount of `assetToSwapFrom` allowed to be swapped
   * @param amountToReceive Exact amount of `assetToSwapTo` to receive
   * @return the amount received from the swap
   */
  function swapTokensForExactTokens(
    address assetToSwapFrom,
    address assetToSwapTo,
    uint256 maxAmountToSwap,
    uint256 amountToReceive
  )
    internal
    returns (uint256)
  {
    uint256 fromAssetDecimals = getDecimals(assetToSwapFrom);
    uint256 toAssetDecimals = getDecimals(assetToSwapTo);

    (uint256 fromAssetPrice, uint256 toAssetPrice) = getPrices(assetToSwapFrom, assetToSwapTo);

    uint256 expectedMaxAmountToSwap = amountToReceive
    .mul(toAssetPrice.mul(10**fromAssetDecimals))
    .div(fromAssetPrice.mul(10**toAssetDecimals))
    .percentMul(PercentageMath.PERCENTAGE_FACTOR.add(MAX_SLIPPAGE_PERCENT));

    require(maxAmountToSwap < expectedMaxAmountToSwap, 'maxAmountToSwap exceed max slippage');

    IERC20(assetToSwapFrom).approve(address(uniswapRouter), maxAmountToSwap);

    address[] memory path = new address[](2);
    path[0] = assetToSwapFrom;
    path[1] = assetToSwapTo;
    uint256[] memory amounts = uniswapRouter.swapTokensForExactTokens(amountToReceive, maxAmountToSwap, path, address(this), block.timestamp);

    require(amounts[1] >= amountToReceive, 'INSUFFICIENT_OUTPUT_AMOUNT');

    emit Swapped(assetToSwapFrom, assetToSwapTo, amounts[0], amounts[1]);

    return amounts[1];
  }

  /**
   * @dev Get assets prices from the oracle denominated in eth
   * @param assetToSwapFrom first asset
   * @param assetToSwapTo second asset
   * @return fromAssetPrice eth price for the first asset
   * @return toAssetPrice eth price for the second asset
   */
  function getPrices(
    address assetToSwapFrom,
    address assetToSwapTo
  )
    internal
    view
    returns (uint256 fromAssetPrice, uint256 toAssetPrice)
  {
    IPriceOracleGetter oracle = IPriceOracleGetter(addressesProvider.getPriceOracle());
    fromAssetPrice = oracle.getAssetPrice(assetToSwapFrom);
    toAssetPrice = oracle.getAssetPrice(assetToSwapTo);
  }

  /**
   * @dev Get the decimals of an asset
   * @return number of decimals of the asset
   */
  function getDecimals(address asset) internal view returns (uint256) {
    ReserveConfiguration.Map memory configuration = pool.getConfiguration(asset);
    (, , , uint256 decimals, ) = configuration.getParamsMemory();

    return decimals;
  }

  /**
   * @dev Get the aToken associated to the asset
   * @return address of the aToken
   */
  function getAToken(address asset) internal view returns (address) {
    ReserveLogic.ReserveData memory reserve = pool.getReserveData(asset);
    return reserve.aTokenAddress;
  }

  /**
   * @dev Take action with the swap left overs as configured in the parameters
   * @param asset address of the asset
   * @param reservedAmount Amount reserved to be used by the contract to repay the flash loan
   * @param leftOverAction Flag indicating what to do with the left over balance from the swap:
   *     (0) Deposit back
   *     (1) Direct transfer to user
   * @param user address
   */
  function sendLeftOver(address asset, uint256 reservedAmount, uint256 leftOverAction, address user) internal {
    uint256 balance = IERC20(asset).balanceOf(address(this));
    uint256 assetLeftOver = balance.sub(reservedAmount);

    if (assetLeftOver > 0) {
      if (leftOverAction == 0) {
        IERC20(asset).approve(address(pool), balance);
        pool.deposit(asset, assetLeftOver, user, 0);
      } else {
        IERC20(asset).transfer(user, assetLeftOver);
      }
    }
  }

  /**
   * @dev Take action with the swap left overs as configured in the parameters
   * @param reserve address of the asset
   * @param user address
   * @param flashLoanDebt need to be repaid
   */
  function pullATokenAndRepayFlashLoan(
    address reserve,
    address user,
    uint256 flashLoanDebt
  ) internal {
    address reserveAToken = getAToken(reserve);

    // transfer from user to adapter
    IERC20(reserveAToken).safeTransferFrom(user, address(this), flashLoanDebt);

    // withdraw reserve
    pool.withdraw(reserve, flashLoanDebt);

    // Repay flashloan
    IERC20(reserve).approve(address(pool), flashLoanDebt);
  }
}
