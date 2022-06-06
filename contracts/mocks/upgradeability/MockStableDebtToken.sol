// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {StableDebtToken} from '../../protocol/tokenization/StableDebtToken.sol';

contract MockStableDebtToken is StableDebtToken {
  function getRevision() internal pure override returns (uint256) {
    return 0x2;
  }
}
