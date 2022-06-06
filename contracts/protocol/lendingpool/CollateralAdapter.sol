// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {Errors} from '../libraries/helpers/Errors.sol';
import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {VersionedInitializable} from '../../protocol/libraries/sturdy-upgradeability/VersionedInitializable.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';

/**
 * @title CollateralAdapter
 * @notice CollateralToVault mapping adapter
 * @author Sturdy
 **/

contract CollateralAdapter is VersionedInitializable {
  modifier onlyAdmin() {
    require(_addressesProvider.getPoolAdmin() == msg.sender, Errors.CALLER_NOT_POOL_ADMIN);
    _;
  }

  uint256 private constant VAULT_REVISION = 0x1;

  ILendingPoolAddressesProvider internal _addressesProvider;

  // External collateral asset -> vault
  mapping(address => address) internal _assetToVaults;
  // External collateral asset -> internal collateral asset
  mapping(address => address) internal _collateralAssets;

  /**
   * @dev Emitted on addCollateralAsset()
   * @param _externalAsset The address of the external asset
   * @param _internalAsset The address of the internal asset
   * @param _acceptVault The address of the vault
   **/
  event AddCollateral(address _externalAsset, address _internalAsset, address _acceptVault);

  /**
   * @dev Function is invoked by the proxy contract when the Adapter contract is deployed.
   * @param _provider The address of the provider
   **/
  function initialize(ILendingPoolAddressesProvider _provider) external initializer {
    _addressesProvider = _provider;
  }

  function getRevision() internal pure override returns (uint256) {
    return VAULT_REVISION;
  }

  function addCollateralAsset(
    address _externalAsset,
    address _internalAsset,
    address _acceptVault
  ) external payable onlyAdmin {
    _assetToVaults[_externalAsset] = _acceptVault;
    _collateralAssets[_externalAsset] = _internalAsset;

    emit AddCollateral(_externalAsset, _internalAsset, _acceptVault);
  }

  function getAcceptableVault(address _externalAsset) external view returns (address) {
    return _assetToVaults[_externalAsset];
  }

  function getInternalCollateralAsset(address _externalAsset) external view returns (address) {
    return _collateralAssets[_externalAsset];
  }
}
