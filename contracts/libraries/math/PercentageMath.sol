// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';

/**
 * @title PercentageMath library
 * @author Aave
 * @notice Provides functions to calculate percentages.
 * @dev Percentages are defined by default with 2 decimals of precision (100.00). The precision is indicated by PERCENTAGE_FACTOR
 * @dev Operations are rounded half up
 **/

library PercentageMath {
  using SafeMath for uint256;

  uint256 constant PERCENTAGE_FACTOR = 1e4; //percentage plus two decimals
  uint256 constant HALF_PERCENT = PERCENTAGE_FACTOR / 2;

  /**
   * @dev executes a percentage multiplication
   * @param _value the value of which the percentage needs to be calculated
   * @param _percentage the percentage of the value to be calculated
   * @return the _percentage of _value
   **/
  function percentMul(uint256 _value, uint256 _percentage) internal pure returns (uint256) {
    return HALF_PERCENT.add(_value.mul(_percentage)).div(PERCENTAGE_FACTOR);
  }

  /**
   * @dev executes a percentage division
   * @param _value the value of which the percentage needs to be calculated
   * @param _percentage the percentage of the value to be calculated
   * @return the _value divided the _percentage
   **/
  function percentDiv(uint256 _value, uint256 _percentage) internal pure returns (uint256) {
    uint256 halfPercentage = _percentage / 2;

    return halfPercentage.add(_value.mul(PERCENTAGE_FACTOR)).div(_percentage);
  }
}
