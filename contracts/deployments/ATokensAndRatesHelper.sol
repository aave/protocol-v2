// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {LendingPoolConfigurator} from '../protocol/lendingpool/LendingPoolConfigurator.sol';
import {IATokensAndRatesHelper} from '../interfaces/IATokensAndRatesHelper.sol';
import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {StringLib} from './StringLib.sol';

contract ATokensAndRatesHelper is Ownable {
  address private poolConfigurator;

  constructor(address _poolConfigurator) {
    poolConfigurator = _poolConfigurator;
  }

  function configureReserves(IATokensAndRatesHelper.ConfigureReserveInput[] calldata inputParams)
    external
    payable
    onlyOwner
  {
    LendingPoolConfigurator configurator = LendingPoolConfigurator(poolConfigurator);
    uint256 length = inputParams.length;
    for (uint256 i; i < length; ++i) {
      configurator.configureReserveAsCollateral(
        inputParams[i].asset,
        inputParams[i].baseLTV,
        inputParams[i].liquidationThreshold,
        inputParams[i].liquidationBonus
      );

      if (inputParams[i].borrowingEnabled) {
        configurator.enableBorrowingOnReserve(
          inputParams[i].asset,
          inputParams[i].stableBorrowingEnabled
        );
      }

      if (inputParams[i].collateralEnabled) {
        configurator.enableCollateralOnReserve(
          inputParams[i].asset,
          inputParams[i].collateralEnabled
        );
      }
      configurator.setReserveFactor(inputParams[i].asset, inputParams[i].reserveFactor);
    }
  }
}
