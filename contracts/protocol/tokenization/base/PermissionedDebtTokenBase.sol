// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {DebtTokenBase} from './DebtTokenBase.sol';
import {ILendingPool} from '../../../interfaces/ILendingPool.sol';
import {
  VersionedInitializable
} from '../../libraries/aave-upgradeability/VersionedInitializable.sol';
import {IncentivizedERC20} from '../IncentivizedERC20.sol';
import {Errors} from '../../libraries/helpers/Errors.sol';
import {IPermissionManager} from '../../../interfaces/IPermissionManager.sol';
import {DataTypes} from '../../libraries/types/DataTypes.sol';

/**
 * @title PermissionedDebtTokenBase
 * @notice Base contract for different types of debt tokens, like StableDebtToken or VariableDebtToken. Includes permissioned credit delegation
 * @author Aave
 */

abstract contract PermissionedDebtTokenBase is DebtTokenBase 
{
  //identifier for the permission manager contract in the addresses provider
  bytes32 public constant PERMISSION_MANAGER = keccak256('PERMISSION_MANAGER');

  
  modifier onlyBorrowers {
    IPermissionManager permissionManager =
      IPermissionManager(_getLendingPool().getAddressesProvider().getAddress(PERMISSION_MANAGER));

    require(
      permissionManager.isInRole(_msgSender(), uint256(DataTypes.Roles.BORROWER)),
      Errors.PLP_BORROWER_UNAUTHORIZED
    );
    _;
  }

  /**
   * @dev delegates borrowing power to a user on the specific debt token
   * @param delegatee the address receiving the delegated borrowing power
   * @param amount the maximum amount being delegated. Delegation will still
   * respect the liquidation constraints (even if delegated, a delegatee cannot
   * force a delegator HF to go below 1)
   **/
  function approveDelegation(address delegatee, uint256 amount) public override onlyBorrowers {
    super.approveDelegation(delegatee, amount);   
  }
}
