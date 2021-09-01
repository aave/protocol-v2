// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {BaseParaSwapAdapter} from './BaseParaSwapAdapter.sol';
import {PercentageMath} from '../protocol/libraries/math/PercentageMath.sol';
import {IParaSwapAugustus} from '../interfaces/IParaSwapAugustus.sol';
import {IParaSwapAugustusRegistry} from '../interfaces/IParaSwapAugustusRegistry.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IERC20Detailed} from '../dependencies/openzeppelin/contracts/IERC20Detailed.sol';

/**
 * @title BaseParaSwapBuyAdapter
 * @notice Implements the logic for buying tokens on ParaSwap
 */
abstract contract BaseParaSwapBuyAdapter is BaseParaSwapAdapter {
  using PercentageMath for uint256;

  IParaSwapAugustusRegistry public immutable AUGUSTUS_REGISTRY;

  constructor(
    ILendingPoolAddressesProvider addressesProvider,
    IParaSwapAugustusRegistry augustusRegistry
  ) public BaseParaSwapAdapter(addressesProvider) {
    // Do something on Augustus registry to check the right contract was passed
    require(!augustusRegistry.isValidAugustus(address(0)));
    AUGUSTUS_REGISTRY = augustusRegistry;
  }

  /**
   * @dev Swaps a token for another using ParaSwap
   * @param toAmountOffset Offset of toAmount in Augustus calldata if it should be overwritten, otherwise 0
   * @param paraswapData Data for Paraswap Adapter
   * @param assetToSwapFrom Address of the asset to be swapped from
   * @param assetToSwapTo Address of the asset to be swapped to
   * @param maxAmountToSwap Max amount to be swapped
   * @param amountToReceive Amount to be received from the swap
   * @return amountSold The amount sold during the swap
   */
  function _buyOnParaSwap(
    uint256 toAmountOffset,
    bytes memory paraswapData,
    IERC20Detailed assetToSwapFrom,
    IERC20Detailed assetToSwapTo,
    uint256 maxAmountToSwap,
    uint256 amountToReceive
  ) internal returns (uint256 amountSold) {
    (bytes memory buyCalldata, IParaSwapAugustus augustus) =
      abi.decode(paraswapData, (bytes, IParaSwapAugustus));

    require(AUGUSTUS_REGISTRY.isValidAugustus(address(augustus)), 'INVALID_AUGUSTUS');

    {
      uint256 fromAssetDecimals = _getDecimals(assetToSwapFrom);
      uint256 toAssetDecimals = _getDecimals(assetToSwapTo);

      uint256 fromAssetPrice = _getPrice(address(assetToSwapFrom));
      uint256 toAssetPrice = _getPrice(address(assetToSwapTo));

      uint256 expectedMaxAmountToSwap =
        amountToReceive
          .mul(toAssetPrice.mul(10**fromAssetDecimals))
          .div(fromAssetPrice.mul(10**toAssetDecimals))
          .percentMul(PercentageMath.PERCENTAGE_FACTOR.add(MAX_SLIPPAGE_PERCENT));

      require(maxAmountToSwap <= expectedMaxAmountToSwap, 'maxAmountToSwap exceed max slippage');
    }

    uint256 balanceBeforeAssetFrom = assetToSwapFrom.balanceOf(address(this));
    require(balanceBeforeAssetFrom >= maxAmountToSwap, 'INSUFFICIENT_BALANCE_BEFORE_SWAP');
    uint256 balanceBeforeAssetTo = assetToSwapTo.balanceOf(address(this));

    address tokenTransferProxy = augustus.getTokenTransferProxy();
    assetToSwapFrom.safeApprove(tokenTransferProxy, 0);
    assetToSwapFrom.safeApprove(tokenTransferProxy, maxAmountToSwap);

    if (toAmountOffset != 0) {
      // Ensure 256 bit (32 bytes) toAmountOffset value is within bounds of the
      // calldata, not overlapping with the first 4 bytes (function selector).
      require(
        toAmountOffset >= 4 && toAmountOffset <= buyCalldata.length.sub(32),
        'TO_AMOUNT_OFFSET_OUT_OF_RANGE'
      );
      // Overwrite the toAmount with the correct amount for the buy.
      // In memory, buyCalldata consists of a 256 bit length field, followed by
      // the actual bytes data, that is why 32 is added to the byte offset.
      assembly {
        mstore(add(buyCalldata, add(toAmountOffset, 32)), amountToReceive)
      }
    }
    (bool success, ) = address(augustus).call(buyCalldata);
    if (!success) {
      // Copy revert reason from call
      assembly {
        returndatacopy(0, 0, returndatasize())
        revert(0, returndatasize())
      }
    }

    uint256 balanceAfterAssetFrom = assetToSwapFrom.balanceOf(address(this));
    amountSold = balanceBeforeAssetFrom - balanceAfterAssetFrom;
    require(amountSold <= maxAmountToSwap, 'WRONG_BALANCE_AFTER_SWAP');
    uint256 amountReceived = assetToSwapTo.balanceOf(address(this)).sub(balanceBeforeAssetTo);
    require(amountReceived >= amountToReceive, 'INSUFFICIENT_AMOUNT_RECEIVED');

    emit Bought(address(assetToSwapFrom), address(assetToSwapTo), amountSold, amountReceived);
  }
}
