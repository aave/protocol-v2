// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {BaseParaSwapBuyAdapter} from './BaseParaSwapBuyAdapter.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {DataTypes} from '../protocol/libraries/types/DataTypes.sol';
import {IParaSwapAugustus} from '../interfaces/IParaSwapAugustus.sol';
import {IParaSwapAugustusRegistry} from '../interfaces/IParaSwapAugustusRegistry.sol';
import {ReentrancyGuard} from '../dependencies/openzeppelin/contracts/ReentrancyGuard.sol';
import {IERC20Detailed} from '../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {IERC20WithPermit} from '../interfaces/IERC20WithPermit.sol';

/**
 * @title UniswapRepayAdapter
 * @notice Uniswap V2 Adapter to perform a repay of a debt with collateral.
 * @author Aave
 **/
contract ParaSwapRepayAdapter is BaseParaSwapBuyAdapter, ReentrancyGuard {
  struct RepayParams {
    address collateralAsset;
    uint256 collateralAmount;
    uint256 rateMode;
    PermitSignature permitSignature;
    bool useEthPath;
  }

  constructor(
    ILendingPoolAddressesProvider addressesProvider,
    IParaSwapAugustusRegistry augustusRegistry
  ) public BaseParaSwapBuyAdapter(addressesProvider, augustusRegistry) {
    // This is only required to initialize BaseParaSwapBuyAdapter
  }

  /**
   * @dev Uses the received funds from the flash loan to repay a debt on the protocol on behalf of the user. Then pulls
   * the collateral from the user and swaps it to the debt asset to repay the flash loan.
   * The user should give this contract allowance to pull the ATokens in order to withdraw the underlying asset, swap it
   * and repay the flash loan.
   * Supports only one asset on the flash loan.
   * @param assets Address of debt asset
   * @param amounts Amount of the debt to be repaid
   * @param premiums Fee of the flash loan
   * @param initiator Address of the user
   * @param params Additional variadic field to include extra params. Expected parameters:
   *   address collateralAsset Address of the reserve to be swapped
   *   uint256 collateralAmount Amount of reserve to be swapped
   *   uint256 rateMode Rate modes of the debt to be repaid
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
    require(msg.sender == address(LENDING_POOL), 'CALLER_MUST_BE_LENDING_POOL');

    RepayParams memory decodedParams = _decodeParams(params);

    /**_swapAndRepay(
      decodedParams.collateralAsset,
      assets[0],
      amounts[0],
      decodedParams.collateralAmount,
      decodedParams.rateMode,
      initiator,
      premiums[0],
      decodedParams.permitSignature,
      decodedParams.useEthPath
    );*/

    return true;
  }

  /**
   * @dev Swaps the user collateral for the debt asset and then repay the debt on the protocol on behalf of the user
   * without using flash loans. This method can be used when the temporary transfer of the collateral asset to this
   * contract does not affect the user position.
   * The user should give this contract allowance to pull the ATokens in order to withdraw the underlying asset
   * @param collateralAsset Address of asset to be swapped
   * @param debtAsset Address of debt asset
   * @param collateralAmount max Amount of the collateral to be swapped
   * @param debtRepayAmount Amount of the debt to be repaid, or maximum amount when repaying entire debt
   * @param debtRateMode Rate mode of the debt to be repaid
   * @param buyAllBalanceOffset Set to offset of toAmount in Augustus calldata if wanting to pay entire debt, otherwise 0
   * @param paraswapData Data for Paraswap Adapter
   * @param permitSignature struct containing the permit signature

   */
  function swapAndRepay(
    IERC20Detailed collateralAsset,
    IERC20Detailed debtAsset,
    uint256 collateralAmount,
    uint256 debtRepayAmount,
    uint256 debtRateMode,
    uint256 buyAllBalanceOffset,
    bytes calldata paraswapData,
    PermitSignature calldata permitSignature
  ) external nonReentrant {
    IERC20WithPermit aToken =
      IERC20WithPermit(_getReserveData(address(collateralAsset)).aTokenAddress);

    DataTypes.ReserveData memory debtReserveData = _getReserveData(address(debtAsset));

    address debtToken =
      DataTypes.InterestRateMode(debtRateMode) == DataTypes.InterestRateMode.STABLE
        ? debtReserveData.stableDebtTokenAddress
        : debtReserveData.variableDebtTokenAddress;

    if (buyAllBalanceOffset != 0) {
      uint256 currentDebt = IERC20(debtToken).balanceOf(msg.sender);
      require(currentDebt <= debtRepayAmount, 'INSUFFICIENT_AMOUNT_TO_REPAY');
      debtRepayAmount = currentDebt;
    }

    // Pull aTokens from user
    _pullATokenAndWithdraw(
      address(collateralAsset),
      aToken,
      msg.sender,
      collateralAmount,
      permitSignature
    );
    //buy debt asset using collateral asset
    uint256 amountSold =
      _buyOnParaSwap(
        buyAllBalanceOffset,
        paraswapData,
        collateralAsset,
        debtAsset,
        collateralAmount,
        debtRepayAmount
      );

    uint256 collateralBalanceLeft = collateralAmount - amountSold;

    //deposit collateral back in the pool, if left after the swap(buy)
    if (collateralBalanceLeft > 0) {
      LENDING_POOL.deposit(address(collateralAsset), collateralBalanceLeft, msg.sender, 0);
    }

    // Repay debt. Approves 0 first to comply with tokens that implement the anti frontrunning approval fix
    IERC20(debtAsset).safeApprove(address(LENDING_POOL), 0);
    IERC20(debtAsset).safeApprove(address(LENDING_POOL), debtRepayAmount);
    LENDING_POOL.repay(address(debtAsset), debtRepayAmount, debtRateMode, msg.sender);
  }

  /**
   * @dev Perform the repay of the debt, pulls the initiator collateral and swaps to repay the flash loan
   *
   * @param collateralAsset Address of token to be swapped
   * @param debtAsset Address of debt token to be received from the swap
   * @param amount Amount of the debt to be repaid
   * @param collateralAmount Amount of the reserve to be swapped
   * @param rateMode Rate mode of the debt to be repaid
   * @param initiator Address of the user
   * @param premium Fee of the flash loan
   * @param permitSignature struct containing the permit signature
   */
  /**function _swapAndRepay(
    address collateralAsset,
    address debtAsset,
    uint256 amount,
    uint256 collateralAmount,
    uint256 rateMode,
    address initiator,
    uint256 premium,
    PermitSignature memory permitSignature,
    bool useEthPath
  ) internal {
    DataTypes.ReserveData memory collateralReserveData = _getReserveData(collateralAsset);

    // Repay debt. Approves for 0 first to comply with tokens that implement the anti frontrunning approval fix.
    IERC20(debtAsset).safeApprove(address(LENDING_POOL), 0);
    IERC20(debtAsset).safeApprove(address(LENDING_POOL), amount);
    uint256 repaidAmount = IERC20(debtAsset).balanceOf(address(this));
    LENDING_POOL.repay(debtAsset, amount, rateMode, initiator);
    repaidAmount = repaidAmount.sub(IERC20(debtAsset).balanceOf(address(this)));

    if (collateralAsset != debtAsset) {
      uint256 maxCollateralToSwap = collateralAmount;
      if (repaidAmount < amount) {
        maxCollateralToSwap = maxCollateralToSwap.mul(repaidAmount).div(amount);
      }

      uint256 neededForFlashLoanDebt = repaidAmount.add(premium);
      uint256[] memory amounts =
        _getAmountsIn(collateralAsset, debtAsset, neededForFlashLoanDebt, useEthPath);
      require(amounts[0] <= maxCollateralToSwap, 'slippage too high');

      // Pull aTokens from user
      _pullAToken(
        collateralAsset,
        collateralReserveData.aTokenAddress,
        initiator,
        amounts[0],
        permitSignature
      );

      // Swap collateral asset to the debt asset
      _swapTokensForExactTokens(
        collateralAsset,
        debtAsset,
        amounts[0],
        neededForFlashLoanDebt,
        useEthPath
      );
    } else {
      // Pull aTokens from user
      _pullAToken(
        collateralAsset,
        collateralReserveData.aTokenAddress,
        initiator,
        repaidAmount.add(premium),
        permitSignature
      );
    }

    // Repay flashloan. Approves for 0 first to comply with tokens that implement the anti frontrunning approval fix.
    IERC20(debtAsset).safeApprove(address(LENDING_POOL), 0);
    IERC20(debtAsset).safeApprove(address(LENDING_POOL), amount.add(premium));
  }*/

  /**
   * @dev Decodes debt information encoded in the flash loan params
   * @param params Additional variadic field to include extra params. Expected parameters:
   *   address collateralAsset Address of the reserve to be swapped
   *   uint256 collateralAmount Amount of reserve to be swapped
   *   uint256 rateMode Rate modes of the debt to be repaid
   *   uint256 permitAmount Amount for the permit signature
   *   uint256 deadline Deadline for the permit signature
   *   uint8 v V param for the permit signature
   *   bytes32 r R param for the permit signature
   *   bytes32 s S param for the permit signature
   *   bool useEthPath use WETH path route
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
      bytes32 s,
      bool useEthPath
    ) =
      abi.decode(
        params,
        (address, uint256, uint256, uint256, uint256, uint8, bytes32, bytes32, bool)
      );

    return
      RepayParams(
        collateralAsset,
        collateralAmount,
        rateMode,
        PermitSignature(permitAmount, deadline, v, r, s),
        useEthPath
      );
  }
}
