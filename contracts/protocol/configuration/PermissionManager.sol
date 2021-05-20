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

  ///@inheritdoc IPermissionManager

  function addPermissionAdmins(address[] calldata users) external override onlyOwner {
    for (uint256 i = 0; i < users.length; i++) {
      _permissionsAdmins[users[i]] = 1;

      emit PermissionsAdminSet(users[i], true);
    }
  }

  ///@inheritdoc IPermissionManager

  function removePermissionAdmins(address[] calldata users) external override onlyOwner {
    for (uint256 i = 0; i < users.length; i++) {
      _permissionsAdmins[users[i]] = 0;

      emit PermissionsAdminSet(users[i], false);
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

      require(role < MAX_NUM_OF_ROLES, 'INVALID_ROLE');

      uint256 permissions = _permissions[users[i]];
      _permissions[users[i]] = permissions | (1 << role);

      emit RoleSet(users[i], roles[i], true);
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

      require(role < MAX_NUM_OF_ROLES, 'INVALID_ROLE');

      uint256 permissions = _permissions[users[i]];
      _permissions[users[i]] = permissions & ~(1 << role);
      emit RoleSet(users[i], roles[i], false);
    }
  }

  ///@inheritdoc IPermissionManager

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

  ///@inheritdoc IPermissionManager
  function isInRole(address account, uint256 role) external view override returns (bool) {
    return (_permissions[account] >> role) & 1 > 0;
  }

  ///@inheritdoc IPermissionManager
  function isInAllRoles(address account, uint256[] calldata roles) external view override returns (bool) {
  
    for(uint256 i=0; i<roles.length; i++){
      if((_permissions[account] >> roles[i]) & 1 == 0){
        return false;
      }    
    }
    return true;
  }

  ///@inheritdoc IPermissionManager
  function isInAnyRole(address account, uint256[] calldata roles) external view override returns (bool) {
  
    for(uint256 i=0; i<roles.length; i++){
      if((_permissions[account] >> roles[i]) & 1 > 0){
        return true;
      }
    }
    return false;
  }

  ///@inheritdoc IPermissionManager
  function isPermissionsAdmin(address account) public view override returns (bool) {
    return _permissionsAdmins[account] > 0;
  }
}
