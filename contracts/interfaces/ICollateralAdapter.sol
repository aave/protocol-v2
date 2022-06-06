// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title ICollateralAdapter
 * @author Sturdy
 * @notice Defines the relation between external/internal collateral assets and acceptable vaults.
 **/
interface ICollateralAdapter {
  function getAcceptableVault(address _externalAsset) external view returns (address);

  function getInternalCollateralAsset(address _externalAsset) external view returns (address);

  function addCollateralAsset(
    address _externalAsset,
    address _internalAsset,
    address _acceptVault
  ) external;
}
