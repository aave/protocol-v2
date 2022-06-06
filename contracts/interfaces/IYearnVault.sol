// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IYearnVault {
  function deposit(uint256 _amount, address recipient) external returns (uint256);

  function withdraw(
    uint256 maxShares,
    address recipient,
    uint256 maxLoss
  ) external returns (uint256);

  function pricePerShare() external view returns (uint256);
}
