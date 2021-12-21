// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {LendingPoolStorage} from './LendingPoolStorage.sol';
import {VersionedInitializable} from '../libraries/aave-upgradeability/VersionedInitializable.sol';
import {IHealthFactorLiquidationThresholdManager} from '../../interfaces/IHealthFactorLiquidationThresholdManager.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {Errors} from '../libraries/helpers/Errors.sol';

/**
 * @title HealthFactorLiquidationThresholdManager contract
 * @dev Manager for updating accounts' health factor liquidation
 * threshold.
 * - Owned by the Ormi Governance
 * @author Ormi
 **/
contract HealthFactorLiquidationThresholdManager is
  VersionedInitializable,
  IHealthFactorLiquidationThresholdManager
{
  ILendingPoolAddressesProvider internal addressesProvider;
  ILendingPool internal pool;

  uint256 internal constant CONFIGURATOR_REVISION = 0x1;

  modifier onlyPoolAdmin {
    require(addressesProvider.getPoolAdmin() == msg.sender, Errors.CALLER_NOT_POOL_ADMIN);
    _;
  }

  function getRevision() internal pure override returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  function initialize(ILendingPoolAddressesProvider provider) public initializer {
    addressesProvider = provider;
    pool = ILendingPool(addressesProvider.getLendingPool());
  }

  /**
   * @dev Returns the health factor liquidation threshold for a particular account.
   * @param user the account of the health factor liquidation threshold we are querying.
   * @return The health factor liquidation threshold.
   **/
  function getHealthFactorLiquidationThreshold(address user)
    external
    view
    override
    returns (uint256)
  {
    return pool.getHealthFactorLiquidationThreshold(user);
  }

  /**
   * @dev Updatess the health factor liquidation threshold for a particular account.
   * @param user the account of the health factor liquidation threshold we are querying.
   * @param newHealthFactorLiquidationThreshold the new health factor liquidation threshold value
   * we are updating.
   **/
  function setHealthFactorLiquidationThreshold(
    address user,
    uint256 newHealthFactorLiquidationThreshold
  ) external override onlyPoolAdmin {
    pool.setHealthFactorLiquidationThreshold(user, newHealthFactorLiquidationThreshold);
  }
}
