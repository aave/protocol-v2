// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

/**
 * @title IFeeProvider interface
 * @notice Interface for the Aave fee provider.
 **/

interface IFeeProvider {
  function calculateLoanOriginationFee(address _user, uint256 _amount)
    external
    view
    returns (uint256);

  function getLoanOriginationFeePercentage() external view returns (uint256);
}
