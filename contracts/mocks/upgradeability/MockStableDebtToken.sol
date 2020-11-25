// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {StableDebtToken} from '../../protocol/tokenization/StableDebtToken.sol';

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

  function getRevision() internal pure override returns (uint256) {
    return 0x2;
  }
}
