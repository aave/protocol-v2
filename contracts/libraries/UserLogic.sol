// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {CoreLibrary} from "./CoreLibrary.sol";
import {IPriceOracleGetter} from "../interfaces/IPriceOracleGetter.sol";
import {IFeeProvider} from "../interfaces/IFeeProvider.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library UserLogic {
    using CoreLibrary for CoreLibrary.UserReserveData;
    using CoreLibrary for CoreLibrary.ReserveData;
    using SafeMath for uint256;

    /**
    * @dev checks if a user is allowed to borrow at a stable rate
    * @param _reserve the reserve address
    * @param _user the user
    * @param _amount the amount the the user wants to borrow
    * @return true if the user is allowed to borrow at a stable rate, false otherwise
    **/

    function isAllowedToBorrowAtStable(
        CoreLibrary.UserReserveData storage _user,
        CoreLibrary.ReserveData storage _reserve,
        address _userAddress,
        uint256 _amount
    ) external view returns (bool) {
        if (!_reserve.isStableBorrowRateEnabled) return false;

        return
            !_user.useAsCollateral ||
                !_reserve.usageAsCollateralEnabled ||
                _amount > IERC20(_reserve.aTokenAddress).balanceOf(_userAddress);
    }

    /**
    * @dev users with no loans in progress have NONE as borrow rate mode
    * @param _user the address of the user for which the information is needed
    * @return the borrow rate mode for the user,
    **/

    function getCurrentBorrowRateMode(CoreLibrary.UserReserveData storage _user)
        internal
        view
        returns (CoreLibrary.InterestRateMode)
    {
        if (_user.principalBorrowBalance == 0) {
            return CoreLibrary.InterestRateMode.NONE;
        }

        return
            _user.stableBorrowRate > 0
                ? CoreLibrary.InterestRateMode.STABLE
                : CoreLibrary.InterestRateMode.VARIABLE;
    }

    /**
    * @dev gets the current borrow rate of the user
    * @param _reserve the address of the reserve for which the information is needed
    * @param _user the address of the user for which the information is needed
    * @return the borrow rate for the user,
    **/
    function getCurrentBorrowRate(
        CoreLibrary.UserReserveData storage _user,
        CoreLibrary.ReserveData storage _reserve
    ) public view returns (uint256) {
        CoreLibrary.InterestRateMode rateMode = getCurrentBorrowRateMode(_user);

        if (rateMode == CoreLibrary.InterestRateMode.NONE) {
            return 0;
        }

        return
            rateMode == CoreLibrary.InterestRateMode.STABLE
                ? _user.stableBorrowRate
                : _reserve.currentVariableBorrowRate;
    }
    /**
    * @dev calculates and returns the borrow balances of the user
    * @param _reserve the address of the reserve
    * @param _user the address of the user
    * @return the principal borrow balance, the compounded balance and the balance increase since the last borrow/repay/swap/rebalance
    **/
    function getBorrowBalances(
        CoreLibrary.UserReserveData storage _user,
        CoreLibrary.ReserveData storage _reserve
    ) public view returns (uint256, uint256, uint256) {
        if (_user.principalBorrowBalance == 0) {
            return (0, 0, 0);
        }

        uint256 principal = _user.principalBorrowBalance;
        uint256 compoundedBalance = CoreLibrary.getCompoundedBorrowBalance(_user, _reserve);
        return (principal, compoundedBalance, compoundedBalance.sub(principal));
    }

    /**
    * @dev updates the state of a user as a consequence of a borrow action.
    * @param _reserve the address of the reserve on which the user is borrowing
    * @param _user the address of the borrower
    * @param _amountBorrowed the amount borrowed
    * @param _balanceIncrease the accrued interest of the user on the previous borrowed amount
    * @param _rateMode the borrow rate mode (stable, variable)
    **/

    function updateStateOnBorrow(
        CoreLibrary.UserReserveData storage _user,
        CoreLibrary.ReserveData storage _reserve,
        uint256 _amountBorrowed,
        uint256 _balanceIncrease,
        uint256 _fee,
        CoreLibrary.InterestRateMode _rateMode
    ) external {
        if (_rateMode == CoreLibrary.InterestRateMode.STABLE) {
            //stable
            //reset the user variable index, and update the stable rate
            _user.stableBorrowRate = _reserve.currentStableBorrowRate;
            _user.lastVariableBorrowCumulativeIndex = 0;
        } else if (_rateMode == CoreLibrary.InterestRateMode.VARIABLE) {
            //variable
            //reset the user stable rate, and store the new borrow index
            _user.stableBorrowRate = 0;
            _user.lastVariableBorrowCumulativeIndex = _reserve.lastVariableBorrowCumulativeIndex;
        } else {
            revert("Invalid borrow rate mode");
        }
        //increase the principal borrows and the origination fee
        _user.principalBorrowBalance = _user.principalBorrowBalance.add(_amountBorrowed).add(
            _balanceIncrease
        );
        _user.originationFee = _user.originationFee.add(_fee);

        //solium-disable-next-line
        _user.lastUpdateTimestamp = uint40(block.timestamp);

    }

    /**
    * @dev updates the state of the user as a consequence of a repay action.
    * @param _reserve the address of the reserve on which the user is repaying
    * @param _user the address of the borrower
    * @param _paybackAmountMinusFees the amount being paid back minus fees
    * @param _originationFeeRepaid the fee on the amount that is being repaid
    * @param _balanceIncrease the accrued interest on the borrowed amount
    * @param _repaidWholeLoan true if the user is repaying the whole loan
    **/
    function updateStateOnRepay(
        CoreLibrary.UserReserveData storage _user,
        CoreLibrary.ReserveData storage _reserve,
        uint256 _paybackAmountMinusFees,
        uint256 _originationFeeRepaid,
        uint256 _balanceIncrease,
        bool _repaidWholeLoan
    ) external {
        //update the user principal borrow balance, adding the cumulated interest and then subtracting the payback amount
        _user.principalBorrowBalance = _user.principalBorrowBalance.add(_balanceIncrease).sub(
            _paybackAmountMinusFees
        );

        //if the balance decrease is equal to the previous principal (user is repaying the whole loan)
        //and the rate mode is stable, we reset the interest rate mode of the user
        if (_repaidWholeLoan) {
            _user.stableBorrowRate = 0;
            _user.lastVariableBorrowCumulativeIndex = 0;
            //solium-disable-next-line
            _user.lastUpdateTimestamp = 0;
        } else {
            if (getCurrentBorrowRateMode(_user) == CoreLibrary.InterestRateMode.VARIABLE) {
                _user.lastVariableBorrowCumulativeIndex = _reserve
                    .lastVariableBorrowCumulativeIndex;
            }
            //solium-disable-next-line
            _user.lastUpdateTimestamp = uint40(block.timestamp);

        }

        _user.originationFee = _user.originationFee.sub(_originationFeeRepaid);
    }

    /**
    * @dev updates the state of the user as a consequence of a swap rate action.
    * @param _reserve the address of the reserve on which the user is performing the swap
    * @param _user the address of the borrower
    * @param _balanceIncrease the accrued interest on the borrowed amount
    * @param _currentRateMode the current rate mode of the user
    **/

    function updateStateOnSwapRate(
        CoreLibrary.UserReserveData storage _user,
        CoreLibrary.ReserveData storage _reserve,
        uint256 _balanceIncrease,
        CoreLibrary.InterestRateMode _currentRateMode
    ) external returns (CoreLibrary.InterestRateMode) {
        CoreLibrary.InterestRateMode newMode = CoreLibrary.InterestRateMode.NONE;

        if (_currentRateMode == CoreLibrary.InterestRateMode.VARIABLE) {
            //switch to stable
            newMode = CoreLibrary.InterestRateMode.STABLE;
            _user.stableBorrowRate = _reserve.currentStableBorrowRate;
            _user.lastVariableBorrowCumulativeIndex = 0;
        } else if (_currentRateMode == CoreLibrary.InterestRateMode.STABLE) {
            newMode = CoreLibrary.InterestRateMode.VARIABLE;
            _user.stableBorrowRate = 0;
            _user.lastVariableBorrowCumulativeIndex = _reserve.lastVariableBorrowCumulativeIndex;
        } else {
            revert("Invalid interest rate mode received");
        }
        //compounding cumulated interest
        _user.principalBorrowBalance = _user.principalBorrowBalance.add(_balanceIncrease);
        //solium-disable-next-line
        _user.lastUpdateTimestamp = uint40(block.timestamp);

        return newMode;
    }

    /**
    * @dev updates the state of the user being liquidated as a consequence of a liquidation action.
    * @param _reserve the address of the principal reserve that is being repaid
    * @param _user the address of the borrower
    * @param _amountToLiquidate the amount being repaid by the liquidator
    * @param _feeLiquidated the amount of origination fee being liquidated
    * @param _balanceIncrease the accrued interest on the borrowed amount
    **/
    function updateStateOnLiquidation(
        CoreLibrary.UserReserveData storage _user,
        CoreLibrary.ReserveData storage _reserve,
        uint256 _amountToLiquidate,
        uint256 _feeLiquidated,
        uint256 _balanceIncrease
    ) external {
        //first increase by the compounded interest, then decrease by the liquidated amount
        _user.principalBorrowBalance = _user.principalBorrowBalance.add(_balanceIncrease).sub(
            _amountToLiquidate
        );

        if (getCurrentBorrowRateMode(_user) == CoreLibrary.InterestRateMode.VARIABLE) {
            _user.lastVariableBorrowCumulativeIndex = _reserve.lastVariableBorrowCumulativeIndex;
        }

        if (_feeLiquidated > 0) {
            _user.originationFee = _user.originationFee.sub(_feeLiquidated);
        }

        //solium-disable-next-line
        _user.lastUpdateTimestamp = uint40(block.timestamp);
    }

    /**
    * @dev updates the state of the user as a consequence of a stable rate rebalance
    * @param _reserve the address of the principal reserve where the user borrowed
    * @param _user the address of the borrower
    * @param _balanceIncrease the accrued interest on the borrowed amount
    **/

    function updateUserStateOnRebalanceInternal(
        CoreLibrary.UserReserveData storage _user,
        CoreLibrary.ReserveData storage _reserve,
        uint256 _balanceIncrease
    ) external {
        _user.principalBorrowBalance = _user.principalBorrowBalance.add(_balanceIncrease);
        _user.stableBorrowRate = _reserve.currentStableBorrowRate;

        //solium-disable-next-line
        _user.lastUpdateTimestamp = uint40(block.timestamp);
    }
}
