// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CoreLibrary} from "./CoreLibrary.sol";
import {UserLogic} from "./UserLogic.sol";
import {IPriceOracleGetter} from "../interfaces/IPriceOracleGetter.sol";
import {UniversalERC20} from "./UniversalERC20.sol";

import "../configuration/LendingPoolAddressesProvider.sol";
import "../interfaces/ILendingRateOracle.sol";
import "../interfaces/IReserveInterestRateStrategy.sol";
import "../tokenization/AToken.sol";
import "./WadRayMath.sol";


/**
* @title ReserveLogic library
* @author Aave
* @notice Implements the logic to update the state of the reserves
*/
library ReserveLogic {
    using SafeMath for uint256;
    using WadRayMath for uint256;
    using CoreLibrary for CoreLibrary.ReserveData;
    using CoreLibrary for CoreLibrary.UserReserveData;
    using UniversalERC20 for IERC20;
    using Address for address;
    using UserLogic for CoreLibrary.UserReserveData;

    /**
    * @dev Emitted when the state of a reserve is updated
    * @dev NOTE: This event replaces the Deprecated ReserveUpdated() event, which didn't emit the average stable borrow rate
    * @param reserve the address of the reserve
    * @param liquidityRate the new liquidity rate
    * @param stableBorrowRate the new stable borrow rate
    * @param averageStableBorrowRate the new average stable borrow rate
    * @param variableBorrowRate the new variable borrow rate
    * @param liquidityIndex the new liquidity index
    * @param variableBorrowIndex the new variable borrow index
    **/
    event ReserveDataUpdated(
        address indexed reserve,
        uint256 liquidityRate,
        uint256 stableBorrowRate,
        uint256 averageStableBorrowRate,
        uint256 variableBorrowRate,
        uint256 liquidityIndex,
        uint256 variableBorrowIndex
    );

    /**
    * @dev updates the state of the core as a result of a flashloan action
    * @param _reserve the address of the reserve in which the flashloan is happening
    * @param _income the income of the protocol as a result of the action
    **/
    function updateStateOnFlashLoan(
        CoreLibrary.ReserveData storage _reserve,
        address _reserveAddress,
        uint256 _availableLiquidityBefore,
        uint256 _income,
        uint256 _protocolFee
    ) external {
        //compounding the cumulated interest
        _reserve.updateCumulativeIndexes();

        uint256 totalLiquidityBefore = _availableLiquidityBefore.add(_reserve.getTotalBorrows());

        //compounding the received fee into the reserve
        _reserve.cumulateToLiquidityIndex(totalLiquidityBefore, _income);

        //refresh interest rates
        updateInterestRatesAndTimestamp(_reserve, _reserveAddress, _income, 0);
    }


    /**
    * @dev updates the state of the core as a consequence of a repay action.
    * @param _reserve the address of the reserve on which the user is repaying
    * @param _user the address of the borrower
    * @param _paybackAmount the amount being paid back
    * @param _balanceIncrease the accrued interest on the borrowed amount
    **/
    function updateStateOnRepay(
        CoreLibrary.ReserveData storage _reserve,
        CoreLibrary.UserReserveData storage _user,
        address _reserveAddress,
        uint256 _paybackAmount,
        uint256 _balanceIncrease
    ) external {
        CoreLibrary.InterestRateMode borrowRateMode = _user.getCurrentBorrowRateMode();

        //update the indexes
        _reserve.updateCumulativeIndexes();

        //compound the cumulated interest to the borrow balance and then subtracting the payback amount
        if (borrowRateMode == CoreLibrary.InterestRateMode.STABLE) {
            _reserve.increaseTotalBorrowsStableAndUpdateAverageRate(
                _balanceIncrease,
                _user.stableBorrowRate
            );
            _reserve.decreaseTotalBorrowsStableAndUpdateAverageRate(
                _paybackAmount,
                _user.stableBorrowRate
            );
        } else {
            _reserve.increaseTotalBorrowsVariable(_balanceIncrease);
            _reserve.decreaseTotalBorrowsVariable(_paybackAmount);
        }
    }

    /**
    * @dev updates the state of the core as a consequence of a swap rate action.
    * @param _reserve the address of the reserve on which the user is repaying
    * @param _user the address of the borrower
    * @param _principalBorrowBalance the amount borrowed by the user
    * @param _compoundedBorrowBalance the amount borrowed plus accrued interest
    * @param _currentRateMode the current interest rate mode for the user
    **/
    function updateStateOnSwapRate(
        CoreLibrary.ReserveData storage _reserve,
        CoreLibrary.UserReserveData storage _user,
        address _reserveAddress,
        uint256 _principalBorrowBalance,
        uint256 _compoundedBorrowBalance,
        CoreLibrary.InterestRateMode _currentRateMode
    ) external {
        //compounding reserve indexes
        _reserve.updateCumulativeIndexes();

        if (_currentRateMode == CoreLibrary.InterestRateMode.STABLE) {
            uint256 userCurrentStableRate = _user.stableBorrowRate;

            //swap to variable
            _reserve.decreaseTotalBorrowsStableAndUpdateAverageRate(
                _principalBorrowBalance,
                userCurrentStableRate
            ); //decreasing stable from old principal balance
            _reserve.increaseTotalBorrowsVariable(_compoundedBorrowBalance); //increase variable borrows
        } else if (_currentRateMode == CoreLibrary.InterestRateMode.VARIABLE) {
            //swap to stable
            uint256 currentStableRate = _reserve.currentStableBorrowRate;
            _reserve.decreaseTotalBorrowsVariable(_principalBorrowBalance);
            _reserve.increaseTotalBorrowsStableAndUpdateAverageRate(
                _compoundedBorrowBalance,
                currentStableRate
            );

        } else {
            revert("Invalid rate mode received");
        }
    }

    /**
    * @dev updates the state of the core as a consequence of a liquidation action.
    * @param _collateralReserve the collateral reserve that is being liquidated
    * @param _collateralToLiquidate the amount of collateral being liquidated
    * @param _liquidatedCollateralForFee the amount of collateral equivalent to the origination fee + bonus
    * @param _liquidatorReceivesAToken true if the liquidator will receive aTokens, false otherwise
    **/
    function updateStateOnLiquidationAsCollateral(
        CoreLibrary.ReserveData storage _collateralReserve,
        address _collateralReserveAddress,
        uint256 _collateralToLiquidate,
        uint256 _liquidatedCollateralForFee,
        bool _liquidatorReceivesAToken
    ) external {
        _collateralReserve.updateCumulativeIndexes();

        if (!_liquidatorReceivesAToken) {
            updateInterestRatesAndTimestamp(
                _collateralReserve,
                _collateralReserveAddress,
                0,
                _collateralToLiquidate.add(_liquidatedCollateralForFee)
            );
        }

    }

    /**
    * @dev updates the state of the core as a consequence of a stable rate rebalance
    * @param _reserve the address of the principal reserve where the user borrowed
    * @param _user the address of the borrower
    * @param _balanceIncrease the accrued interest on the borrowed amount
    * @return the new stable rate for the user
    **/
    function updateStateOnRebalance(
        CoreLibrary.ReserveData storage _reserve,
        CoreLibrary.UserReserveData storage _user,
        address _reserveAddress,
        uint256 _balanceIncrease
    ) internal returns (uint256) {
        _reserve.updateCumulativeIndexes();

        _reserve.increaseTotalBorrowsStableAndUpdateAverageRate(
            _balanceIncrease,
            _user.stableBorrowRate
        );
    }

    /**
    * @dev updates the state of the principal reserve as a consequence of a liquidation action.
    * @param _reserve the reserve data
    * @param _user the address of the borrower
    * @param _reserveAddress the address of the reserve
    * @param _amountToLiquidate the amount being repaid by the liquidator
    * @param _balanceIncrease the accrued interest on the borrowed amount
    **/
    function updateStateOnLiquidationAsPrincipal(
        CoreLibrary.ReserveData storage _reserve,
        CoreLibrary.UserReserveData storage _user,
        address _reserveAddress,
        uint256 _amountToLiquidate,
        uint256 _balanceIncrease
    ) external {
        //update principal reserve data
        _reserve.updateCumulativeIndexes();

        CoreLibrary.InterestRateMode borrowRateMode = _user.getCurrentBorrowRateMode();

        if (borrowRateMode == CoreLibrary.InterestRateMode.STABLE) {
            //increase the total borrows by the compounded interest
            _reserve.increaseTotalBorrowsStableAndUpdateAverageRate(
                _balanceIncrease,
                _user.stableBorrowRate
            );

            //decrease by the actual amount to liquidate
            _reserve.decreaseTotalBorrowsStableAndUpdateAverageRate(
                _amountToLiquidate,
                _user.stableBorrowRate
            );

        } else {
            //increase the total borrows by the compounded interest
            _reserve.increaseTotalBorrowsVariable(_balanceIncrease);

            //decrease by the actual amount to liquidate
            _reserve.decreaseTotalBorrowsVariable(_amountToLiquidate);
        }
        updateInterestRatesAndTimestamp(
            _reserve,
            _reserveAddress,
            _amountToLiquidate.add(_balanceIncrease),
            0
        );

    }

    /**
    * @dev gets the total liquidity in the reserve. The total liquidity is the balance of the core contract + total borrows
    * @param _reserve the reserve address
    * @return the total liquidity
    **/
    function getTotalLiquidity(CoreLibrary.ReserveData storage _reserve, address _reserveAddress)
        public
        view
        returns (uint256)
    {
        return
            IERC20(_reserveAddress).universalBalanceOf(address(this)).add(
                _reserve.getTotalBorrows()
            );
    }

    /**
    * @dev updates the state of the user as a consequence of a stable rate rebalance
    * @param _reserve the address of the principal reserve where the user borrowed
    * @param _user the address of the borrower
    * @param _balanceIncrease the accrued interest on the borrowed amount
    * @param _amountBorrowed the accrued interest on the borrowed amount
    **/
    function updateStateOnBorrow(
        CoreLibrary.ReserveData storage _reserve,
        CoreLibrary.UserReserveData storage _user,
        uint256 _principalBalance,
        uint256 _balanceIncrease,
        uint256 _amountBorrowed,
        CoreLibrary.InterestRateMode _newBorrowRateMode
    ) public {

        _reserve.updateCumulativeIndexes();

        CoreLibrary.InterestRateMode previousRateMode = _user.getCurrentBorrowRateMode();

        if (previousRateMode == CoreLibrary.InterestRateMode.STABLE) {
            _reserve.decreaseTotalBorrowsStableAndUpdateAverageRate(
                _principalBalance,
                _user.stableBorrowRate
            );
        } else if (previousRateMode == CoreLibrary.InterestRateMode.VARIABLE) {
            _reserve.decreaseTotalBorrowsVariable(_principalBalance);
        }

        uint256 newPrincipalAmount = _principalBalance.add(_balanceIncrease).add(_amountBorrowed);
        if (_newBorrowRateMode == CoreLibrary.InterestRateMode.STABLE) {
            _reserve.increaseTotalBorrowsStableAndUpdateAverageRate(
                newPrincipalAmount,
                _reserve.currentStableBorrowRate
            );
        } else if (_newBorrowRateMode == CoreLibrary.InterestRateMode.VARIABLE) {
            _reserve.increaseTotalBorrowsVariable(newPrincipalAmount);
        } else {
            revert("Invalid new borrow rate mode");
        }
    }

    /**
    * @dev Updates the reserve current stable borrow rate Rf, the current variable borrow rate Rv and the current liquidity rate Rl.
    * Also updates the lastUpdateTimestamp value. Please refer to the whitepaper for further information.
    * @param _reserve the address of the reserve to be updated
    * @param _liquidityAdded the amount of liquidity added to the protocol (deposit or repay) in the previous action
    * @param _liquidityTaken the amount of liquidity taken from the protocol (redeem or borrow)
    **/
    function updateInterestRatesAndTimestamp(
        CoreLibrary.ReserveData storage _reserve,
        address _reserveAddress,
        uint256 _liquidityAdded,
        uint256 _liquidityTaken
    ) internal {
        uint256 currentAvgStableRate = _reserve.currentAverageStableBorrowRate;

        uint256 balance = IERC20(_reserveAddress).universalBalanceOf(address(this));

        //if the reserve is ETH, the msg.value has already been cumulated to the balance of the reserve
        if(IERC20(_reserveAddress).isETH()){
            balance = balance.sub(msg.value);
        }

        (uint256 newLiquidityRate, uint256 newStableRate, uint256 newVariableRate) = IReserveInterestRateStrategy(
            _reserve
                .interestRateStrategyAddress
        )
            .calculateInterestRates(
            _reserveAddress,
            balance.add(_liquidityAdded).sub(_liquidityTaken),
            _reserve.totalBorrowsStable,
            _reserve.totalBorrowsVariable,
            currentAvgStableRate
        );

        _reserve.currentLiquidityRate = newLiquidityRate;
        _reserve.currentStableBorrowRate = newStableRate;
        _reserve.currentVariableBorrowRate = newVariableRate;

        //solium-disable-next-line
        _reserve.lastUpdateTimestamp = uint40(block.timestamp);

        emit ReserveDataUpdated(
            _reserveAddress,
            newLiquidityRate,
            newStableRate,
            currentAvgStableRate,
            newVariableRate,
            _reserve.lastLiquidityCumulativeIndex,
            _reserve.lastVariableBorrowCumulativeIndex
        );
    }

    /**
    * @dev gets the reserve current variable borrow rate. Is the base variable borrow rate if the reserve is empty
    * @param _reserve the reserve address
    * @return the reserve current variable borrow rate
    **/
    function getReserveCurrentVariableBorrowRate(CoreLibrary.ReserveData storage _reserve)
        external
        view
        returns (uint256)
    {
        if (_reserve.currentVariableBorrowRate == 0) {
            return
                IReserveInterestRateStrategy(_reserve.interestRateStrategyAddress)
                    .getBaseVariableBorrowRate();
        }
        return _reserve.currentVariableBorrowRate;
    }

    /**
    * @dev gets the reserve current stable borrow rate. Is the market rate if the reserve is empty
    * @param _reserve the reserve address
    * @return the reserve current stable borrow rate
    **/
    function getReserveCurrentStableBorrowRate(
        CoreLibrary.ReserveData storage _reserve,
        uint256 _baseRate
    ) public view returns (uint256) {
        return _reserve.currentStableBorrowRate == 0 ? _baseRate : _reserve.currentStableBorrowRate;
    }

    /**
    * @dev returns the utilization rate U of a specific reserve
    * @param _reserve the reserve for which the information is needed
    * @return the utilization rate in ray
    **/
    function getUtilizationRate(CoreLibrary.ReserveData storage _reserve, address _reserveAddress)
        public
        view
        returns (uint256)
    {
        uint256 totalBorrows = _reserve.getTotalBorrows();

        if (totalBorrows == 0) {
            return 0;
        }

        uint256 availableLiquidity = IERC20(_reserveAddress).universalBalanceOf(address(this));

        return totalBorrows.rayDiv(availableLiquidity.add(totalBorrows));
    }
}
