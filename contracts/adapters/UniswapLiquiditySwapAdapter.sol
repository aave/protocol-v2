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

  constructor(
    ILendingPoolAddressesProvider _addressesProvider,
    IUniswapV2Router02 _uniswapRouter
  )
  public
  BaseUniswapAdapter(_addressesProvider, _uniswapRouter)
  {}

  /**
   * @dev Swaps the received reserve amount from the flashloan into the asset specified in the params.
   * The received funds from the swap are then deposited into the protocol on behalf of the user.
   * The user should give this contract allowance to pull the ATokens in order to withdraw the underlying asset and
   * repay the flash loan.
   * @param reserve Address to be swapped
   * @param amount Amount of the reserve to be swapped
   * @param fee Fee of the flash loan
   * @param params Additional variadic field to include extra params. Expected parameters:
   *   address assetToSwapTo Address of the reserve to be swapped to and deposited
   *   address user The address of the user
   *   uint256 slippage The max slippage percentage allowed for the swap
   */
  function executeOperation(
    address reserve,
    uint256 amount,
    uint256 fee,
    bytes calldata params
  ) external override returns (bool) {
    (
      address assetToSwapTo,
      address user,
      uint256 slippage
    ) = abi.decode(params, (address, address, uint256));
    require(slippage < MAX_SLIPPAGE_PERCENT && slippage >= MIN_SLIPPAGE_PERCENT, 'SLIPPAGE_OUT_OF_RANGE');

    uint256 receivedAmount = swapExactTokensForTokens(reserve, assetToSwapTo, amount, slippage);

    // Deposit new reserve
    IERC20(assetToSwapTo).approve(address(pool), receivedAmount);
    pool.deposit(assetToSwapTo, receivedAmount, user, 0);

    uint256 flashLoanDebt = amount.add(fee);
    pullATokenAndRepayFlashLoan(reserve, user, flashLoanDebt);

    return true;
  }
}
