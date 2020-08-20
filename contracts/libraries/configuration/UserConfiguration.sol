// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {WadRayMath} from '../math/WadRayMath.sol';
import {IPriceOracleGetter} from '../../interfaces/IPriceOracleGetter.sol';
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

  /**
   * @dev sets if the user is borrowing the reserve identified by _reserveIndex
   * @param _self the configuration object
   * @param _reserveIndex the index of the reserve in the bitmap
   * @param _borrowing true if the user is borrowing the reserve, false otherwise
   **/
  function setBorrowing(
    UserConfiguration.Map storage _self,
    uint256 _reserveIndex,
    bool _borrowing
  ) internal {
    _self.data =
      (_self.data & ~(1 << (_reserveIndex * 2))) |
      (uint256(_borrowing ? 1 : 0) << (_reserveIndex * 2));
  }

  /**
   * @dev sets if the user is using as collateral the reserve identified by _reserveIndex
   * @param _self the configuration object
   * @param _reserveIndex the index of the reserve in the bitmap
   * @param _usingAsCollateral true if the user is usin the reserve as collateral, false otherwise
   **/
  function setUsingAsCollateral(
    UserConfiguration.Map storage _self,
    uint256 _reserveIndex,
    bool _usingAsCollateral
  ) internal {
    _self.data =
      (_self.data & ~(1 << (_reserveIndex * 2 + 1))) |
      (uint256(_usingAsCollateral ? 1 : 0) << (_reserveIndex * 2 + 1));
  }

  /**
   * @dev used to validate if a user has been using the reserve for borrowing or as collateral
   * @param _self the configuration object
   * @param _reserveIndex the index of the reserve in the bitmap
   * @return true if the user has been using a reserve for borrowing or as collateral, false otherwise
   **/
  function isUsingAsCollateralOrBorrowing(UserConfiguration.Map memory _self, uint256 _reserveIndex)
    internal
    view
    returns (bool)
  {
    return (_self.data >> (_reserveIndex * 2)) & 3 != 0;
  }

  /**
   * @dev used to validate if a user has been using the reserve for borrowing
   * @param _self the configuration object
   * @param _reserveIndex the index of the reserve in the bitmap
   * @return true if the user has been using a reserve for borrowing, false otherwise
   **/
  function isBorrowing(UserConfiguration.Map memory _self, uint256 _reserveIndex)
    internal
    view
    returns (bool)
  {
    return (_self.data >> (_reserveIndex * 2)) & 1 != 0;
  }

  /**
   * @dev used to validate if a user has been using the reserve as collateral
   * @param _self the configuration object
   * @param _reserveIndex the index of the reserve in the bitmap
   * @return true if the user has been using a reserve as collateral, false otherwise
   **/
  function isUsingAsCollateral(UserConfiguration.Map memory _self, uint256 _reserveIndex)
    internal
    view
    returns (bool)
  {
    return (_self.data >> (_reserveIndex * 2 + 1)) & 1 != 0;
  }

  /**
   * @dev used to validate if a user has been borrowing from any reserve
   * @param _self the configuration object
   * @return true if the user has been borrowing any reserve, false otherwise
   **/
  function isBorrowingAny(UserConfiguration.Map memory _self) internal view returns (bool) {
    return _self.data & BORROWING_MASK != 0;
  }

  /**
   * @dev used to validate if a user has not been using any reserve
   * @param _self the configuration object
   * @return true if the user has been borrowing any reserve, false otherwise
   **/
  function isEmpty(UserConfiguration.Map memory _self) internal view returns (bool) {
    return _self.data == 0;
  }
}
