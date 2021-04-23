pragma solidity 0.6.12;

import {IPermissionManager} from '../../interfaces/IPermissionManager.sol';
import {Ownable} from '../../dependencies/openzeppelin/contracts/Ownable.sol';

/**
 * @title PermissionManager contract
 * @notice Implements basic whitelisting functions for different actors of the permissioned protocol

 * @author Aave
 **/
contract PermissionManager is IPermissionManager, Ownable {
  mapping(address => uint256) _permissions;
  mapping(address => uint256) _permissionsAdmins;

  uint256 public constant MAX_NUM_OF_ROLES = 256;

  modifier onlyPermissionAdmins(address user) {
    require(_permissionsAdmins[user] > 0, 'CALLER_NOT_PERMISSIONS_ADMIN');
    _;
  }

  /**
   * @dev Allows owner to add new permission admins
   * @param users The addresses of the users to promote to permission admin
   **/
  function addPermissionAdmins(address[] calldata users) external override onlyOwner {
    for (uint256 i = 0; i < users.length; i++) {
      _permissionsAdmins[users[i]] = 1;

      emit PermissionsAdminSet(users[i], true);
    }
  }

  /**
   * @dev Allows owner to remove permission admins
   * @param users The addresses of the users to demote as permission admin
   **/
  function removePermissionAdmins(address[] calldata users) external override onlyOwner {
    for (uint256 i = 0; i < users.length; i++) {
      _permissionsAdmins[users[i]] = 0;

      emit PermissionsAdminSet(users[i], false);
    }
  }

  /**
   * @dev Allows permission admins to whitelist a set of addresses for multiple roles
   * @param roles The list of roles to assign to the different users
   * @param users The addresses of the users to assign to the corresponding role
   **/
  function addPermissions(uint256[] calldata roles, address[] calldata users)
    external
    override
    onlyPermissionAdmins(msg.sender)
  {
    require(roles.length == users.length, 'INCONSISTENT_ARRAYS_LENGTH');

    for (uint256 i = 0; i < users.length; i++) {
      uint256 role = roles[i];

      require(role < MAX_NUM_OF_ROLES, 'INVALID_ROLE');

      uint256 permissions = _permissions[users[i]];
      _permissions[users[i]] = permissions | (1 << role);

      emit RoleSet(users[i], roles[i], true);
    }
  }

  /**
   * @dev Allows owner to remove permissions on a set of addresses for multiple roles
   * @param roles The list of roles
   * @param users The addresses of the users
   **/
  function removePermissions(uint256[] calldata roles, address[] calldata users)
    external
    override
    onlyPermissionAdmins(msg.sender)
  {
    require(roles.length == users.length, 'INCONSISTENT_ARRAYS_LENGTH');

    for (uint256 i = 0; i < users.length; i++) {
      uint256 role = roles[i];

      require(role < MAX_NUM_OF_ROLES, 'INVALID_ROLE');

      uint256 permissions = _permissions[users[i]];
      _permissions[users[i]] = permissions & ~(1 << role);
      emit RoleSet(users[i], roles[i], false);
    }
  }

  /**
   * @dev Returns the permissions configuration for a specific account
   * @param account The address of the user
   * @return the set of permissions states for the account
   **/
  function getAccountPermissions(address account)
    external
    view
    override
    returns (uint256[] memory, uint256)
  {
    uint256[] memory roles = new uint256[](256);
    uint256 rolesCount = 0;
    uint256 accountPermissions = _permissions[account];

    for (uint256 i = 0; i < 256; i++) {
      if ((accountPermissions >> i) & 1 > 0) {
        roles[rolesCount] = i;
        rolesCount++;
      }
    }

    return (roles, rolesCount);
  }

  /**
   * @dev Used to query if a certain account is a depositor
   * @param account The address of the user
   * @return True if the account is a depositor, false otherwise
   **/
  function isInRole(address account, uint256 role) public view override returns (bool) {
    return (_permissions[account] >> role) & 1 > 0;
  }

  /**
   * @dev Used to query if a certain account is a depositor
   * @param account The address of the user
   * @return True if the account is a depositor, false otherwise
   **/
  function isPermissionsAdmin(address account) public view override returns (bool) {
    return _permissionsAdmins[account] > 0;
  }
}
