// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {IWETH} from './interfaces/IWETH.sol';
import {WETHGateway} from './WETHGateway.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {IAToken} from '../interfaces/IAToken.sol';
import {ReserveConfiguration} from '../protocol/libraries/configuration/ReserveConfiguration.sol';
import {UserConfiguration} from '../protocol/libraries/configuration/UserConfiguration.sol';
import {Helpers} from '../protocol/libraries/helpers/Helpers.sol';
import {DataTypes} from '../protocol/libraries/types/DataTypes.sol';
import {IPermissionManager} from '../interfaces/IPermissionManager.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {Errors} from '../protocol/libraries/helpers/Errors.sol';

contract PermissionedWETHGateway is WETHGateway {
  /**
   * @dev Sets the WETH address and the LendingPoolAddressesProvider address. Infinite approves lending pool.
   * @param weth Address of the Wrapped Ether contract
   **/
  constructor(address weth) public WETHGateway(weth) {}

  /**
   * @dev deposits WETH into the reserve, using native ETH. A corresponding amount of the overlying asset (aTokens)
   * is minted.
   * @param lendingPool address of the targeted underlying lending pool
   * @param onBehalfOf address of the user who will receive the aTokens representing the deposit
   * @param referralCode integrators are assigned a referral code and can potentially receive rewards.
   **/
  function depositETH(
    address lendingPool,
    address onBehalfOf,
    uint16 referralCode
  ) public payable override {
    ILendingPool pool = ILendingPool(lendingPool);

    require(
      _isInRoleAndValidPermissionAdmin(onBehalfOf, DataTypes.Roles.DEPOSITOR, pool),
      Errors.PLP_USER_UNAUTHORIZED
    );

    super.depositETH(lendingPool, onBehalfOf, referralCode);
  }

  /**
   * @dev repays a borrow on the WETH reserve, for the specified amount (or for the whole amount, if uint256(-1) is specified).
   * @param lendingPool address of the targeted underlying lending pool
   * @param amount the amount to repay, or uint256(-1) if the user wants to repay everything
   * @param rateMode the rate mode to repay
   * @param onBehalfOf the address for which msg.sender is repaying
   */
  function repayETH(
    address lendingPool,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) public payable override {
    ILendingPool pool = ILendingPool(lendingPool);

    require(_isInRole(onBehalfOf, DataTypes.Roles.BORROWER, pool), Errors.PLP_USER_UNAUTHORIZED);
    super.repayETH(lendingPool, amount, rateMode, onBehalfOf);
  }

  function _getPermissionManager(ILendingPool pool) internal view returns (IPermissionManager) {
    ILendingPoolAddressesProvider provider =
      ILendingPoolAddressesProvider(pool.getAddressesProvider());
    return IPermissionManager(provider.getAddress(keccak256('PERMISSION_MANAGER')));
  }

  function _isInRole(
    address user,
    DataTypes.Roles role,
    ILendingPool pool
  ) internal view returns (bool) {
    IPermissionManager manager = _getPermissionManager(pool);
    return manager.isInRole(user, uint256(role));
  }

  function _isInRoleAndValidPermissionAdmin(
    address user,
    DataTypes.Roles role,
    ILendingPool pool
  ) internal view returns (bool) {
    IPermissionManager manager = _getPermissionManager(pool);
    return manager.isInRole(user, uint256(role)) && manager.isUserPermissionAdminValid(user);
  }
}
