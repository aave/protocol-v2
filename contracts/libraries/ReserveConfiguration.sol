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
  uint256 constant LTV_MASK = 0xFFFFFFFF0000;
  uint256 constant LIQUIDATION_THRESHOLD_MASK = 0xFFFF0000FFFF;
  uint256 constant LIQUIDATION_BONUS_MASK = 0x0000FFFFFFFF;
  uint256 constant LIQUIDATION_BONUS_MASK = 0x00FFFFFFFFFFFF;

  struct Map {
    //bit 0-15: LTV
    //bit 16-31: Liq. threshold
    //bit 32-47: Liq. bonus
    //bit 48-56: Decimals
    uint256 data;
  }

  function setLTV(ReserveConfiguration.Map _self, uint256 _ltv) internal {
    _self.data = (_self.data & LTV_MASK) | _ltv;
  }

  function getLTV(ReserveConfiguration.Map _self) internal view returns (uint256) {
    return _self.data & !LTV_MASK;
  }

  function setLiquidationThreshold(ReserveConfiguration.Map _self, uint256 _threshold) internal {
    _self.data = (_self.data & LIQUIDATION_THRESHOLD_MASK) | (_threshold << 16);
  }

  function getLiquidationThreshold(ReserveConfiguration.Map _self) internal view returns (uint256) {
    return (_self.data & !LIQUIDATION_THRESHOLD_MASK) >> 16;
  }

  function setLiquidationBonus(ReserveConfiguration.Map _self, uint256 _bonus) internal {
    _self.data = (_self.data & LIQUIDATION_BONUS_MASK) | (_bonus << 32);
  }

  function getLiquidationBonus(ReserveConfiguration.Map _self) internal view returns (uint256) {
    return (_self.data & !LIQUIDATION_BONUS_MASK) >> 32;
  }

  function setDecimals(ReserveConfiguration.Map _self, uint256 _decimals) internal {
    _self.data = (_self.data & DECIMALS_MASK) | (_ltv << 48);
  }

  function getDecimals(ReserveConfiguration.Map _self) internal view returns (uint256) {
    return (_self.data & !DECIMALS_MASK) >> 48;
  }
}
