// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Errors} from '../helpers/Errors.sol';

library RayMathNoRounding {
  uint256 internal constant RAY = 1e27;
  uint256 internal constant WAD_RAY_RATIO = 1e9;

  function rayMulNoRounding(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0 || b == 0) {
      return 0;
    }
    require(a <= type(uint256).max / b, Errors.MATH_MULTIPLICATION_OVERFLOW);
    return (a * b) / RAY;
  }

  function rayDivNoRounding(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b != 0, Errors.MATH_DIVISION_BY_ZERO);
    require(a <= (type(uint256).max) / RAY, Errors.MATH_MULTIPLICATION_OVERFLOW);
    return (a * RAY) / b;
  }

  function rayToWadNoRounding(uint256 a) internal pure returns (uint256) {
    return a / WAD_RAY_RATIO;
  }
}
