// SPDX-License-Identifier: AGPL-3.0-only
// Using the same Copyleft License as in the original Repository
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import './interfaces/IOracle.sol';
import '../interfaces/IChainlinkAggregator.sol';
import '../interfaces/ICurvePool.sol';
import {Math} from '../dependencies/openzeppelin/contracts/Math.sol';

/**
 * @dev Oracle contract for DOLA3CRV LP Token
 */
contract DOLA3CRVOracle is IOracle {
  ICurvePool private constant DOLA3CRV = ICurvePool(0xAA5A67c256e27A5d80712c51971408db3370927D);
  ICurvePool private constant CRV3 = ICurvePool(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);

  IChainlinkAggregator private constant DAI =
    IChainlinkAggregator(0x773616E4d11A78F511299002da57A0a94577F1f4);
  IChainlinkAggregator private constant USDC =
    IChainlinkAggregator(0x986b5E1e1755e3C2440e960477f25201B0a8bbD4);
  IChainlinkAggregator private constant USDT =
    IChainlinkAggregator(0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46);
  IChainlinkAggregator private constant USD =
    IChainlinkAggregator(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);

  /**
   * @dev Get price for 3Pool LP Token
   */
  function _get3CRVPrice() internal view returns (uint256) {
    uint256 daiPrice = uint256(DAI.latestAnswer());
    uint256 usdcPrice = uint256(USDC.latestAnswer());
    uint256 usdtPrice = uint256(USDT.latestAnswer());
    uint256 minStable = Math.min(daiPrice, Math.min(usdcPrice, usdtPrice));
    return (CRV3.get_virtual_price() * minStable) / 1e18;
  }

  /**
   * @dev Get Dola price
   */
  function _getDolaPrice() internal view returns (uint256) {
    uint256 _price = uint256(USD.latestAnswer()); // ETH / USD
    uint256 tokenPrice = 1e18;
    return (tokenPrice / _price) * 1e8;
  }

  /**
   * @dev Get LP Token Price
   */
  function _get() internal view returns (uint256) {
    uint256 lp3crvPrice = _get3CRVPrice();
    uint256 dolaPrice = _getDolaPrice();
    uint256 minValue = Math.min(dolaPrice, lp3crvPrice);

    return (DOLA3CRV.get_virtual_price() * minValue) / 1e18;
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
