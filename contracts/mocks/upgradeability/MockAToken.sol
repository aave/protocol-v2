// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {AToken} from '../../tokenization/AToken.sol';
import {LendingPool} from '../../lendingpool/LendingPool.sol';

contract MockAToken is AToken {
  constructor(
    LendingPool pool,
    address underlyingAssetAddress,
    address reserveTreasury,
    string memory tokenName,
    string memory tokenSymbol,
    address incentivesController
  ) public AToken(pool, underlyingAssetAddress, reserveTreasury, tokenName, tokenSymbol, incentivesController) {}

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
