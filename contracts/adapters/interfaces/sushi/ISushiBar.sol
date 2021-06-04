// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface ISushiBar {
  function enter(uint256 _amount) external;

  function leave(uint256 _share) external;
}
