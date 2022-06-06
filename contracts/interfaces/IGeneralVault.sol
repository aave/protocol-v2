// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IGeneralVault {
  function pricePerShare() external view returns (uint256);

  function withdrawOnLiquidation(address _asset, uint256 _amount) external returns (uint256);

  function convertOnLiquidation(address _assetOut, uint256 _amountIn) external;

  function processYield() external;

  function getYieldAmount() external view returns (uint256);

  function setTreasuryInfo(address _treasury, uint256 _fee) external;
}
