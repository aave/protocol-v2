// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

contract MockAggregator {
  int256 private _latestAnswer;

  event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 timestamp);

  constructor(int256 _initialAnswer) public {
    _latestAnswer = _initialAnswer;
    emit AnswerUpdated(_initialAnswer, 0, now);
  }

  function latestAnswer() external view returns (int256) {
    return _latestAnswer;
  }

  // function getToken() external view returns (address) {

  // }

  function getTokenType() external view returns (uint256) {
    return 1;
  }

  // function getPlatformId() external view returns (uint256) {

  // }

  // function getSubTokens() external view returns (address[] memory) {

  // }
}
