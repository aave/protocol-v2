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
   * @param assets Address to be swapped
   * @param amounts Amount of the reserve to be swapped
   * @param premiums Fee of the flash loan
   * @param params Additional variadic field to include extra params. Expected parameters:
   *   address assetToSwapTo Address of the reserve to be swapped to and deposited
   *   address user The address of the user
   *   uint256 slippage The max slippage percentage allowed for the swap
   */
  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    bytes calldata params
  ) external override returns (bool) {
    (
      address assetToSwapTo,
      address user,
      uint256 slippage
    ) = abi.decode(params, (address, address, uint256));
    require(slippage < MAX_SLIPPAGE_PERCENT && slippage >= MIN_SLIPPAGE_PERCENT, 'SLIPPAGE_OUT_OF_RANGE');

    uint256 receivedAmount = swapExactTokensForTokens(assets[0], assetToSwapTo, amounts[0], slippage);

    // Deposit new reserve
    IERC20(assetToSwapTo).approve(address(pool), receivedAmount);
    pool.deposit(assetToSwapTo, receivedAmount, user, 0);

    uint256 flashLoanDebt = amounts[0].add(premiums[0]);
    pullATokenAndRepayFlashLoan(assets[0], user, flashLoanDebt);

    return true;
  }

  /**
   * @dev Swaps an `amountToSwap` of an asset to another and deposits the funds on behalf of the user without using a flashloan.
   * This method can be used when the user has no debts.
   * The user should give this contract allowance to pull the ATokens in order to withdraw the underlying asset and
   * perform the swap.
   * @param assetToSwapFrom Address of the underlying asset to be swap from
   * @param assetToSwapTo Address of the underlying asset to be swap to and deposited
   * @param amountToSwap How much `assetToSwapFrom` needs to be swapped
   * @param user Address that will be pulling the swapped funds
   * @param slippage The max slippage percentage allowed for the swap
   */
  function swapAndDeposit(
    address assetToSwapFrom,
    address assetToSwapTo,
    uint256 amountToSwap,
    address user,
    uint256 slippage
  ) external {
    pullAToken(assetToSwapFrom, user, amountToSwap);

    uint256 receivedAmount = swapExactTokensForTokens(assetToSwapFrom, assetToSwapTo, amountToSwap, slippage);

    // Deposit new reserve
    IERC20(assetToSwapTo).approve(address(pool), receivedAmount);
    pool.deposit(assetToSwapTo, receivedAmount, user, 0);
  }
}
