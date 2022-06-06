// SPDX-License-Identifier: AGPL-3.0-only
// Using the same Copyleft License as in the original Repository
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import './interfaces/IOracle.sol';
import '../interfaces/IChainlinkAggregator.sol';
import '../interfaces/ICurvePool.sol';
import '../interfaces/IRocketTokenRETH.sol';

contract CrvREthWstETHOracle is IOracle {
  IRocketTokenRETH private constant RETH =
    IRocketTokenRETH(0xae78736Cd615f374D3085123A210448E74Fc6393);
  ICurvePool private constant RETH_WSTETH = ICurvePool(0x447Ddd4960d9fdBF6af9a790560d0AF76795CB08);
  IChainlinkAggregator private constant STETH =
    IChainlinkAggregator(0x86392dC19c0b719886221c78AB11eb8Cf5c52812);

  function _get() internal view returns (uint256) {
    uint256 rETH_Price = RETH.getExchangeRate(); // 1eth * exchangeRate / 1e18
    uint256 stETH_Price = uint256(STETH.latestAnswer());
    if (rETH_Price > stETH_Price) return (RETH_WSTETH.get_virtual_price() * stETH_Price) / 1e18;

    return (RETH_WSTETH.get_virtual_price() * rETH_Price) / 1e18;
  }

  // Get the latest exchange rate, if no valid (recent) rate is available, return false
  /// @inheritdoc IOracle
  function get() public view override returns (bool, uint256) {
    return (true, _get());
  }

  // Check the last exchange rate without any state changes
  /// @inheritdoc IOracle
  function peek() public view override returns (bool, int256) {
    return (true, int256(_get()));
  }

  // Check the current spot exchange rate without any state changes
  /// @inheritdoc IOracle
  function latestAnswer() external view override returns (int256 rate) {
    return int256(_get());
  }
}
