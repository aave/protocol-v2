// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {LendingPool} from '../lendingpool/LendingPool.sol';
import {LendingPoolAddressesProvider} from '../configuration/LendingPoolAddressesProvider.sol';
import {LendingPoolConfigurator} from '../lendingpool/LendingPoolConfigurator.sol';
import {AToken} from '../tokenization/AToken.sol';
import {
  DefaultReserveInterestRateStrategy
} from '../lendingpool/DefaultReserveInterestRateStrategy.sol';

contract ATokensAndRatesHelper {
  address payable private pool;
  address private addressesProvider;
  address private poolConfigurator;
  event deployedContracts(address aToken, address strategy);

  constructor(
    address payable _pool,
    address _addressesProvider,
    address _poolConfigurator
  ) public {
    pool = _pool;
    addressesProvider = _addressesProvider;
    poolConfigurator = _poolConfigurator;
  }

  function concat(string memory a, string memory b) internal pure returns (string memory) {
    return string(abi.encodePacked(a, b));
  }

  function initDeployment(
    address[] calldata tokens,
    string[] calldata symbols,
    uint256[5][] calldata rates,
    address incentivesController
  ) external {
    require(tokens.length == symbols.length, 't Arrays not same length');
    require(rates.length == symbols.length, 'r Arrays not same length');

    for (uint256 i = 0; i < tokens.length; i++) {
      emit deployedContracts(
        address(
          new AToken(
            LendingPool(pool),
            tokens[i],
            address(0),
            concat('Aave interest bearing ', symbols[i]),
            concat('a', symbols[i]),
            incentivesController
          )
        ),
        address(
          new DefaultReserveInterestRateStrategy(
            LendingPoolAddressesProvider(addressesProvider),
            rates[i][0],
            rates[i][1],
            rates[i][2],
            rates[i][3],
            rates[i][4]
          )
        )
      );
    }
  }

  function initReserve(
    address[] calldata stables,
    address[] calldata variables,
    address[] calldata aTokens,
    address[] calldata strategies,
    uint8[] calldata reserveDecimals
  ) external {
    require(variables.length == stables.length);
    require(aTokens.length == stables.length);
    require(strategies.length == stables.length);
    require(reserveDecimals.length == stables.length);

    for (uint256 i = 0; i < stables.length; i++) {
      LendingPoolConfigurator(poolConfigurator).initReserve(
        aTokens[i],
        stables[i],
        variables[i],
        reserveDecimals[i],
        strategies[i]
      );
    }
  }

  function enableReservesAsCollateral(
    address[] calldata tokens,
    uint256[] calldata baseLTVs,
    uint256[] calldata liquidationThresholds,
    uint256[] calldata liquidationBonuses
  ) external {
    require(baseLTVs.length == tokens.length);
    require(liquidationThresholds.length == tokens.length);
    require(liquidationBonuses.length == tokens.length);

    for (uint256 i = 0; i < tokens.length; i++) {
      LendingPoolConfigurator(poolConfigurator).enableReserveAsCollateral(
        tokens[i],
        baseLTVs[i],
        liquidationThresholds[i],
        liquidationBonuses[i]
      );
    }
  }

  function enableBorrowingOnReserves(address[] calldata tokens, bool[] calldata stableBorrows)
    external
  {
    require(stableBorrows.length == tokens.length);

    for (uint256 i = 0; i < tokens.length; i++) {
      LendingPoolConfigurator(poolConfigurator).enableBorrowingOnReserve(
        tokens[i],
        stableBorrows[i]
      );
    }
  }
}
