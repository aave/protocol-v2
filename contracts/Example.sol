pragma solidity ^0.6.8;

// "SPDX-License-Identifier: AGPL-3.0-only"

contract Example {
    uint256 public _n;

    constructor() public {
        _n = 5;
    }

    function test() external view returns(uint256 n) {
        n = _n;
    }
}