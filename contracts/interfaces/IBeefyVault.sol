// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IBeefyVault {
  function deposit(uint256 _amount) external;

  function withdraw(uint256 _shares) external;

  function getPricePerFullShare() external view returns (uint256);
}
