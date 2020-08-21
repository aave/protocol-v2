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
   * @dev sets if the user is borrowing the reserve identified by reserveIndex
   * @param self the configuration object
   * @param reserveIndex the index of the reserve in the bitmap
   * @param borrowing true if the user is borrowing the reserve, false otherwise
   **/
  function setBorrowing(
    UserConfiguration.Map storage self,
    uint256 reserveIndex,
    bool borrowing
  ) internal {
    self.data =
      (self.data & ~(1 << (reserveIndex * 2))) |
      (uint256(borrowing ? 1 : 0) << (reserveIndex * 2));
  }

  /**
   * @dev sets if the user is using as collateral the reserve identified by reserveIndex
   * @param self the configuration object
   * @param reserveIndex the index of the reserve in the bitmap
   * @param _usingAsCollateral true if the user is usin the reserve as collateral, false otherwise
   **/
  function setUsingAsCollateral(
    UserConfiguration.Map storage self,
    uint256 reserveIndex,
    bool _usingAsCollateral
  ) internal {
    self.data =
      (self.data & ~(1 << (reserveIndex * 2 + 1))) |
      (uint256(_usingAsCollateral ? 1 : 0) << (reserveIndex * 2 + 1));
  }

  /**
   * @dev used to validate if a user has been using the reserve for borrowing or as collateral
   * @param self the configuration object
   * @param reserveIndex the index of the reserve in the bitmap
   * @return true if the user has been using a reserve for borrowing or as collateral, false otherwise
   **/
  function isUsingAsCollateralOrBorrowing(UserConfiguration.Map memory self, uint256 reserveIndex)
    internal
    pure
    returns (bool)
  {
    return (self.data >> (reserveIndex * 2)) & 3 != 0;
  }

  /**
   * @dev used to validate if a user has been using the reserve for borrowing
   * @param self the configuration object
   * @param reserveIndex the index of the reserve in the bitmap
   * @return true if the user has been using a reserve for borrowing, false otherwise
   **/
  function isBorrowing(UserConfiguration.Map memory self, uint256 reserveIndex)
    internal
    pure
    returns (bool)
  {
    return (self.data >> (reserveIndex * 2)) & 1 != 0;
  }

  /**
   * @dev used to validate if a user has been using the reserve as collateral
   * @param self the configuration object
   * @param reserveIndex the index of the reserve in the bitmap
   * @return true if the user has been using a reserve as collateral, false otherwise
   **/
  function isUsingAsCollateral(UserConfiguration.Map memory self, uint256 reserveIndex)
    internal
    pure
    returns (bool)
  {
    return (self.data >> (reserveIndex * 2 + 1)) & 1 != 0;
  }

  /**
   * @dev used to validate if a user has been borrowing from any reserve
   * @param self the configuration object
   * @return true if the user has been borrowing any reserve, false otherwise
   **/
  function isBorrowingAny(UserConfiguration.Map memory self) internal pure returns (bool) {
    return self.data & BORROWING_MASK != 0;
  }

  /**
   * @dev used to validate if a user has not been using any reserve
   * @param self the configuration object
   * @return true if the user has been borrowing any reserve, false otherwise
   **/
  function isEmpty(UserConfiguration.Map memory self) internal pure returns (bool) {
    return self.data == 0;
  }
}
