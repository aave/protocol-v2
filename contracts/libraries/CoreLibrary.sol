// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import '@openzeppelin/contracts/math/SafeMath.sol';
import './WadRayMath.sol';
import './MathUtils.sol';
import '@nomiclabs/buidler/console.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/**
 * @title CoreLibrary library
 * @author Aave
 * @notice Defines the data structures of the reserves and the user data
 **/
library CoreLibrary {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  enum InterestRateMode {NONE, STABLE, VARIABLE}

  struct UserReserveData {
    //defines if a specific deposit should or not be used as a collateral in borrows
    bool useAsCollateral;
  }

  struct ReserveData {
    /**
     * @dev refer to the whitepaper, section 1.1 basic concepts for a formal description of these properties.
     **/
    //the liquidity index. Expressed in ray
    uint256 lastLiquidityCumulativeIndex;
    //the current supply rate. Expressed in ray
    uint256 currentLiquidityRate;
    //the current variable borrow rate. Expressed in ray
    uint256 currentVariableBorrowRate;
    //the current stable borrow rate. Expressed in ray
    uint256 currentStableBorrowRate;
    //variable borrow index. Expressed in ray
    uint256 lastVariableBorrowCumulativeIndex;
    //the ltv of the reserve. Expressed in percentage (0-100)
    uint256 baseLTVasCollateral;
    //the liquidation threshold of the reserve. Expressed in percentage (0-100)
    uint256 liquidationThreshold;
    //the liquidation bonus of the reserve. Expressed in percentage
    uint256 liquidationBonus;
    //the decimals of the reserve asset
    uint256 decimals;
    /**
     * @dev address of the aToken representing the asset
     **/
    address aTokenAddress;
    address stableDebtTokenAddress;
    address variableDebtTokenAddress;
    /**
     * @dev address of the interest rate strategy contract
     **/
    address interestRateStrategyAddress;
    uint40 lastUpdateTimestamp;
    // borrowingEnabled = true means users can borrow from this reserve
    bool borrowingEnabled;
    // usageAsCollateralEnabled = true means users can use this reserve as collateral
    bool usageAsCollateralEnabled;
    // isStableBorrowRateEnabled = true means users can borrow at a stable rate
    bool isStableBorrowRateEnabled;
    // isActive = true means the reserve has been activated and properly configured
    bool isActive;
    // isFreezed = true means the reserve only allows repays and redeems, but not deposits, new borrowings or rate swap
    bool isFreezed;
  }

  /**
   * @dev returns the ongoing normalized income for the reserve.
   * a value of 1e27 means there is no income. As time passes, the income is accrued.
   * A value of 2*1e27 means that the income of the reserve is double the initial amount.
   * @param _reserve the reserve object
   * @return the normalized income. expressed in ray
   **/
  function getNormalizedIncome(CoreLibrary.ReserveData storage _reserve)
    internal
    view
    returns (uint256)
  {
    uint256 cumulated = MathUtils
      .calculateLinearInterest(_reserve.currentLiquidityRate, _reserve.lastUpdateTimestamp)
      .rayMul(_reserve.lastLiquidityCumulativeIndex);

    return cumulated;
  }

  /**
   * @dev returns the ongoing normalized variable debt for the reserve.
   * a value of 1e27 means there is no debt. As time passes, the income is accrued.
   * A value of 2*1e27 means that the debt of the reserve is double the initial amount.
   * @param _reserve the reserve object
   * @return the normalized variable debt. expressed in ray
   **/
  function getNormalizedDebt(CoreLibrary.ReserveData storage _reserve)
    internal
    view
    returns (uint256)
  {
    uint256 cumulated = MathUtils
      .calculateCompoundedInterest(_reserve.currentVariableBorrowRate, _reserve.lastUpdateTimestamp)
      .rayMul(_reserve.lastVariableBorrowCumulativeIndex);

    return cumulated;
  }

  /**
   * @dev Updates the liquidity cumulative index Ci and variable borrow cumulative index Bvc. Refer to the whitepaper for
   * a formal specification.
   * @param _self the reserve object
   **/
  function updateCumulativeIndexes(ReserveData storage _self) internal {
    uint256 totalBorrows = getTotalBorrows(_self);

    if (totalBorrows > 0) {
      //only cumulating if there is any income being produced
      uint256 cumulatedLiquidityInterest = MathUtils.calculateLinearInterest(
        _self.currentLiquidityRate,
        _self.lastUpdateTimestamp
      );

      _self.lastLiquidityCumulativeIndex = cumulatedLiquidityInterest.rayMul(
        _self.lastLiquidityCumulativeIndex
      );

      uint256 cumulatedVariableBorrowInterest = MathUtils.calculateCompoundedInterest(
        _self.currentVariableBorrowRate,
        _self.lastUpdateTimestamp
      );
      _self.lastVariableBorrowCumulativeIndex = cumulatedVariableBorrowInterest.rayMul(
        _self.lastVariableBorrowCumulativeIndex
      );
    }
  }

  /**
   * @dev accumulates a predefined amount of asset to the reserve as a fixed, one time income. Used for example to accumulate
   * the flashloan fee to the reserve, and spread it through the depositors.
   * @param _self the reserve object
   * @param _totalLiquidity the total liquidity available in the reserve
   * @param _amount the amount to accomulate
   **/
  function cumulateToLiquidityIndex(
    ReserveData storage _self,
    uint256 _totalLiquidity,
    uint256 _amount
  ) internal {
    uint256 amountToLiquidityRatio = _amount.wadToRay().rayDiv(_totalLiquidity.wadToRay());

    uint256 cumulatedLiquidity = amountToLiquidityRatio.add(WadRayMath.ray());

    _self.lastLiquidityCumulativeIndex = cumulatedLiquidity.rayMul(
      _self.lastLiquidityCumulativeIndex
    );
  }

  /**
   * @dev initializes a reserve
   * @param _self the reserve object
   * @param _aTokenAddress the address of the overlying atoken contract
   * @param _decimals the number of decimals of the underlying asset
   * @param _interestRateStrategyAddress the address of the interest rate strategy contract
   **/
  function init(
    ReserveData storage _self,
    address _aTokenAddress,
    address _stableDebtAddress,
    address _variableDebtAddress,
    uint256 _decimals,
    address _interestRateStrategyAddress
  ) external {
    require(_self.aTokenAddress == address(0), 'Reserve has already been initialized');

    if (_self.lastLiquidityCumulativeIndex == 0) {
      //if the reserve has not been initialized yet
      _self.lastLiquidityCumulativeIndex = WadRayMath.ray();
    }

    if (_self.lastVariableBorrowCumulativeIndex == 0) {
      _self.lastVariableBorrowCumulativeIndex = WadRayMath.ray();
    }

    _self.aTokenAddress = _aTokenAddress;
    _self.stableDebtTokenAddress = _stableDebtAddress;
    _self.variableDebtTokenAddress = _variableDebtAddress;
    _self.decimals = _decimals;

    _self.interestRateStrategyAddress = _interestRateStrategyAddress;
    _self.isActive = true;
    _self.isFreezed = false;
  }

  /**
   * @dev enables borrowing on a reserve
   * @param _self the reserve object
   * @param _stableBorrowRateEnabled true if the stable borrow rate must be enabled by default, false otherwise
   **/
  function enableBorrowing(ReserveData storage _self, bool _stableBorrowRateEnabled) external {
    require(_self.borrowingEnabled == false, 'Reserve is already enabled');

    _self.borrowingEnabled = true;
    _self.isStableBorrowRateEnabled = _stableBorrowRateEnabled;
  }

  /**
   * @dev disables borrowing on a reserve
   * @param _self the reserve object
   **/
  function disableBorrowing(ReserveData storage _self) external {
    _self.borrowingEnabled = false;
  }

  /**
   * @dev enables a reserve to be used as collateral
   * @param _self the reserve object
   * @param _baseLTVasCollateral the loan to value of the asset when used as collateral
   * @param _liquidationThreshold the threshold at which loans using this asset as collateral will be considered undercollateralized
   * @param _liquidationBonus the bonus liquidators receive to liquidate this asset
   **/
  function enableAsCollateral(
    ReserveData storage _self,
    uint256 _baseLTVasCollateral,
    uint256 _liquidationThreshold,
    uint256 _liquidationBonus
  ) external {
    require(_self.usageAsCollateralEnabled == false, 'Reserve is already enabled as collateral');

    _self.usageAsCollateralEnabled = true;
    _self.baseLTVasCollateral = _baseLTVasCollateral;
    _self.liquidationThreshold = _liquidationThreshold;
    _self.liquidationBonus = _liquidationBonus;

    if (_self.lastLiquidityCumulativeIndex == 0)
      _self.lastLiquidityCumulativeIndex = WadRayMath.ray();
  }

  /**
   * @dev disables a reserve as collateral
   * @param _self the reserve object
   **/
  function disableAsCollateral(ReserveData storage _self) external {
    _self.usageAsCollateralEnabled = false;
  }

  function getTotalBorrows(ReserveData storage _self) internal view returns(uint256) {
    return
      IERC20(_self.stableDebtTokenAddress).totalSupply().add(
        IERC20(_self.variableDebtTokenAddress).totalSupply()
      );
  }
}
