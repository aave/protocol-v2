// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {BaseParaSwapAdapter} from './BaseParaSwapAdapter.sol';
import {PercentageMath} from '../protocol/libraries/math/PercentageMath.sol';
import {IParaSwapAugustus} from '../interfaces/IParaSwapAugustus.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';

/**
 * @title BaseParaSwapSellAdapter
 * @notice Implements the logic for selling tokens on ParaSwap
 * @author Jason Raymond Bell
 */
abstract contract BaseParaSwapSellAdapter is BaseParaSwapAdapter {
  using PercentageMath for uint256;

  constructor(
    ILendingPoolAddressesProvider addressesProvider
  ) public BaseParaSwapAdapter(addressesProvider) {
  }

  /**
   * @dev Swaps a token for another using ParaSwap
   * @param fromAmountOffset Offset of fromAmount in Augustus calldata if it should be overwritten, otherwise 0
   * @param swapCalldata Calldata for ParaSwap's AugustusSwapper contract
   * @param augustus Address of ParaSwap's AugustusSwapper contract
   * @param assetToSwapFrom Address of the asset to be swapped from
   * @param assetToSwapTo Address of the asset to be swapped to
   * @param amountToSwap Amount to be swapped
   * @param minAmountToReceive Minimum amount to be received from the swap
   * @return amountReceived The amount received from the swap
   */
  function _sellOnParaSwap(
    uint256 fromAmountOffset,
    bytes memory swapCalldata,
    address augustus,
    address assetToSwapFrom,
    address assetToSwapTo,
    uint256 amountToSwap,
    uint256 minAmountToReceive
  ) internal returns (uint256 amountReceived) {
    {
      uint256 fromAssetDecimals = _getDecimals(assetToSwapFrom);
      uint256 toAssetDecimals = _getDecimals(assetToSwapTo);

      uint256 fromAssetPrice = _getPrice(assetToSwapFrom);
      uint256 toAssetPrice = _getPrice(assetToSwapTo);

      uint256 expectedMinAmountOut =
        amountToSwap
          .mul(fromAssetPrice.mul(10**toAssetDecimals))
          .div(toAssetPrice.mul(10**fromAssetDecimals))
          .percentMul(PercentageMath.PERCENTAGE_FACTOR - MAX_SLIPPAGE_PERCENT);

      require(expectedMinAmountOut <= minAmountToReceive, 'MIN_AMOUNT_EXCEEDS_MAX_SLIPPAGE');
    }

    uint256 balanceBeforeAssetFrom = IERC20(assetToSwapFrom).balanceOf(address(this));
    require(balanceBeforeAssetFrom >= amountToSwap, 'INSUFFICIENT_BALANCE_BEFORE_SWAP');
    uint256 balanceBeforeAssetTo = IERC20(assetToSwapTo).balanceOf(address(this));

    address tokenTransferProxy = IParaSwapAugustus(augustus).getTokenTransferProxy();
    IERC20(assetToSwapFrom).safeApprove(tokenTransferProxy, 0);
    IERC20(assetToSwapFrom).safeApprove(tokenTransferProxy, amountToSwap);

    if (fromAmountOffset != 0) {
      // Ensure 256 bit (32 bytes) fromAmount value is within bounds of the
      // calldata, not overlapping with the first 4 bytes (function selector).
      require(fromAmountOffset >= 4 &&
        fromAmountOffset <= swapCalldata.length.sub(32),
        'FROM_AMOUNT_OFFSET_OUT_OF_RANGE');
      // Overwrite the fromAmount with the correct amount for the swap.
      // In memory, swapCalldata consists of a 256 bit length field, followed by
      // the actual bytes data, that is why 32 is added to the byte offset.
      assembly {
        mstore(add(swapCalldata, add(fromAmountOffset, 32)), amountToSwap)
      }
    }
    (bool success,) = augustus.call(swapCalldata);
    if (!success) {
      // Copy revert reason from call
      assembly {
        returndatacopy(0, 0, returndatasize())
        revert(0, returndatasize())
      }
    }
    require(IERC20(assetToSwapFrom).balanceOf(address(this)) == balanceBeforeAssetFrom - amountToSwap, 'WRONG_BALANCE_AFTER_SWAP');
    amountReceived = IERC20(assetToSwapTo).balanceOf(address(this)).sub(balanceBeforeAssetTo);
    require(amountReceived >= minAmountToReceive, 'INSUFFICIENT_AMOUNT_RECEIVED');

    emit Swapped(assetToSwapFrom, assetToSwapTo, amountToSwap, amountReceived);
  }
}
