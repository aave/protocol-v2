pragma solidity ^0.6.8;

import {VariableDebtToken} from '../../tokenization/VariableDebtToken.sol';
import {LendingPool} from '../../lendingpool/LendingPool.sol';
import '@nomiclabs/buidler/console.sol';

contract MockVariableDebtToken is VariableDebtToken {
  constructor(
    address _pool,
    address _underlyingAssetAddress,
    string memory _tokenName,
    string memory _tokenSymbol
  ) public VariableDebtToken(_pool, _underlyingAssetAddress, _tokenName, _tokenSymbol) {}

  function getRevision() internal override pure returns (uint256) {
    return 0x2;
  }

}
