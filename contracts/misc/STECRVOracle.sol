// SPDX-License-Identifier: AGPL-3.0-only
// Using the same Copyleft License as in the original Repository
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import './interfaces/IOracle.sol';
import '../interfaces/IChainlinkAggregator.sol';
import '../interfaces/ICurvePool.sol';
import {Math} from '../dependencies/openzeppelin/contracts/Math.sol';

/**
 * @dev Oracle contract for Curve.fi ETH/stETH (steCRV) LP Token
 */
contract STECRVOracle is IOracle {
  ICurvePool private constant STECRV = ICurvePool(0xDC24316b9AE028F1497c275EB9192a3Ea0f67022);
  IChainlinkAggregator private constant STETH =
    IChainlinkAggregator(0x86392dC19c0b719886221c78AB11eb8Cf5c52812);

  /**
   * @dev Get LP Token Price
   */
  function _get() internal view returns (uint256) {
    uint256 stETH_Price = uint256(STETH.latestAnswer());
    uint256 minValue = Math.min(stETH_Price, 1e18);

    return (STECRV.get_virtual_price() * minValue) / 1e18;
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
