// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IRocketTokenRETH {
  function getExchangeRate() external view returns (uint256);
}
