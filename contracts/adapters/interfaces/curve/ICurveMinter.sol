// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface ICurveMinter {
  function mint(address gauge) external;
}
