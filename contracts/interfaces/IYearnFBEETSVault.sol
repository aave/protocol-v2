// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IYearnFBEETSVault {
  function beethoven_BEETS_FTM_PoolId() external view returns (bytes32);

  function beethovenSwapPoolId() external view returns (bytes32);

  function getBeethovenVault() external view returns (address);
}
