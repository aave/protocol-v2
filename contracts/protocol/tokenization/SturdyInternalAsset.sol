// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {ERC20} from '../../dependencies/openzeppelin/contracts/ERC20.sol';
import {Ownable} from '../../dependencies/openzeppelin/contracts/Ownable.sol';

/**
 * @notice implementation of the internal asset token contract
 * @author Sturdy
 */
contract SturdyInternalAsset is ERC20, Ownable {
  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals
  ) ERC20(name, symbol) {
    _setupDecimals(decimals);
  }

  /**
   * @dev Function to mint token
   * @param user The user which token is mint
   * @param amount The amount of tokens to mint.
   * @return A boolean that indicates if the operation was successful.
   */
  function mint(address user, uint256 amount) external payable onlyOwner returns (bool) {
    _mint(user, amount);
    return true;
  }

  /**
   * @dev Function to burn token
   * @param user The user which token is burned
   * @param amount The amount of tokens to burn
   */
  function burn(address user, uint256 amount) external payable onlyOwner {
    _burn(user, amount);
  }
}
