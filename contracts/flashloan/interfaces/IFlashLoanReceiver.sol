// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

/**
* @title IFlashLoanReceiver interface
* @notice Interface for the Aave fee IFlashLoanReceiver.
* @author Aave
* @dev implement this interface to develop a flashloan-compatible flashLoanReceiver contract
**/
interface IFlashLoanReceiver {

    function executeOperation(address _reserve, address _destination, uint256 _amount, uint256 _fee, bytes calldata _params) external;
}
