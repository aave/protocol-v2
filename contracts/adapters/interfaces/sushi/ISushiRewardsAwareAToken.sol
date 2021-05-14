// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface ISushiRewardsAwareAToken {
  function getMasterChef() external view returns (address);

  function getSushiBar() external view returns (address);

  function getSushiToken() external view returns (address);

  function getMasterChefPoolId() external view returns (uint256);
}
