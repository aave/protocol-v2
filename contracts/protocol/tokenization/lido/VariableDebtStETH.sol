// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {VariableDebtToken} from '../VariableDebtToken.sol';

contract VariableDebtStETH is VariableDebtToken {
  constructor(
    address pool,
    address underlyingAsset,
    string memory name,
    string memory symbol,
    address incentivesController
  ) public VariableDebtToken(pool, underlyingAsset, name, symbol, incentivesController) {}

  function mint(
    address user,
    address onBehalfOf,
    uint256 amount,
    uint256 rate
  ) external override onlyLendingPool returns (bool) {
    revert('CONTRACT_NOT_ACTIVE');
  }
}
