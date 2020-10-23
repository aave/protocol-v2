// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {LendingPoolConfigurator} from '../lendingpool/LendingPoolConfigurator.sol';

contract ReserveInitializer {
  address private poolConfigurator;

  constructor(address _poolConfigurator) public {
    poolConfigurator = _poolConfigurator;
  }

  function initReserve(
    address[] calldata tokens,
    address[] calldata stables,
    address[] calldata variables,
    address[] calldata aTokens,
    address[] calldata strategies,
    uint8[] calldata reserveDecimals
  ) external {
    // TODO require(check lenghts)

    for (uint256 i = 0; i < tokens.length; i++) {
      LendingPoolConfigurator(poolConfigurator).initReserve(
        tokens[i],
        aTokens[i],
        stables[i],
        variables[i],
        reserveDecimals[i],
        strategies[i]
      );
    }
  }
}
