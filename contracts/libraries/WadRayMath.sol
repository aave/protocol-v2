// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import '@openzeppelin/contracts/math/SafeMath.sol';

/**
 * @title WadRayMath library
 * @author Aave
 * @dev Provides mul and div function for wads (decimal numbers with 18 digits precision) and rays (decimals with 27 digits)
 **/

library WadRayMath {
  using SafeMath for uint256;

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
    return halfWAD.add(a.mul(b)).div(WAD);
  }

  /**
   * @dev divides two wad, rounding half up to the nearest wad
   * @param a wad
   * @param b wad
   * @return the result of a/b, in wad
   **/
  function wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 halfB = b / 2;

    return halfB.add(a.mul(WAD)).div(b);
  }

  /**
   * @dev multiplies two ray, rounding half up to the nearest ray
   * @param a ray
   * @param b ray
   * @return the result of a*b, in ray
   **/
  function rayMul(uint256 a, uint256 b) internal pure returns (uint256) {
    return halfRAY.add(a.mul(b)).div(RAY);
  }

  /**
   * @dev divides two ray, rounding half up to the nearest ray
   * @param a ray
   * @param b ray
   * @return the result of a/b, in ray
   **/
  function rayDiv(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 halfB = b / 2;

    return halfB.add(a.mul(RAY)).div(b);
  }

  /**
   * @dev casts ray down to wad
   * @param a ray
   * @return a casted to wad, rounded half up to the nearest wad
   **/
  function rayToWad(uint256 a) internal pure returns (uint256) {
    uint256 halfRatio = WAD_RAY_RATIO / 2;

    return halfRatio.add(a).div(WAD_RAY_RATIO);
  }

  /**
   * @dev convert wad up to ray
   * @param a wad
   * @return a converted in ray
   **/
  function wadToRay(uint256 a) internal pure returns (uint256) {
    return a.mul(WAD_RAY_RATIO);
  }

  /**
   * @dev calculates base^exp. The code uses the ModExp precompile
   * @return z base^exp, in ray
   */
  //solium-disable-next-line
  function rayPow(uint256 x, uint256 n) internal pure returns (uint256 z) {
    z = n % 2 != 0 ? x : RAY;

    for (n /= 2; n != 0; n /= 2) {
      x = rayMul(x, x);

      if (n % 2 != 0) {
        z = rayMul(z, x);
      }
    }
  }
}
