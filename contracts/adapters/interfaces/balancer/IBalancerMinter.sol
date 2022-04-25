// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface IBalancerMinter {
  function mint(address gauge) external;
}
