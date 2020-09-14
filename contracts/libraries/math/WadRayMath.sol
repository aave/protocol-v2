// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {Errors} from '../helpers/Errors.sol';

/**
 * @title WadRayMath library
 * @author Aave
 * @dev Provides mul and div function for wads (decimal numbers with 18 digits precision) and rays (decimals with 27 digits)
 **/

library WadRayMath {
  uint256 internal constant WAD = 1e18;
  uint256 internal constant halfWAD = WAD / 2;

  uint256 internal constant RAY = 1e27;
  uint256 internal constant halfRAY = RAY / 2;

  uint256 internal constant WAD_RAY_RATIO = 1e9;

  /**
   * @return one ray, 1e27
   **/
  function ray() internal pure returns (uint256) {
    return RAY;
  }

  /**
   * @return one wad, 1e18
   **/

  function wad() internal pure returns (uint256) {
    return WAD;
  }

  /**
   * @return half ray, 1e27/2
   **/
  function halfRay() internal pure returns (uint256) {
    return halfRAY;
  }

  /**
   * @return half ray, 1e18/2
   **/
  function halfWad() internal pure returns (uint256) {
    return halfWAD;
  }

  /**
   * @dev multiplies two wad, rounding half up to the nearest wad
   * @param a wad
   * @param b wad
   * @return the result of a*b, in wad
   **/
  function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0) {
      return 0;
    }

    uint256 result = a * b;

    require(result / a == b, Errors.MULTIPLICATION_OVERFLOW);

    result += halfWAD;

    require(result >= halfWAD, Errors.ADDITION_OVERFLOW);

    return result / WAD;
  }

  /**
   * @dev divides two wad, rounding half up to the nearest wad
   * @param a wad
   * @param b wad
   * @return the result of a/b, in wad
   **/
  function wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b != 0, Errors.DIVISION_BY_ZERO);

    uint256 halfB = b / 2;

    uint256 result = a * WAD;

    require(result / WAD == a, Errors.MULTIPLICATION_OVERFLOW);

    result += halfB;

    require(result >= halfB, Errors.ADDITION_OVERFLOW);

    return result / b;
  }

  /**
   * @dev multiplies two ray, rounding half up to the nearest ray
   * @param a ray
   * @param b ray
   * @return the result of a*b, in ray
   **/
  function rayMul(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0) {
      return 0;
    }

    uint256 result = a * b;

    require(result / a == b, Errors.MULTIPLICATION_OVERFLOW);

    result += halfRAY;

    require(result >= halfRAY, Errors.ADDITION_OVERFLOW);

    return result / RAY;
  }

  /**
   * @dev divides two ray, rounding half up to the nearest ray
   * @param a ray
   * @param b ray
   * @return the result of a/b, in ray
   **/
  function rayDiv(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b != 0, Errors.DIVISION_BY_ZERO);

    uint256 halfB = b / 2;

    uint256 result = a * RAY;

    require(result / RAY == a, Errors.MULTIPLICATION_OVERFLOW);

    result += halfB;

    require(result >= halfB, Errors.ADDITION_OVERFLOW);

    return result / b;
  }

  /**
   * @dev casts ray down to wad
   * @param a ray
   * @return a casted to wad, rounded half up to the nearest wad
   **/
  function rayToWad(uint256 a) internal pure returns (uint256) {
    uint256 halfRatio = WAD_RAY_RATIO / 2;
    uint256 result = halfRatio + a;
    require(result >= halfRatio, Errors.ADDITION_OVERFLOW);

    return result / WAD_RAY_RATIO;
  }

  /**
   * @dev convert wad up to ray
   * @param a wad
   * @return a converted in ray
   **/
  function wadToRay(uint256 a) internal pure returns (uint256) {
    uint256 result = a * WAD_RAY_RATIO;
    require(result / WAD_RAY_RATIO == a, Errors.MULTIPLICATION_OVERFLOW);
    return result;
  }
}
