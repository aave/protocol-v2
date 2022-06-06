// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface ICurveSwap {
  function get_virtual_price() external view returns (uint256 price);

  function coins(uint256) external view returns (address);

  function calc_withdraw_one_coin(uint256 _burn_amount, int128 i) external view returns (uint256);

  function remove_liquidity_one_coin(
    uint256 _burn_amount,
    int128 i,
    uint256 _min_received
  ) external;
}
