// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

contract ChainlinkAggregatorMock {
  int256 public price = 1 ether;

  function setPrice(int256 newPrice) external {
    price = newPrice;
  }

  function latestAnswer() external view returns (int256) {
    return price;
  }
}
