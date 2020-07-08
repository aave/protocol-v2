// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {IPriceOracleGetter} from '../interfaces/IPriceOracleGetter.sol';

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "../tokenization/base/DebtTokenBase.sol";
import "./ReserveLogic.sol";

/**
 * @title UserLogic library
 * @author Aave
 * @notice Implements user specific logic.
 */
library UserLogic {

  using SafeMath for uint256;

  struct UserReserveData {
    //defines if a specific deposit should or not be used as a collateral in borrows
    bool useAsCollateral;
  }

  /**
   * @dev checks if a user is allowed to borrow at a stable rate
   * @param _reserve the reserve address
   * @param _user the user
   * @param _amount the amount the the user wants to borrow
   * @return true if the user is allowed to borrow at a stable rate, false otherwise
   **/

  function isAllowedToBorrowAtStable(
    UserReserveData storage _user,
    ReserveLogic.ReserveData storage _reserve,
    address _userAddress,
    uint256 _amount
  ) external view returns (bool) {
    if (!_reserve.isStableBorrowRateEnabled) return false;

    return
      !_user.useAsCollateral ||
      !_reserve.usageAsCollateralEnabled ||
      _amount > IERC20(_reserve.aTokenAddress).balanceOf(_userAddress);
  }

  function getUserCurrentDebt(address _user,ReserveLogic.ReserveData storage _reserve)
    internal
    view
    returns (uint256, uint256)
  {
    return (
      IERC20(_reserve.stableDebtTokenAddress).balanceOf(_user),
      IERC20(_reserve.variableDebtTokenAddress).balanceOf(_user)
    );
  }

    function getUserPrincipalDebt(address _user,ReserveLogic.ReserveData storage _reserve)
    internal
    view
    returns (uint256, uint256)
  {
    return (
      DebtTokenBase(_reserve.stableDebtTokenAddress).principalBalanceOf(_user),
      DebtTokenBase(_reserve.variableDebtTokenAddress).principalBalanceOf(_user)
    );
  }
}
