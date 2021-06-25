pragma solidity 0.6.12;

import {IPermissionManager} from '../../interfaces/IPermissionManager.sol';
import {Ownable} from '../../dependencies/openzeppelin/contracts/Ownable.sol';

/**
 * @title PermissionManager contract
 * @notice Implements basic whitelisting functions for different actors of the permissioned protocol

 * @author Aave
 **/
contract PermissionManager is IPermissionManager, Ownable {
  struct UserData {
    uint256 permissions;
    address permissionAdmin;
  }

  mapping(address => UserData) _users;
  mapping(address => uint256) _permissionsAdmins;

  uint256 public constant MAX_NUM_OF_ROLES = 256;

  modifier onlyPermissionAdmins(address user) {
    require(_permissionsAdmins[user] > 0, 'CALLER_NOT_PERMISSIONS_ADMIN');
    _;
  }

  ///@inheritdoc IPermissionManager
  function addPermissionAdmins(address[] calldata admins) external override onlyOwner {
    for (uint256 i = 0; i < admins.length; i++) {
      _permissionsAdmins[admins[i]] = 1;

      emit PermissionsAdminSet(admins[i], true);
    }
  }

  ///@inheritdoc IPermissionManager
  function removePermissionAdmins(address[] calldata admins) external override onlyOwner {
    for (uint256 i = 0; i < admins.length; i++) {
      _permissionsAdmins[admins[i]] = 0;

      emit PermissionsAdminSet(admins[i], false);
    }
  }

  ///@inheritdoc IPermissionManager
  function addPermissions(uint256[] calldata roles, address[] calldata users)
    external
    override
    onlyPermissionAdmins(msg.sender)
  {
    require(roles.length == users.length, 'INCONSISTENT_ARRAYS_LENGTH');

    for (uint256 i = 0; i < users.length; i++) {
      uint256 role = roles[i];
      address user = users[i];

      require(role < MAX_NUM_OF_ROLES, 'INVALID_ROLE');

      uint256 permissions = _users[user].permissions;
      address permissionAdmin = _users[user].permissionAdmin;

      require(
        (permissions != 0 && permissionAdmin == msg.sender) ||
          _users[user].permissionAdmin == address(0),
        'INVALID_PERMISSIONADMIN'
      );

      if (permissions == 0) {
        _users[user].permissionAdmin = msg.sender;
      }

      _users[user].permissions = permissions | (1 << role);

      emit RoleSet(user, role, msg.sender, true);
    }
  }

  ///@inheritdoc IPermissionManager
  function removePermissions(uint256[] calldata roles, address[] calldata users)
    external
    override
    onlyPermissionAdmins(msg.sender)
  {
    require(roles.length == users.length, 'INCONSISTENT_ARRAYS_LENGTH');

    for (uint256 i = 0; i < users.length; i++) {
      uint256 role = roles[i];
      address user = users[i];

      require(role < MAX_NUM_OF_ROLES, 'INVALID_ROLE');

      uint256 permissions = _users[user].permissions;
      address permissionAdmin = _users[user].permissionAdmin;

      require(
        (permissions != 0 && permissionAdmin == msg.sender) ||
          _users[user].permissionAdmin == address(0),
        'INVALID_PERMISSIONADMIN'
      );

      _users[user].permissions = permissions & ~(1 << role);

      if (_users[user].permissions == 0) {
        //all permission have been removed
        _users[user].permissionAdmin = address(0);
      }

      emit RoleSet(user, role, msg.sender, false);
    }
  }

  ///@inheritdoc IPermissionManager
  function getUserPermissions(address user)
    external
    view
    override
    returns (uint256[] memory, uint256)
  {
    uint256[] memory roles = new uint256[](256);
    uint256 rolesCount = 0;
    uint256 userPermissions = _users[user].permissions;

    for (uint256 i = 0; i < 256; i++) {
      if ((userPermissions >> i) & 1 > 0) {
        roles[rolesCount] = i;
        rolesCount++;
      }
    }

    return (roles, rolesCount);
  }

  ///@inheritdoc IPermissionManager
  function isInRole(address user, uint256 role) external view override returns (bool) {
    return (_users[user].permissions >> role) & 1 > 0;
  }

  ///@inheritdoc IPermissionManager
  function isInAllRoles(address user, uint256[] calldata roles)
    external
    view
    override
    returns (bool)
  {
    for (uint256 i = 0; i < roles.length; i++) {
      if ((_users[user].permissions >> roles[i]) & 1 == 0) {
        return false;
      }
    }
    return true;
  }

  ///@inheritdoc IPermissionManager
  function isInAnyRole(address user, uint256[] calldata roles)
    external
    view
    override
    returns (bool)
  {
    for (uint256 i = 0; i < roles.length; i++) {
      if ((_users[user].permissions >> roles[i]) & 1 > 0) {
        return true;
      }
    }
    return false;
  }

  ///@inheritdoc IPermissionManager
  function isPermissionsAdmin(address admin) public view override returns (bool) {
    return _permissionsAdmins[admin] > 0;
  }

  ///@inheritdoc IPermissionManager
  function getUserPermissionAdmin(address user) external view override returns (address) {
    return _users[user].permissionAdmin;
  }

  ///@inheritdoc IPermissionManager
  function isUserPermissionAdminValid(address user) external view override returns (bool) {
    return _permissionsAdmins[_users[user].permissionAdmin] > 0;
  }
}
