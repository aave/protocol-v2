// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {BaseUniswapAdapter} from './BaseUniswapAdapter.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import {IFlashLoanReceiver} from '../flashloan/interfaces/IFlashLoanReceiver.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';

/**
 * @title UniswapLiquiditySwapAdapter
 * @notice Uniswap V2 Adapter to swap liquidity using a flash loan.
 * @author Aave
 **/
contract UniswapLiquiditySwapAdapter is BaseUniswapAdapter, IFlashLoanReceiver {

  struct SwapParams {
    address[] assetToSwapToList;
    uint256 slippage;
    PermitParams permitParams;
  }

  constructor(
    ILendingPoolAddressesProvider addressesProvider,
    IUniswapV2Router02 uniswapRouter
  )
  public
  BaseUniswapAdapter(addressesProvider, uniswapRouter)
  {}

  /**
   * @dev Swaps the received reserve amount from the flashloan into the asset specified in the params.
   * The received funds from the swap are then deposited into the protocol on behalf of the user.
   * The user should give this contract allowance to pull the ATokens in order to withdraw the underlying asset and
   * repay the flash loan.
   * @param assets Address to be swapped
   * @param amounts Amount of the reserve to be swapped
   * @param premiums Fee of the flash loan
   * @param initiator Address of the user
   * @param params Additional variadic field to include extra params. Expected parameters:
   *   address[] assetToSwapToList List of the addresses of the reserve to be swapped to and deposited
   *   uint256 slippage The max slippage percentage allowed for the swap
   *   uint256[] deadline List of deadlines for the permit signature
   *   uint8[] v List of v param for the permit signature
   *   bytes32[] r List of r param for the permit signature
   *   bytes32[] s List of s param for the permit signature
   */
  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external override returns (bool) {
    require(msg.sender == address(POOL), "CALLER_MUST_BE_LENDING_POOL");

    SwapParams memory decodedParams = _decodeParams(params);

    require(
      decodedParams.slippage < MAX_SLIPPAGE_PERCENT && decodedParams.slippage >= MIN_SLIPPAGE_PERCENT,
      'SLIPPAGE_OUT_OF_RANGE'
    );

    require(
      decodedParams.assetToSwapToList.length == assets.length
      && assets.length == decodedParams.permitParams.deadline.length
      && assets.length == decodedParams.permitParams.v.length
      && assets.length == decodedParams.permitParams.r.length
      && assets.length == decodedParams.permitParams.s.length,
      'INCONSISTENT_PARAMS'
    );

    for (uint256 i = 0; i < assets.length; i++) {
      uint256 receivedAmount = swapExactTokensForTokens(
        assets[i],
        decodedParams.assetToSwapToList[i],
        amounts[i],
        decodedParams.slippage
      );

      // Deposit new reserve
      IERC20(decodedParams.assetToSwapToList[i]).approve(address(POOL), receivedAmount);
      POOL.deposit(decodedParams.assetToSwapToList[i], receivedAmount, initiator, 0);

      uint256 flashLoanDebt = amounts[i].add(premiums[i]);
      pullATokenAndRepayFlashLoan(
        assets[i],
        initiator,
        flashLoanDebt,
        PermitSignature(
          decodedParams.permitParams.deadline[i],
          decodedParams.permitParams.v[i],
          decodedParams.permitParams.r[i],
          decodedParams.permitParams.s[i]
        )
      );
    }

    return true;
  }

  /**
   * @dev Swaps an `amountToSwap` of an asset to another and deposits the funds on behalf of the user without using a flashloan.
   * This method can be used when the user has no debts.
   * The user should give this contract allowance to pull the ATokens in order to withdraw the underlying asset and
   * perform the swap.
   * @param assetToSwapFromList List of addresses of the underlying asset to be swap from
   * @param assetToSwapToList List of addresses of the underlying asset to be swap to and deposited
   * @param amountToSwapList List of amounts to be swapped
   * @param slippage The max slippage percentage allowed for the swap
   *   uint256[] deadline List of deadlines for the permit signature
   *   uint8[] v List of v param for the permit signature
   *   bytes32[] r List of r param for the permit signature
   *   bytes32[] s List of s param for the permit signature
   */
  function swapAndDeposit(
    address[] calldata assetToSwapFromList,
    address[] calldata assetToSwapToList,
    uint256[] calldata amountToSwapList,
    uint256 slippage,
    PermitSignature[] calldata permitParams
  ) external {
    require(
      assetToSwapFromList.length == assetToSwapToList.length
      && assetToSwapFromList.length == amountToSwapList.length
      && assetToSwapFromList.length == permitParams.length,
      'INCONSISTENT_PARAMS'
    );

    for (uint256 i = 0; i < assetToSwapFromList.length; i++) {
      pullAToken(
        assetToSwapFromList[i],
        msg.sender,
        amountToSwapList[i],
        permitParams[i]
      );

      uint256 receivedAmount = swapExactTokensForTokens(
        assetToSwapFromList[i],
        assetToSwapToList[i],
        amountToSwapList[i],
        slippage
      );

      // Deposit new reserve
      IERC20(assetToSwapToList[i]).approve(address(POOL), receivedAmount);
      POOL.deposit(assetToSwapToList[i], receivedAmount, msg.sender, 0);
    }
  }

  /**
 * @dev Decodes debt information encoded in flashloan params
 * @param params Additional variadic field to include extra params. Expected parameters:
   *   address[] assetToSwapToList List of the addresses of the reserve to be swapped to and deposited
   *   uint256 slippage The max slippage percentage allowed for the swap
   *   uint256[] deadline List of deadlines for the permit signature
   *   uint256[] deadline List of deadlines for the permit signature
   *   uint8[] v List of v param for the permit signature
   *   bytes32[] r List of r param for the permit signature
   *   bytes32[] s List of s param for the permit signature
 * @return SwapParams struct containing decoded params
 */
  function _decodeParams(bytes memory params) internal returns (SwapParams memory) {
    (
      address[] memory assetToSwapToList,
      uint256 slippage,
      uint256[] memory deadline,
      uint8[] memory v,
      bytes32[] memory r,
      bytes32[] memory s
    ) = abi.decode(params, (address[], uint256, uint256[], uint8[], bytes32[], bytes32[]));

    return SwapParams(assetToSwapToList, slippage, PermitParams(deadline, v, r, s));
  }
}
