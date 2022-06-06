// SPDX-License-Identifier: AGPL-3.0-only
// Using the same Copyleft License as in the original Repository
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;
import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {IBalancerVault} from '../interfaces/IBalancerVault.sol';
import {Variable, IBalancerWeightedPool} from '../interfaces/IBalancerWeightedPool.sol';
import './interfaces/IOracle.sol';
import '../interfaces/IChainlinkAggregator.sol';
import '../dependencies/openzeppelin/contracts/IERC20.sol';
import '../interfaces/IUniswapV2Pair.sol';
import '../lib/FixedPoint.sol';

contract FBeetsOracle is IOracle, Ownable {
  using FixedPoint for *;

  uint256 private secs = 3600;
  uint256 private ago = 30;

  IChainlinkAggregator private constant FTM_USD =
    IChainlinkAggregator(0xf4766552D15AE4d256Ad41B6cf2933482B0680dc);
  // IBalancerVault private constant BeethOven_Vault =
  //   IBalancerVault(0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce);
  IBalancerWeightedPool private constant BEETS_FTM =
    IBalancerWeightedPool(0xcdE5a11a4ACB4eE4c805352Cec57E236bdBC3837);

  function get() public pure override returns (bool, uint256) {
    return (false, 0);
  }

  function peek() public pure override returns (bool, int256) {
    return (false, 0);
  }

  // Check the current spot exchange rate without any state changes
  /// @inheritdoc IOracle
  function latestAnswer() external view override returns (int256 rate) {
    uint256 _price;
    (, , , , , , uint256 timestamp) = BEETS_FTM.getSample(1023);

    if (timestamp > 0) {
      IBalancerWeightedPool.OracleAverageQuery[]
        memory queries = new IBalancerWeightedPool.OracleAverageQuery[](1);

      queries[0].variable = Variable.BPT_PRICE;
      queries[0].secs = secs;
      queries[0].ago = ago;

      uint256[] memory results = BEETS_FTM.getTimeWeightedAverage(queries);
      _price = results[0];
    } else {
      _price = BEETS_FTM.getLatest(Variable.BPT_PRICE);
    }

    rate = int256((_price * uint256(FTM_USD.latestAnswer())) / 1e18);
  }
}
