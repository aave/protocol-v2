pragma solidity ^0.6.6;

import {MintableERC20} from './MintableERC20.sol';

/**
 * @title Faucet
 * @author Aave
 * @notice Smart contract abstracting minting logic on an underlying mintable token
 */
contract Faucet {
  /**
   * @notice Mint function
   * @param _token Address of the token to mint
   * @param _amount Amount to mint
   * @return The amount minted
   */
  function mint(address _token, uint256 _amount) external returns (uint256) {
    MintableERC20(_token).mint(_amount);
    MintableERC20(_token).transfer(msg.sender, _amount);
    return _amount;
  }
}
