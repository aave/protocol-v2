// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {VariableDebtToken} from '../../protocol/tokenization/VariableDebtToken.sol';

contract MockVariableDebtToken is VariableDebtToken {
  function getRevision() internal pure override returns (uint256) {
    return 0x2;
  }
}
