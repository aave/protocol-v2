// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ReserveLogic} from '../logic/ReserveLogic.sol';
import {WadRayMath} from '../math/WadRayMath.sol';
import {IPriceOracleGetter} from '../../interfaces/IPriceOracleGetter.sol';

/**
 * @title ReserveConfiguration library
 * @author Aave
 * @notice Implements the bitmap logic to handle the reserve configuration
 */
library ReserveConfiguration {
  uint256 constant LTV_MASK = 0xFFFFFFFFFFF0000;
  uint256 constant LIQUIDATION_THRESHOLD_MASK = 0xFFFFFFF0000FFFF;
  uint256 constant LIQUIDATION_BONUS_MASK = 0xFFF0000FFFFFFFF;
  uint256 constant DECIMALS_MASK = 0xF00FFFFFFFFFFFF;
  uint256 constant ACTIVE_MASK = 0xEFFFFFFFFFFFFFF;
  uint256 constant FROZEN_MASK = 0xDFFFFFFFFFFFFFF;
  uint256 constant BORROWING_MASK = 0xBFFFFFFFFFFFFFF;
  uint256 constant STABLE_BORROWING_MASK = 0x7FFFFFFFFFFFFFF;

  struct Map {
    //bit 0-15: LTV
    //bit 16-31: Liq. threshold
    //bit 32-47: Liq. bonus
    //bit 48-55: Decimals
    //bit 56: Reserve is active
    //bit 57: reserve is freezed
    //bit 58: borrowing is enabled
    //bit 59: stable rate borrowing enabled
    uint256 data;
  }

  /**
   * @dev sets the Loan to Value of the reserve
   * @param _self the reserve configuration
   * @param _ltv the new ltv
   **/
  function setLtv(ReserveConfiguration.Map memory _self, uint256 _ltv) internal {
    _self.data = (_self.data & LTV_MASK) | _ltv;
  }

  /**
   * @dev gets the Loan to Value of the reserve
   * @param _self the reserve configuration
   * @return the loan to value
   **/
  function getLtv(ReserveConfiguration.Map storage _self) internal view returns (uint256) {
    return _self.data & ~LTV_MASK;
  }

  /**
   * @dev sets the liquidation threshold of the reserve
   * @param _self the reserve configuration
   * @param _threshold the new liquidation threshold
   **/
  function setLiquidationThreshold(ReserveConfiguration.Map memory _self, uint256 _threshold)
    internal
  {
    _self.data = (_self.data & LIQUIDATION_THRESHOLD_MASK) | (_threshold << 16);
  }

  /**
   * @dev gets the Loan to Value of the reserve
   * @param _self the reserve configuration
   * @return the liquidation threshold
   **/
  function getLiquidationThreshold(ReserveConfiguration.Map storage _self)
    internal
    view
    returns (uint256)
  {
    return (_self.data & ~LIQUIDATION_THRESHOLD_MASK) >> 16;
  }

  /**
   * @dev sets the liquidation bonus of the reserve
   * @param _self the reserve configuration
   * @param _bonus the new liquidation bonus
   **/
  function setLiquidationBonus(ReserveConfiguration.Map memory _self, uint256 _bonus) internal {
    _self.data = (_self.data & LIQUIDATION_BONUS_MASK) | (_bonus << 32);
  }

  /**
   * @dev gets the liquidation bonus of the reserve
   * @param _self the reserve configuration
   * @return the liquidation bonus
   **/
  function getLiquidationBonus(ReserveConfiguration.Map storage _self)
    internal
    view
    returns (uint256)
  {
    return (_self.data & ~LIQUIDATION_BONUS_MASK) >> 32;
  }

  /**
   * @dev sets the decimals of the underlying asset of the reserve
   * @param _self the reserve configuration
   * @param _decimals the decimals
   **/
  function setDecimals(ReserveConfiguration.Map memory _self, uint256 _decimals) internal {
    _self.data = (_self.data & DECIMALS_MASK) | (_decimals << 48);
  }

  /**
   * @dev gets the decimals of the underlying asset of the reserve
   * @param _self the reserve configuration
   * @return the decimals of the asset
   **/
  function getDecimals(ReserveConfiguration.Map storage _self) internal view returns (uint256) {
    return (_self.data & ~DECIMALS_MASK) >> 48;
  }

  /**
   * @dev sets the active state of the reserve
   * @param _self the reserve configuration
   * @param _active the active state
   **/
  function setActive(ReserveConfiguration.Map memory _self, bool _active) internal {
    _self.data = (_self.data & ACTIVE_MASK) | (uint256(_active ? 1 : 0) << 56);
  }

  /**
   * @dev gets the active state of the reserve
   * @param _self the reserve configuration
   * @return the active state
   **/
  function getActive(ReserveConfiguration.Map storage _self) internal view returns (bool) {
    return ((_self.data & ~ACTIVE_MASK) >> 56) != 0;
  }

  /**
   * @dev sets the frozen state of the reserve
   * @param _self the reserve configuration
   * @param _frozen the frozen state
   **/
  function setFrozen(ReserveConfiguration.Map memory _self, bool _frozen) internal {
    _self.data = (_self.data & FROZEN_MASK) | (uint256(_frozen ? 1 : 0) << 57);
  }

  /**
   * @dev gets the frozen state of the reserve
   * @param _self the reserve configuration
   * @return the frozen state
   **/
  function getFrozen(ReserveConfiguration.Map storage _self) internal view returns (bool) {
    return ((_self.data & ~FROZEN_MASK) >> 57) != 0;
  }

  /**
   * @dev enables or disables borrowing on the reserve
   * @param _self the reserve configuration
   * @param _enabled true if the borrowing needs to be enabled, false otherwise
   **/
  function setBorrowingEnabled(ReserveConfiguration.Map memory _self, bool _enabled) internal {
    _self.data = (_self.data & BORROWING_MASK) | (uint256(_enabled ? 1 : 0) << 58);
  }

  /**
   * @dev gets the borrowing state of the reserve
   * @param _self the reserve configuration
   * @return the borrowing state
   **/
  function getBorrowingEnabled(ReserveConfiguration.Map storage _self)
    internal
    view
    returns (bool)
  {
    return ((_self.data & ~BORROWING_MASK) >> 58) != 0;
  }

  /**
   * @dev enables or disables stable rate borrowing on the reserve
   * @param _self the reserve configuration
   * @param _enabled true if the stable rate borrowing needs to be enabled, false otherwise
   **/
  function setStableRateBorrowingEnabled(ReserveConfiguration.Map memory _self, bool _enabled)
    internal
  {
    _self.data = (_self.data & STABLE_BORROWING_MASK) | (uint256(_enabled ? 1 : 0) << 59);
  }

  /**
   * @dev gets the stable rate borrowing state of the reserve
   * @param _self the reserve configuration
   * @return the stable rate borrowing state
   **/
  function getStableRateBorrowingEnabled(ReserveConfiguration.Map storage _self)
    internal
    view
    returns (bool)
  {
    return ((_self.data & ~STABLE_BORROWING_MASK) >> 59) != 0;
  }

  /**
   * @dev gets the configuration flags of the reserve
   * @param _self the reserve configuration
   * @return the state flags representing active, freezed, borrowing enabled, stableRateBorrowing enabled
   **/
  function getFlags(ReserveConfiguration.Map storage _self)
    internal
    view
    returns (
      bool,
      bool,
      bool,
      bool
    )
  {
    uint256 dataLocal = _self.data;

    return (
      (dataLocal & ~ACTIVE_MASK) >> 56 != 0,
      (dataLocal & ~FROZEN_MASK) >> 57 != 0,
      (dataLocal & ~BORROWING_MASK) >> 58 != 0,
      (dataLocal & ~STABLE_BORROWING_MASK) >> 59 != 0
    );
  }

  /**
   * @dev gets the configuration paramters of the reserve
   * @param _self the reserve configuration
   * @return the state params representing ltv, liquidation threshold, liquidation bonus, the reserve decimals
   **/
  function getParams(ReserveConfiguration.Map storage _self)
    internal
    view
    returns (
      uint256,
      uint256,
      uint256,
      uint256
    )
  {
    uint256 dataLocal = _self.data;

    return (
      dataLocal & ~LTV_MASK,
      (dataLocal & ~LIQUIDATION_THRESHOLD_MASK) >> 16,
      (dataLocal & ~LIQUIDATION_BONUS_MASK) >> 32,
      (dataLocal & ~DECIMALS_MASK) >> 48
    );
  }
}
