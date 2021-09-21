// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {ILendingPool} from './ILendingPool.sol';
import {IAaveIncentivesController} from './IAaveIncentivesController.sol';

/**
 * @title IInitializableStaticATokenLM
 * @notice Interface for the initialize function on StaticATokenLM
 * @author Aave
 **/
interface IInitializableStaticATokenLM {
  /**
   * @dev Emitted when a StaticATokenLM is initialized
   * @param pool The address of the lending pool where the underlying aToken is used
   * @param aToken The address of the underlying aToken (aWETH)
   * @param staticATokenName The name of the Static aToken
   * @param staticATokenSymbol The symbol of the Static aToken
   **/
  event Initialized(
    address indexed pool,
    address aToken,
    string staticATokenName,
    string staticATokenSymbol
  );

  /**
   * @dev Initializes the StaticATokenLM
   * @param pool The address of the lending pool where the underlying aToken is used
   * @param aToken The address of the underlying aToken (aWETH)
   * @param staticATokenName The name of the Static aToken
   * @param staticATokenSymbol The symbol of the Static aToken
   */
  function initialize(
    ILendingPool pool,
    address aToken,
    string calldata staticATokenName,
    string calldata staticATokenSymbol
  ) external;
}
