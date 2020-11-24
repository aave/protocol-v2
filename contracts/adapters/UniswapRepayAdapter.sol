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
    address collateralAsset;
    uint256 collateralAmount;
    uint256 rateMode;
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
   * @dev Uses the received funds from the flash loan to repay a debt on the protocol on behalf of the user. Then pulls
   * the collateral from the user and swaps it to repay the flash loan.
   * The user should give this contract allowance to pull the ATokens in order to withdraw the underlying asset, swap it
   * and repay the flash loan.
   * @param assets Address to be swapped
   * @param amounts Amount of the reserve to be swapped
   * @param premiums Fee of the flash loan
   * @param initiator Address of the user
   * @param params Additional variadic field to include extra params. Expected parameters:
   *   address collateralAsset Address of the reserve to be swapped
   *   uint256 collateralAmount Amount of reserve to be swapped
   *   uint256 rateMode Rate modes of the debt to be repaid
   *   RepayMode repayMode Enum indicating the repaid mode
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
        decodedParams.collateralAsset,
        assets[0],
        amounts[0],
        decodedParams.collateralAmount,
        decodedParams.rateMode,
        initiator,
        premiums[0],
        decodedParams.permitSignature
      );

    return true;
  }

  function swapAndRepay(
    address collateralAsset,
    address debtAsset,
    uint256 collateralAmount,
    uint256 debtRepayAmount,
    uint256 debtRateMode,
    PermitSignature calldata permitSignature
  ) external {
    ReserveLogic.ReserveData memory reserveData = _getReserveData(collateralAsset);

    if (collateralAsset != debtAsset) {
      // Get exact collateral needed for the swap to avoid leftovers
      uint256[] memory amounts = _getAmountsIn(collateralAsset, debtAsset, debtRepayAmount);
      require(amounts[0] <= collateralAmount, 'slippage too high');

      // Pull aTokens from user
      _pullAToken(collateralAsset, reserveData.aTokenAddress, msg.sender, amounts[0], permitSignature);

      // Swap collateral for debt asset
      _swapTokensForExactTokens(collateralAsset, debtAsset, amounts[0], debtRepayAmount);
    } else {
      // Pull aTokens from user
      _pullAToken(collateralAsset, reserveData.aTokenAddress, msg.sender, debtRepayAmount, permitSignature);
    }

    // Repay debt
    IERC20(debtAsset).approve(address(POOL), debtRepayAmount);
    POOL.repay(debtAsset, debtRepayAmount, debtRateMode, msg.sender);

    // In the case the repay amount provided exceeded the actual debt, send the leftovers to the user
    _sendLeftovers(debtAsset, msg.sender);
  }


  /**
   * @dev Perform the repay of the debt, pulls the initiator collateral and swaps to repay the flash loan
   *
   * @param assetFrom Address of token to be swapped
   * @param assetTo Address of debt token to be received from the swap
   * @param amount Amount of the debt to be repaid
   * @param collateralAmount Amount of the reserve to be swapped
   * @param rateMode Rate mode of the debt to be repaid
   * @param initiator Address of the user
   * @param premium Fee of the flash loan
   * @param permitSignature struct containing the permit signature
   */
  function _swapAndRepay(
    address assetFrom,
    address assetTo,
    uint256 amount,
    uint256 collateralAmount,
    uint256 rateMode,
    address initiator,
    uint256 premium,
    PermitSignature memory permitSignature
  ) internal {
    // Repay debt
    IERC20(assetTo).approve(address(POOL), amount);
    POOL.repay(assetTo, amount, rateMode, initiator);
    uint256 debtRepayLeftovers = IERC20(assetTo).balanceOf(address(this));

    uint256 flashLoanDebt = amount.add(premium);
    uint256 neededForFlashLoanDebt = flashLoanDebt.sub(debtRepayLeftovers);

    // Pull aTokens from user
    ReserveLogic.ReserveData memory reserveData = _getReserveData(assetFrom);
    _pullAToken(assetFrom, reserveData.aTokenAddress, initiator, collateralAmount, permitSignature);

    uint256 amountSwapped = _swapTokensForExactTokens(assetFrom, assetTo, collateralAmount, neededForFlashLoanDebt);

    // Send collateral leftovers from swap to the user
    _sendLeftovers(assetFrom, initiator);

    // Repay flashloan
    IERC20(assetTo).approve(address(POOL), flashLoanDebt);
  }

  /**
   * @dev Decodes debt information encoded in flashloan params
   * @param params Additional variadic field to include extra params. Expected parameters:
   *   address collateralAsset Address of the reserve to be swapped
   *   uint256 collateralAmount Amount of reserve to be swapped
   *   uint256 rateMode Rate modes of the debt to be repaid
   *   uint256 permitAmount Amount for the permit signature
   *   uint256 deadline Deadline for the permit signature
   *   uint8 v V param for the permit signature
   *   bytes32 r R param for the permit signature
   *   bytes32 s S param for the permit signature
   * @return RepayParams struct containing decoded params
   */
  function _decodeParams(bytes memory params) internal pure returns (RepayParams memory) {
    (
      address collateralAsset,
      uint256 collateralAmount,
      uint256 rateMode,
      uint256 permitAmount,
      uint256 deadline,
      uint8 v,
      bytes32 r,
      bytes32 s
    ) = abi.decode(params, (address, uint256, uint256, uint256, uint256, uint8, bytes32, bytes32));

    return RepayParams(
      collateralAsset,
      collateralAmount,
      rateMode,
      PermitSignature(
        permitAmount,
        deadline,
        v,
        r,
        s
      )
    );
  }

  /**
  * @dev Transfers the balance of the adapter to the user, as there shouldn't be any leftover in the adapter
  * @param asset address of the asset
  * @param user address
  */
  function _sendLeftovers(address asset, address user) internal {
    uint256 assetLeftover = IERC20(asset).balanceOf(address(this));

    if (assetLeftover > 0) {
      IERC20(asset).transfer(user, assetLeftover);
    }
  }
}
