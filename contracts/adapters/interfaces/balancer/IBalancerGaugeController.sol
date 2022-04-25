// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface IBalancerGaugeController {
  function vote_for_gauge_weights(address _gauge_addr, uint256 _user_weight) external;

  function token() external view returns (address);
}
