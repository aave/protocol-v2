// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

/**
 * @title PercentageMath library
 * @author Aave
 * @notice Provides functions to calculate percentages.
 * @dev Percentages are defined by default with 2 decimals of precision (100.00). The precision is indicated by PERCENTAGE_FACTOR
 * @dev Operations are rounded half up
 **/

library PercentageMath {

  uint256 constant PERCENTAGE_FACTOR = 1e4; //percentage plus two decimals
  uint256 constant HALF_PERCENT = PERCENTAGE_FACTOR / 2;

  /**
   * @dev executes a percentage multiplication
   * @param value the value of which the percentage needs to be calculated
   * @param percentage the percentage of the value to be calculated
   * @return the percentage of value
   **/
  function percentMul(uint256 value, uint256 percentage) internal pure returns (uint256) {
      if(value == 0){
      return 0;
    }
    
    uint256 result = value*percentage;
    
    require(result/value == percentage, "PercentageMath: Multiplication overflow");
    
    result+=HALF_PERCENT;
    
    require(result >= HALF_PERCENT, "PercentageMath: Addition overflow");

    return result/PERCENTAGE_FACTOR;
  }

  /**
   * @dev executes a percentage division
   * @param value the value of which the percentage needs to be calculated
   * @param percentage the percentage of the value to be calculated
   * @return the value divided the percentage
   **/
  function percentDiv(uint256 value, uint256 percentage) internal pure returns (uint256) {
    require(percentage != 0, "PercentageMath: Division by 0");
    uint256 halfPercentage = percentage / 2;
 
    uint256 result = value*PERCENTAGE_FACTOR;

    require(result/PERCENTAGE_FACTOR == value, "PercentageMath: Multiplication overflow");

    result += halfPercentage;

    require(result >= halfPercentage, "PercentageMath: Addition overflow");

    return result/percentage;
  }
}
