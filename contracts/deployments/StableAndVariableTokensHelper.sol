// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {LendingRateOracle} from '../mocks/oracle/LendingRateOracle.sol';
import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';

contract StableAndVariableTokensHelper is Ownable {
  constructor() {}

  function setOracleBorrowRates(
    address[] calldata assets,
    uint256[] calldata rates,
    address oracle
  ) external payable onlyOwner {
    uint256 length = assets.length;
    require(length == rates.length, 'Arrays not same length');

    for (uint256 i; i < length; ++i) {
      // LendingRateOracle owner must be this contract
      LendingRateOracle(oracle).setMarketBorrowRate(assets[i], rates[i]);
    }
  }

  function setOracleOwnership(address oracle, address admin) external payable onlyOwner {
    require(admin != address(0), 'owner can not be zero');
    require(LendingRateOracle(oracle).owner() == address(this), 'helper is not owner');
    LendingRateOracle(oracle).transferOwnership(admin);
  }
}
