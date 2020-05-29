// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import "./MockAggregatorBase.sol";

contract MockAggregatorUNI_LEND_ETH is MockAggregatorBase {
    constructor (int256 _initialAnswer) public MockAggregatorBase(_initialAnswer) {}
}