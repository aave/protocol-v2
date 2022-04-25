// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';

interface IBalancerFeeDistributor {
  function claimToken(address user, IERC20 token) external returns (uint256);
}
