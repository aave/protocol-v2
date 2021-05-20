pragma solidity 0.6.12;

interface IPermissionManager {

  event RoleSet(address indexed user, uint256 indexed role, bool set);
  event PermissionsAdminSet(address indexed user, bool set);

  /**
   * @dev Allows owner to add new permission admins
   * @param users The addresses of the users to promote to permission admin
   **/
  function addPermissionAdmins(address[] calldata users) external;

  /**
   * @dev Allows owner to remove permission admins
   * @param users The addresses of the users to demote as permission admin
   **/
  function removePermissionAdmins(address[] calldata users) external;

  /**
   * @dev Allows owner to whitelist a set of addresses for multiple roles
   * @param roles The list of roles to assign
   * @param users The list of users to add to the corresponding role
   **/
  function addPermissions(uint256[] calldata roles, address[] calldata users) external;

  /**
   * @dev Allows owner to remove permissions on a set of addresses
   * @param roles The list of roles to remove
   * @param users The list of users to remove from the corresponding role
   **/
  function removePermissions(uint256[] calldata roles, address[] calldata users) external;

  /**
   * @dev Returns the permissions configuration for a specific account
   * @param account The address of the user
   * @return the set of permissions states for the account
   **/
  function getAccountPermissions(address account) external view returns (uint256[] memory, uint256);

  /**
   * @dev Used to query if a certain account has a certain role
   * @param account The address of the user
   * @return True if the account is in the specific role
   **/
  function isInRole(address account, uint256 role) external view returns (bool);

  /**
   * @dev Used to query if a certain account has the permissions admin role
   * @param account The address of the user
   * @return True if the account is a permissions admin, false otherwise
   **/
  function isPermissionsAdmin(address account) external view returns (bool);


   /**
   * @dev Used to query if a certain account satisfies certain roles
   * @param account The address of the user
   * @param roles The roles to check
   * @return True if the account has all the roles, false otherwise
   **/
  function isInAllRoles(address account, uint256[] calldata roles) external view returns (bool);
 
   /**
   * @dev Used to query if a certain account is in at least one of the roles specified
   * @param account The address of the user
   * @return True if the account has all the roles, false otherwise
   **/
  function isInAnyRole(address account, uint256[] calldata roles) external view returns (bool);
}
