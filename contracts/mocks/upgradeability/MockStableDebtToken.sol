// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {StableDebtToken} from '../../tokenization/StableDebtToken.sol';

contract MockStableDebtToken is StableDebtToken {
  constructor(
    address _pool,
    address _underlyingAssetAddress,
    string memory _tokenName,
    string memory _tokenSymbol,
    address incentivesController
  )
    public
    StableDebtToken(_pool, _underlyingAssetAddress, _tokenName, _tokenSymbol, incentivesController)
  {}

  function getRevision() internal override pure returns (uint256) {
    return 0x2;
  }
}
