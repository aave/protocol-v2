pragma solidity ^0.6.6;

import {MintableERC20} from './MintableERC20.sol';

/**
 * @title TokenMinter
 * @author Aave
 * @notice Proxy smart contract abstracting minting logic on an underlying mintable token
 */
contract TokenMinter {
  bool internal constant IS_ETH_REQUIRED = false;

  /**
   * @notice Mint function
   * @param _token Address of the token to mint
   * @param _amount Amount to mint
   * @return The amount minted
   */
  function mint(address _token, uint256 _amount) external payable returns (uint256) {
    MintableERC20(_token).mint(_amount);
    MintableERC20(_token).transfer(msg.sender, _amount);
    return _amount;
  }

  /**
   * @notice Returns if the mint() function is payable or not
   * @return bool
   */
  function isEthRequired() external pure returns (bool) {
    return IS_ETH_REQUIRED;
  }
}
