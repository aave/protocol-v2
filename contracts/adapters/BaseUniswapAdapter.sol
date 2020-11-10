// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {PercentageMath} from '../libraries/math/PercentageMath.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {IERC20Detailed} from '../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {ReserveLogic} from '../libraries/logic/ReserveLogic.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import {IPriceOracleGetter} from '../interfaces/IPriceOracleGetter.sol';
import {IERC20WithPermit} from '../interfaces/IERC20WithPermit.sol';

/**
 * @title BaseUniswapAdapter
 * @notice Implements the logic for performing assets swaps in Uniswap V2
 * @author Aave
 **/
contract BaseUniswapAdapter {
  using SafeMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  struct PermitSignature {
    uint256 amount;
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  struct AmountCalc {
    uint256 calculatedAmount;
    uint256 relativePrice;
    uint256 amountInUsd;
    uint256 amountOutUsd;
  }

  // Max slippage percent allowed
  uint256 public constant MAX_SLIPPAGE_PERCENT = 3000; // 30%
  // FLash Loan fee set in lending pool
  uint256 public constant FLASHLOAN_PREMIUM_TOTAL = 9;
  // USD oracle asset address
  address public constant USD_ADDRESS = 0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96;

  ILendingPool public immutable POOL;
  IPriceOracleGetter public immutable ORACLE;
  IUniswapV2Router02 public immutable UNISWAP_ROUTER;

  event Swapped(address fromAsset, address toAsset, uint256 fromAmount, uint256 receivedAmount);

  constructor(ILendingPoolAddressesProvider addressesProvider, IUniswapV2Router02 uniswapRouter) public {
    POOL = ILendingPool(addressesProvider.getLendingPool());
    ORACLE = IPriceOracleGetter(addressesProvider.getPriceOracle());
    UNISWAP_ROUTER = uniswapRouter;
  }

  /**
 * @dev Given an input asset amount, returns the maximum output amount of the other asset and the prices
 * @param amountIn Amount of reserveIn
 * @param reserveIn Address of the asset to be swap from
 * @param reserveOut Address of the asset to be swap to
 * @return uint256 Amount out of the reserveOut
 * @return uint256 The price of out amount denominated in the reserveIn currency (18 decimals)
 * @return uint256 In amount of reserveIn value denominated in USD (8 decimals)
 * @return uint256 Out amount of reserveOut value denominated in USD (8 decimals)
 */
  function getAmountsOut(uint256 amountIn, address reserveIn, address reserveOut)
    external
    view
    returns (uint256, uint256, uint256, uint256)
  {
    AmountCalc memory results = _getAmountsOut(reserveIn, reserveOut, amountIn);

    return (
      results.calculatedAmount,
      results.relativePrice,
      results.amountInUsd,
      results.amountOutUsd
    );
  }

  /**
   * @dev Returns the minimum input asset amount required to buy the given output asset amount and the prices
   * @param amountOut Amount of reserveOut
   * @param reserveIn Address of the asset to be swap from
   * @param reserveOut Address of the asset to be swap to
   * @return uint256 Amount in of the reserveIn
   * @return uint256 The price of in amount denominated in the reserveOut currency (18 decimals)
   * @return uint256 In amount of reserveIn value denominated in USD (8 decimals)
   * @return uint256 Out amount of reserveOut value denominated in USD (8 decimals)
   */
  function getAmountsIn(uint256 amountOut, address reserveIn, address reserveOut)
    external
    view
    returns (uint256, uint256, uint256, uint256)
  {
    AmountCalc memory results = _getAmountsIn(reserveIn, reserveOut, amountOut);

    return (
      results.calculatedAmount,
      results.relativePrice,
      results.amountInUsd,
      results.amountOutUsd
    );
  }

  /**
   * @dev Swaps an exact `amountToSwap` of an asset to another
   * @param assetToSwapFrom Origin asset
   * @param assetToSwapTo Destination asset
   * @param amountToSwap Exact amount of `assetToSwapFrom` to be swapped
   * @param minAmountOut the min amount of `assetToSwapTo` to be received from the swap
   * @return the amount received from the swap
   */
  function _swapExactTokensForTokens(
    address assetToSwapFrom,
    address assetToSwapTo,
    uint256 amountToSwap,
    uint256 minAmountOut
  )
    internal
    returns (uint256)
  {
    uint256 fromAssetDecimals = _getDecimals(assetToSwapFrom);
    uint256 toAssetDecimals = _getDecimals(assetToSwapTo);

    uint256 fromAssetPrice = _getPrice(assetToSwapFrom);
    uint256 toAssetPrice = _getPrice(assetToSwapTo);

    uint256 expectedMinAmountOut = amountToSwap
      .mul(fromAssetPrice.mul(10**toAssetDecimals))
      .div(toAssetPrice.mul(10**fromAssetDecimals))
      .percentMul(PercentageMath.PERCENTAGE_FACTOR.sub(MAX_SLIPPAGE_PERCENT));

    require(expectedMinAmountOut < minAmountOut, 'minAmountOut exceed max slippage');

    IERC20(assetToSwapFrom).approve(address(UNISWAP_ROUTER), amountToSwap);

    address[] memory path = new address[](2);
    path[0] = assetToSwapFrom;
    path[1] = assetToSwapTo;
    uint256[] memory amounts = UNISWAP_ROUTER.swapExactTokensForTokens(amountToSwap, minAmountOut, path, address(this), block.timestamp);

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
   * @return the amount swapped
   */
  function _swapTokensForExactTokens(
    address assetToSwapFrom,
    address assetToSwapTo,
    uint256 maxAmountToSwap,
    uint256 amountToReceive
  )
    internal
    returns (uint256)
  {
    uint256 fromAssetDecimals = _getDecimals(assetToSwapFrom);
    uint256 toAssetDecimals = _getDecimals(assetToSwapTo);

    uint256 fromAssetPrice = _getPrice(assetToSwapFrom);
    uint256 toAssetPrice = _getPrice(assetToSwapTo);

    uint256 expectedMaxAmountToSwap = amountToReceive
      .mul(toAssetPrice.mul(10**fromAssetDecimals))
      .div(fromAssetPrice.mul(10**toAssetDecimals))
      .percentMul(PercentageMath.PERCENTAGE_FACTOR.add(MAX_SLIPPAGE_PERCENT));

    require(maxAmountToSwap < expectedMaxAmountToSwap, 'maxAmountToSwap exceed max slippage');

    IERC20(assetToSwapFrom).approve(address(UNISWAP_ROUTER), maxAmountToSwap);

    address[] memory path = new address[](2);
    path[0] = assetToSwapFrom;
    path[1] = assetToSwapTo;
    uint256[] memory amounts = UNISWAP_ROUTER.swapTokensForExactTokens(amountToReceive, maxAmountToSwap, path, address(this), block.timestamp);

    emit Swapped(assetToSwapFrom, assetToSwapTo, amounts[0], amounts[1]);

    return amounts[0];
  }

  /**
   * @dev Get the price of the asset from the oracle denominated in eth
   * @param asset address
   * @return eth price for the asset
   */
  function _getPrice(address asset) internal view returns (uint256) {
    return ORACLE.getAssetPrice(asset);
  }

  /**
   * @dev Get the decimals of an asset
   * @return number of decimals of the asset
   */
  function _getDecimals(address asset) internal view returns (uint256) {
    return IERC20Detailed(asset).decimals();
  }

  /**
   * @dev Get the aToken associated to the asset
   * @return address of the aToken
   */
  function _getReserveData(address asset) internal view returns (ReserveLogic.ReserveData memory) {
    return POOL.getReserveData(asset);
  }

  /**
   * @dev Pull the ATokens from the user
   * @param reserve address of the asset
   * @param reserveAToken address of the aToken of the reserve
   * @param user address
   * @param amount of tokens to be transferred to the contract
   * @param permitSignature struct containing the permit signature
   */
  function _pullAToken(
    address reserve,
    address reserveAToken,
    address user,
    uint256 amount,
    PermitSignature memory permitSignature
  ) internal {
    if (_usePermit(permitSignature)) {
      IERC20WithPermit(reserveAToken).permit(
        user,
        address(this),
        permitSignature.amount,
        permitSignature.deadline,
        permitSignature.v,
        permitSignature.r,
        permitSignature.s
      );
    }

    // transfer from user to adapter
    IERC20(reserveAToken).safeTransferFrom(user, address(this), amount);

    // withdraw reserve
    POOL.withdraw(reserve, amount, address(this));
  }

  /**
   * @dev Tells if the permit method should be called by inspecting if there is a valid signature.
   * If signature params are set to 0, then permit won't be called.
   * @param signature struct containing the permit signature
   * @return whether or not permit should be called
   */
  function _usePermit(PermitSignature memory signature) internal pure returns (bool) {
    return !(uint256(signature.deadline) == uint256(signature.v) && uint256(signature.deadline) == 0);
  }

  /**
   * @dev Calculates the value denominated in USD
   * @param reserve Address of the reserve
   * @param amount Amount of the reserve
   * @param decimals Decimals of the reserve
   * @return whether or not permit should be called
   */
  function _calcUsdValue(address reserve, uint256 amount, uint256 decimals) internal view returns (uint256) {
    uint256 ethUsdPrice = _getPrice(USD_ADDRESS);
    uint256 reservePrice = _getPrice(reserve);

    return amount
      .mul(reservePrice)
      .div(10**decimals)
      .mul(ethUsdPrice)
      .div(10**18);
  }

  /**
   * @dev Given an input asset amount, returns the maximum output amount of the other asset
   * @param reserveIn Address of the asset to be swap from
   * @param reserveOut Address of the asset to be swap to
   * @param amountIn Amount of reserveIn
   * @return Struct containing the following information:
   *   uint256 Amount out of the reserveOut
   *   uint256 The price of out amount denominated in the reserveIn currency (18 decimals)
   *   uint256 In amount of reserveIn value denominated in USD (8 decimals)
   *   uint256 Out amount of reserveOut value denominated in USD (8 decimals)
   */
  function _getAmountsOut(address reserveIn, address reserveOut, uint256 amountIn) internal view returns (AmountCalc memory) {
    // Subtract flash loan fee
    uint256 finalAmountIn = amountIn.sub(amountIn.mul(FLASHLOAN_PREMIUM_TOTAL).div(10000));

    address[] memory path = new address[](2);
    path[0] = reserveIn;
    path[1] = reserveOut;

    uint256[] memory amounts = UNISWAP_ROUTER.getAmountsOut(finalAmountIn, path);

    uint256 reserveInDecimals = _getDecimals(reserveIn);
    uint256 reserveOutDecimals = _getDecimals(reserveOut);

    uint256 outPerInPrice = finalAmountIn
      .mul(10**18)
      .mul(10**reserveOutDecimals)
      .div(amounts[1].mul(10**reserveInDecimals));

    return AmountCalc(
      amounts[1],
      outPerInPrice,
      _calcUsdValue(reserveIn, amountIn, reserveInDecimals),
      _calcUsdValue(reserveOut, amounts[1], reserveOutDecimals)
    );
  }

  /**
   * @dev Returns the minimum input asset amount required to buy the given output asset amount
   * @param reserveIn Address of the asset to be swap from
   * @param reserveOut Address of the asset to be swap to
   * @param amountOut Amount of reserveOut
   * @return Struct containing the following information:
   *   uint256 Amount in of the reserveIn
   *   uint256 The price of in amount denominated in the reserveOut currency (18 decimals)
   *   uint256 In amount of reserveIn value denominated in USD (8 decimals)
   *   uint256 Out amount of reserveOut value denominated in USD (8 decimals)
   */
  function _getAmountsIn(address reserveIn, address reserveOut, uint256 amountOut) internal view returns (AmountCalc memory) {
    address[] memory path = new address[](2);
    path[0] = reserveIn;
    path[1] = reserveOut;

    uint256[] memory amounts = UNISWAP_ROUTER.getAmountsIn(amountOut, path);

    // Subtract flash loan fee
    uint256 finalAmountIn = amounts[0].sub(amounts[0].mul(FLASHLOAN_PREMIUM_TOTAL).div(10000));

    uint256 reserveInDecimals = _getDecimals(reserveIn);
    uint256 reserveOutDecimals = _getDecimals(reserveOut);

    uint256 inPerOutPrice = amountOut
      .mul(10**18)
      .mul(10**reserveInDecimals)
      .div(finalAmountIn.mul(10**reserveOutDecimals));

    return AmountCalc(
      finalAmountIn,
      inPerOutPrice,
      _calcUsdValue(reserveIn, finalAmountIn, reserveInDecimals),
      _calcUsdValue(reserveOut, amountOut, reserveOutDecimals)
    );
  }
}
