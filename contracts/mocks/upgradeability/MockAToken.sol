// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {AToken} from '../../protocol/tokenization/AToken.sol';
import {LendingPool} from '../../protocol/lendingpool/LendingPool.sol';

contract MockAToken is AToken {
  constructor(
    LendingPool pool,
    address underlyingAssetAddress,
    address reserveTreasury,
    string memory tokenName,
    string memory tokenSymbol,
    address incentivesController
  )
    public
    AToken(
      pool,
      underlyingAssetAddress,
      reserveTreasury,
      tokenName,
      tokenSymbol,
      incentivesController
    )
  {}

  function getRevision() internal pure override returns (uint256) {
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
