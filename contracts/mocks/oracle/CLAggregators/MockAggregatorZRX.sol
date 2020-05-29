// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import "./MockAggregatorBase.sol";

contract MockAggregatorZRX is MockAggregatorBase {
    constructor (int256 _initialAnswer) public MockAggregatorBase(_initialAnswer) {}
}