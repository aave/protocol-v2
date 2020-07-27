// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';

/**
 * @title PercentageMath library
 * @author Aave
 * @notice Provides functions to calculate percentages. Percentages needs to be defined by default with 2 decimals of precision (100.00)
 * @dev Operations are rounded up
 **/

library PercentageMath {
  using SafeMath for uint256;

  uint256 constant PERCENTAGE_FACTOR = 1e2; //percentage plus two decimals
  uint256 constant HALF_PERCENT = PERCENTAGE_FACTOR / 2;

  function percentMul(uint256 value, uint256 percentage) internal pure returns (uint256) {
    return HALF_PERCENT.add(value.mul(percentage)).div(PERCENTAGE_FACTOR);
  }

  function percentDiv(uint256 value, uint256 percentage) internal pure returns (uint256) {
    uint256 halfPercentage = percentage / 2;

    return halfPercentage.add(value.mul(PERCENTAGE_FACTOR)).div(percentage);
  }
}
