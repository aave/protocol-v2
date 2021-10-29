// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';

interface IERC20DetailedBytes is IERC20 {
  function name() external view returns (bytes32);

  function symbol() external view returns (bytes32);

  function decimals() external view returns (uint8);
}