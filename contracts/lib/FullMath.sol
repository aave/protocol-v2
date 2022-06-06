// SPDX-License-Identifier: CC-BY-4.0
pragma solidity ^0.8.0;

// taken from https://medium.com/coinmonks/math-in-solidity-part-3-percents-and-proportions-4db014e080b1
// license is CC-BY-4.0
library FullMath {
  function fullMul(uint256 x, uint256 y) private pure returns (uint256 l, uint256 h) {
    uint256 mm = mulmod(x, y, type(uint256).max);
    l = x * y;
    h = mm - l;
    if (mm < l) h -= 1;
  }

  function fullDiv(
    uint256 l,
    uint256 h,
    uint256 d
  ) private pure returns (uint256) {
    uint256 signed_d;
    unchecked {
      signed_d = 0 - d;
    }
    uint256 pow2 = d & signed_d;
    d /= pow2;
    l /= pow2;

    uint256 signed_pow2;
    unchecked {
      signed_pow2 = 0 - pow2;
    }

    l += h * (signed_pow2 / pow2 + 1);
    uint256 r = 1;
    r *= 2 - d * r;
    r *= 2 - d * r;
    r *= 2 - d * r;
    r *= 2 - d * r;
    r *= 2 - d * r;
    r *= 2 - d * r;
    r *= 2 - d * r;
    r *= 2 - d * r;
    return l * r;
  }

  function mulDiv(
    uint256 x,
    uint256 y,
    uint256 d
  ) internal pure returns (uint256) {
    (uint256 l, uint256 h) = fullMul(x, y);
    uint256 mm = mulmod(x, y, d);
    if (mm > l) h -= 1;
    l -= mm;
    require(h < d, 'FullMath::mulDiv: overflow');
    return fullDiv(l, h, d);
  }
}
