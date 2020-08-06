// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {WadRayMath} from './WadRayMath.sol';
import {IPriceOracleGetter} from '../interfaces/IPriceOracleGetter.sol';
import {IFeeProvider} from '../interfaces/IFeeProvider.sol';

/**
 * @title UserConfiguration library
 * @author Aave
 * @notice Implements the bitmap logic to handle the user configuration
 */
library UserConfiguration {
  uint256 internal constant BORROWING_MASK = 0x5555555555555555555555555555555555555555555555555555555555555555;

  struct Map {
    uint256 data;
  }

  function setBorrowing(
    UserConfiguration.Map storage _self,
    uint256 _reserveIndex,
    bool _borrowing
  ) internal {
    _self.data = (_self.data & ~(1 << _reserveIndex*2)) | uint256(_borrowing ? 1 : 0) << (_reserveIndex * 2);
  }

  function setUsingAsCollateral(
    UserConfiguration.Map storage _self,
    uint256 _reserveIndex,
    bool _usingAsCollateral
  ) internal {
    _self.data = (_self.data & ~(1 << _reserveIndex*2+1)) | uint256(_usingAsCollateral ? 1 : 0) << (_reserveIndex * 2 + 1);
  }

  function isUsingAsCollateralOrBorrowing(UserConfiguration.Map memory _self, uint256 _reserveIndex)
    internal
    view
    returns (bool)
  {
    return (_self.data >> (_reserveIndex * 2)) & 3 != 0;
  }

  function isBorrowing(UserConfiguration.Map memory _self, uint256 _reserveIndex)
    internal
    view
    returns (bool)
  {
    return (_self.data >> (_reserveIndex * 2)) & 1 != 0;
  }

  function isUsingAsCollateral(UserConfiguration.Map memory _self, uint256 _reserveIndex)
    internal
    view
    returns (bool)
  {
    return (_self.data >> (_reserveIndex * 2 + 1)) & 1 != 0;
  }

  function isBorrowingAny(UserConfiguration.Map memory _self) internal view returns (bool) {
    return _self.data & BORROWING_MASK != 0;
  }

  function isEmpty(UserConfiguration.Map memory _self) internal view returns(bool) {
    return _self.data == 0;
  }
}
