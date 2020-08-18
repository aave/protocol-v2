pragma solidity ^0.6.8;

import {StableDebtToken} from '../../tokenization/StableDebtToken.sol';
import {LendingPool} from '../../lendingpool/LendingPool.sol';
import '@nomiclabs/buidler/console.sol';

contract MockStableDebtToken is StableDebtToken {
  constructor(
    address _pool,
    address _underlyingAssetAddress,
    string memory _tokenName,
    string memory _tokenSymbol
  ) public StableDebtToken(_pool, _underlyingAssetAddress, _tokenName, _tokenSymbol) {}

  function getRevision() internal override pure returns (uint256) {
    return 0x2;
  }

}
