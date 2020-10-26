// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {StableDebtToken} from '../tokenization/StableDebtToken.sol';
import {VariableDebtToken} from '../tokenization/VariableDebtToken.sol';

contract StableAndVariableTokensHelper {
  address payable private pool;
  address private addressesProvider;
  event deployedContracts(address stableToken, address variableToken);

  constructor(address payable _pool, address _addressesProvider) public {
    pool = _pool;
    addressesProvider = _addressesProvider;
  }

  function concat(string memory a, string memory b) internal pure returns (string memory) {
    return string(abi.encodePacked(a, ' ', b));
  }

  function initDeployment(
    address[] calldata tokens,
    string[] calldata symbols,
    address incentivesController
  ) external {
    require(tokens.length == symbols.length, 'Arrays not same length');
    require(pool != address(0), 'Pool can not be zero address');
    for (uint256 i = 0; i < tokens.length; i++) {
      emit deployedContracts(
        address(
          new StableDebtToken(
            pool,
            tokens[i],
            concat('Aave stable debt bearing ', symbols[i]),
            concat('stableDebt', symbols[i]),
            incentivesController
          )
        ),
        address(
          new VariableDebtToken(
            pool,
            tokens[i],
            concat('Aave variable debt bearing ', symbols[i]),
            concat('variableDebt', symbols[i]),
            incentivesController
          )
        )
      );
    }
  }
}
