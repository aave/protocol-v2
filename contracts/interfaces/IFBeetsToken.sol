// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';

interface IFBeetsToken is IERC20 {
  function vestingToken() external view returns (address);

  function enter(uint256 _amount) external;

  function leave(uint256 _shareOfFreshBeets) external;
}
