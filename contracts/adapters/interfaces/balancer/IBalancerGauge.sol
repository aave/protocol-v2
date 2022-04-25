// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface IBalancerGauge {
  function claim_rewards() external;

  function deposit(uint256 _value) external;

  function deposit(uint256 _value, address _addr) external;

  function withdraw(uint256 _value) external;

  function user_checkpoint(address _value) external returns (bool);
}

interface IBalancerGaugeView {
  function reward_tokens(uint256 arg0) external view returns (address);

  function integrate_fraction(address user) external view returns (uint256);

  function claimable_reward(address user, address token) external view returns (uint256);
}
