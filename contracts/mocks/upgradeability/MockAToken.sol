// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {AToken} from '../../tokenization/AToken.sol';
import {LendingPool} from '../../lendingpool/LendingPool.sol';

contract MockAToken is AToken {
  constructor(
    LendingPool _pool,
    address _underlyingAssetAddress,
    string memory _tokenName,
    string memory _tokenSymbol
  ) public AToken(_pool, _underlyingAssetAddress, _tokenName, _tokenSymbol) {}

  function getRevision() internal override pure returns (uint256) {
    return 0x2;
  }

  function initialize(
    uint8 _underlyingAssetDecimals,
    string calldata _tokenName,
    string calldata _tokenSymbol
  ) external virtual override initializer {
    _setName(_tokenName);
    _setSymbol(_tokenSymbol);
    _setDecimals(_underlyingAssetDecimals);
  }
}
