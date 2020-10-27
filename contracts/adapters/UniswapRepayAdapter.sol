// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {BaseUniswapAdapter} from './BaseUniswapAdapter.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import {IFlashLoanReceiver} from '../flashloan/interfaces/IFlashLoanReceiver.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';

/**
 * @title UniswapRepayAdapter
 * @notice Uniswap V2 Adapter to perform a repay of a debt using a flash loan.
 * @author Aave
 **/
contract UniswapRepayAdapter is BaseUniswapAdapter, IFlashLoanReceiver {

  constructor(
    ILendingPoolAddressesProvider _addressesProvider,
    IUniswapV2Router02 _uniswapRouter
  )
  public
  BaseUniswapAdapter(_addressesProvider, _uniswapRouter)
  {}

  /**
   * @dev Swaps the received reserve amount into the asset specified in the params. The received funds from the swap are
   * then used to repay a debt on the protocol on behalf of the user.
   * The user should give this contract allowance to pull the ATokens in order to withdraw the underlying asset and
   * repay the flash loan.
   * @param reserve Address to be swapped
   * @param amount Amount of the reserve to be swapped
   * @param fee Fee of the flash loan
   * @param params Additional variadic field to include extra params. Expected parameters:
   *   address assetToSwapTo Address of the reserve to be swapped to and deposited
   *   address user The address of the user
   *   uint256 leftOverAction Flag indicating what to do with the left over balance from the swap:
   *     (0) Deposit back
   *     (1) Direct transfer to user
   *   uint256 repayAmount Amount of debt to be repaid
   *   uint256 rateMode The rate modes of the debt to be repaid
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
      uint256 leftOverAction,
      uint256 repayAmount,
      uint256 rateMode
    ) = abi.decode(params, (address, address, uint256, uint256, uint256));

    swapTokensForExactTokens(reserve, assetToSwapTo, amount, repayAmount);

    // Repay debt
    IERC20(assetToSwapTo).approve(address(pool), repayAmount);
    pool.repay(assetToSwapTo, repayAmount, rateMode, user);

    uint256 flashLoanDebt = amount.add(fee);
    pullATokenAndRepayFlashLoan(reserve, user, flashLoanDebt);

    // Take care of reserve leftover from the swap
    sendLeftOver(reserve, flashLoanDebt, leftOverAction, user);

    return true;
  }
}
