// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import {ReserveLogic} from './ReserveLogic.sol';
import {UserLogic} from './UserLogic.sol';
import {WadRayMath} from './WadRayMath.sol';

import '../interfaces/IPriceOracleGetter.sol';
import {IFeeProvider} from '../interfaces/IFeeProvider.sol';
import '@nomiclabs/buidler/console.sol';

/**
 * @title ReserveConfiguration library
 * @author Aave
 * @title Implements the bitmap logic to handle the configuration mapping
 */
library ReserveConfiguration {
  uint256 constant LTV_MASK = 0xFFFFFFFFFFF0000;
  uint256 constant LIQUIDATION_THRESHOLD_MASK = 0xFFFFFFF0000FFFF;
  uint256 constant LIQUIDATION_BONUS_MASK = 0xFFF0000FFFFFFFF;
  uint256 constant DECIMALS_MASK = 0xF00FFFFFFFFFFFF;
  uint256 constant ACTIVE_MASK = 0xEFFFFFFFFFFFFFF;
  uint256 constant FREEZED_MASK = 0xDFFFFFFFFFFFFFF;
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

  function setLtv(ReserveConfiguration.Map memory _self, uint256 _ltv) internal {
    _self.data = (_self.data & LTV_MASK) | _ltv;
  }

  function getLtv(ReserveConfiguration.Map storage _self) internal view returns (uint256) {
    return _self.data & ~LTV_MASK;
  }

  function setLiquidationThreshold(ReserveConfiguration.Map memory _self, uint256 _threshold)
    internal
  {
    _self.data = (_self.data & LIQUIDATION_THRESHOLD_MASK) | (_threshold << 16);
  }

  function getLiquidationThreshold(ReserveConfiguration.Map storage _self)
    internal
    view
    returns (uint256)
  {
    return (_self.data & ~LIQUIDATION_THRESHOLD_MASK) >> 16;
  }

  function setLiquidationBonus(ReserveConfiguration.Map memory _self, uint256 _bonus) internal {
    _self.data = (_self.data & LIQUIDATION_BONUS_MASK) | (_bonus << 32);
  }

  function getLiquidationBonus(ReserveConfiguration.Map storage _self)
    internal
    view
    returns (uint256)
  {
    return (_self.data & ~LIQUIDATION_BONUS_MASK) >> 32;
  }

  function setDecimals(ReserveConfiguration.Map memory _self, uint256 _decimals) internal {
    _self.data = (_self.data & DECIMALS_MASK) | (_decimals << 48);
  }

  function getDecimals(ReserveConfiguration.Map storage _self) internal view returns (uint256) {
    return (_self.data & ~DECIMALS_MASK) >> 48;
  }

  function setActive(ReserveConfiguration.Map memory _self, bool _active) internal {
    _self.data = (_self.data & ACTIVE_MASK) | (uint256(_active ? 1 : 0) << 56);
  }

  function getActive(ReserveConfiguration.Map storage _self) internal view returns (bool) {
    return ((_self.data & ~ACTIVE_MASK) >> 56) != 0;
  }

  function setFreezed(ReserveConfiguration.Map memory _self, bool _freezed) internal {
    _self.data = (_self.data & FREEZED_MASK) | (uint256(_freezed ? 1 : 0) << 57);
  }

  function getFreezed(ReserveConfiguration.Map storage _self) internal view returns (bool) {
    return ((_self.data & ~FREEZED_MASK) >> 57) != 0;
  }

  function setBorrowingEnabled(ReserveConfiguration.Map memory _self, bool _enabled) internal {
    _self.data = (_self.data & BORROWING_MASK) | (uint256(_enabled ? 1 : 0) << 58);
  }

  function getBorrowingEnabled(ReserveConfiguration.Map storage _self)
    internal
    view
    returns (bool)
  {
    return ((_self.data & ~BORROWING_MASK) >> 58) != 0;
  }

  function setStableRateBorrowingEnabled(ReserveConfiguration.Map memory _self, bool _enabled)
    internal
  {
    _self.data = (_self.data & STABLE_BORROWING_MASK) | (uint256(_enabled ? 1 : 0) << 59);
  }

  function getStableRateBorrowingEnabled(ReserveConfiguration.Map storage _self)
    internal
    view
    returns (bool)
  {
    return ((_self.data & ~STABLE_BORROWING_MASK) >> 59) != 0;
  }

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
      (dataLocal & ~FREEZED_MASK) >> 57 != 0,
      (dataLocal & ~BORROWING_MASK) >> 58 != 0,
      (dataLocal & ~STABLE_BORROWING_MASK) >> 59 != 0
    );
  }

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
