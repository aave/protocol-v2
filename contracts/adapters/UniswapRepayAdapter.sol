// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {BaseUniswapAdapter} from './BaseUniswapAdapter.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import {IFlashLoanReceiver} from '../flashloan/interfaces/IFlashLoanReceiver.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {ReserveLogic} from '../libraries/logic/ReserveLogic.sol';

/**
 * @title UniswapRepayAdapter
 * @notice Uniswap V2 Adapter to perform a repay of a debt using a flash loan.
 * @author Aave
 **/
contract UniswapRepayAdapter is BaseUniswapAdapter, IFlashLoanReceiver {

  struct RepayParams {
    address assetToSwapTo;
    uint256 repayAmount;
    uint256 rateMode;
    bool repayAllDebt;
    PermitSignature permitSignature;
  }

  constructor(
    ILendingPoolAddressesProvider addressesProvider,
    IUniswapV2Router02 uniswapRouter
  )
  public
  BaseUniswapAdapter(addressesProvider, uniswapRouter)
  {}

  /**
   * @dev Swaps the received reserve amount into the asset specified in the params. The received funds from the swap are
   * then used to repay a debt on the protocol on behalf of the user.
   * The user should give this contract allowance to pull the ATokens in order to withdraw the underlying asset and
   * repay the flash loan.
   * @param assets Address to be swapped
   * @param amounts Amount of the reserve to be swapped
   * @param premiums Fee of the flash loan
   * @param initiator Address of the user
   * @param params Additional variadic field to include extra params. Expected parameters:
   *   address Address of the reserve to be swapped to and repay
   *   uint256 repayAmount Amount of debt to be repaid
   *   uint256 rateMode Rate modes of the debt to be repaid
   *   bool repayAllDebt Flag indicating if all the debt should be repaid
   *   uint256 permitAmount Amount for the permit signature
   *   uint256 deadline Deadline for the permit signature
   *   uint8 v V param for the permit signature
   *   bytes32 r R param for the permit signature
   *   bytes32 s S param for the permit signature
   */
  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external override returns (bool) {
    require(msg.sender == address(POOL), "CALLER_MUST_BE_LENDING_POOL");

    RepayParams memory decodedParams = _decodeParams(params);

      _swapAndRepay(
        assets[0],
        decodedParams.assetToSwapTo,
        amounts[0],
        decodedParams.repayAmount,
        decodedParams.rateMode,
        initiator,
        decodedParams.repayAllDebt,
        premiums[0],
        decodedParams.permitSignature
      );

    return true;
  }

  /**
   * @dev Perform the swap and the repay of the debt
   *
   * @param assetFrom Address of token to be swapped
   * @param assetTo Address of token to be received
   * @param amount Amount of the reserve to be swapped
   * @param repayAmount Amount of the debt to be repaid
   * @param rateMode Rate mode of the debt to be repaid
   * @param initiator Address of the user
   * @param premium Fee of the flash loan
   * @param permitSignature struct containing the permit signature
   */
  function _swapAndRepay(
    address assetFrom,
    address assetTo,
    uint256 amount,
    uint256 repayAmount,
    uint256 rateMode,
    address initiator,
    bool repayAllDebt,
    uint256 premium,
    PermitSignature memory permitSignature
  ) internal {
    if (repayAllDebt) {
      ReserveLogic.ReserveData memory reserveDebtData = _getReserveData(assetTo);

      address debtToken = ReserveLogic.InterestRateMode(rateMode) == ReserveLogic.InterestRateMode.STABLE
        ? reserveDebtData.stableDebtTokenAddress
        : reserveDebtData.variableDebtTokenAddress;

      repayAmount = IERC20(debtToken).balanceOf(initiator);
    }

    uint256 amountSwapped = _swapTokensForExactTokens(assetFrom, assetTo, amount, repayAmount);

    // Repay debt
    IERC20(assetTo).approve(address(POOL), repayAmount);
    POOL.repay(assetTo, repayAmount, rateMode, initiator);

    uint256 flashLoanDebt = amount.add(premium);
    uint256 amountToPull = flashLoanDebt.sub(amount.sub(amountSwapped));

    ReserveLogic.ReserveData memory reserveData = _getReserveData(assetFrom);
    _pullAToken(assetFrom, reserveData.aTokenAddress, initiator, amountToPull, permitSignature);

    // Repay flashloan
    IERC20(assetFrom).approve(address(POOL), flashLoanDebt);
  }

  /**
   * @dev Decodes debt information encoded in flashloan params
   * @param params Additional variadic field to include extra params. Expected parameters:
   *   address Address of the reserve to be swapped to and repay
   *   uint256 repayAmount Amount of debt to be repaid
   *   uint256 rateMode Rate modes of the debt to be repaid
   *   bool repayAllDebt Flag indicating if all the debt should be repaid
   *   uint256 permitAmount Amount for the permit signature
   *   uint256 deadline Deadline for the permit signature
   *   uint8 v V param for the permit signature
   *   bytes32 r R param for the permit signature
   *   bytes32 s S param for the permit signature
   * @return RepayParams struct containing decoded params
   */
  function _decodeParams(bytes memory params) internal pure returns (RepayParams memory) {
    (
      address assetToSwapTo,
      uint256 repayAmount,
      uint256 rateMode,
      bool repayAllDebt,
      uint256 permitAmount,
      uint256 deadline,
      uint8 v,
      bytes32 r,
      bytes32 s
    ) = abi.decode(params, (address, uint256, uint256, bool, uint256, uint256, uint8, bytes32, bytes32));

    return RepayParams(
      assetToSwapTo,
      repayAmount,
      rateMode,
      repayAllDebt,
      PermitSignature(
        permitAmount,
        deadline,
        v,
        r,
        s
      )
    );
  }
}
