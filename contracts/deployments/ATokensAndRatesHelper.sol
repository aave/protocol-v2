// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {LendingPool} from '../protocol/lendingpool/LendingPool.sol';
import {
  LendingPoolAddressesProvider
} from '../protocol/configuration/LendingPoolAddressesProvider.sol';
import {LendingPoolConfigurator} from '../protocol/lendingpool/LendingPoolConfigurator.sol';
import {AToken} from '../protocol/tokenization/AToken.sol';
import {
  DefaultReserveInterestRateStrategy
} from '../protocol/lendingpool/DefaultReserveInterestRateStrategy.sol';
import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {StringLib} from './StringLib.sol';

contract ATokensAndRatesHelper is Ownable {
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

  function initDeployment(
    address[] calldata assets,
    string[] calldata symbols,
    uint256[6][] calldata rates,
    address treasuryAddress,
    address incentivesController
  ) external onlyOwner {
    require(assets.length == symbols.length, 't Arrays not same length');
    require(rates.length == symbols.length, 'r Arrays not same length');
    for (uint256 i = 0; i < assets.length; i++) {
      emit deployedContracts(
        address(
          new AToken(
            LendingPool(pool),
            assets[i],
            treasuryAddress,
            StringLib.concat('Aave interest bearing ', symbols[i]),
            StringLib.concat('a', symbols[i]),
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
            rates[i][4],
            rates[i][5]
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
  ) external onlyOwner {
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

  function configureReserves(
    address[] calldata assets,
    uint256[] calldata baseLTVs,
    uint256[] calldata liquidationThresholds,
    uint256[] calldata liquidationBonuses,
    uint256[] calldata reserveFactors,
    bool[] calldata stableBorrowingEnabled
  ) external onlyOwner {
    require(baseLTVs.length == assets.length);
    require(liquidationThresholds.length == assets.length);
    require(liquidationBonuses.length == assets.length);
    require(stableBorrowingEnabled.length == assets.length);
    require(reserveFactors.length == assets.length);

    LendingPoolConfigurator configurator = LendingPoolConfigurator(poolConfigurator);
    for (uint256 i = 0; i < assets.length; i++) {
      configurator.configureReserveAsCollateral(
        assets[i],
        baseLTVs[i],
        liquidationThresholds[i],
        liquidationBonuses[i]
      );

      configurator.enableBorrowingOnReserve(assets[i], stableBorrowingEnabled[i]);
      configurator.setReserveFactor(assets[i], reserveFactors[i]);
    }
  }
}
