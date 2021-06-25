pragma solidity 0.6.12;

interface IPermissionManager {
  event RoleSet(address indexed user, uint256 indexed role, address indexed whiteLister, bool set);
  event PermissionsAdminSet(address indexed user, bool set);

  /**
   * @dev Allows owner to add new permission admins
   * @param admins The addresses to promote to permission admin
   **/
  function addPermissionAdmins(address[] calldata admins) external;

  /**
   * @dev Allows owner to remove permission admins
   * @param admins The addresses to demote as permission admin
   **/
  function removePermissionAdmins(address[] calldata admins) external;

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
   * @dev Returns the permissions configuration for a specific user
   * @param user The address of the user
   * @return the set of permissions states for the user
   **/
  function getUserPermissions(address user) external view returns (uint256[] memory, uint256);

  /**
   * @dev Used to query if a certain user has a certain role
   * @param user The address of the user
   * @return True if the user is in the specific role
   **/
  function isInRole(address user, uint256 role) external view returns (bool);

  /**
   * @dev Used to query if a certain user has the permissions admin role
   * @param user The address of the user
   * @return True if the user is a permissions admin, false otherwise
   **/
  function isPermissionsAdmin(address user) external view returns (bool);

  /**
   * @dev Used to query if a certain user satisfies certain roles
   * @param user The address of the user
   * @param roles The roles to check
   * @return True if the user has all the roles, false otherwise
   **/
  function isInAllRoles(address user, uint256[] calldata roles) external view returns (bool);

  /**
   * @dev Used to query if a certain user is in at least one of the roles specified
   * @param user The address of the user
   * @return True if the user has all the roles, false otherwise
   **/
  function isInAnyRole(address user, uint256[] calldata roles) external view returns (bool);

  /**
   * @dev Used to query if a certain user is in at least one of the roles specified
   * @param user The address of the user
   * @return the address of the permissionAdmin of the user
   **/
  function getUserPermissionAdmin(address user) external view returns (address);

  /**
   * @dev Used to query if the permission admin of a certain user is valid
   * @param user The address of the user
   * @return true if the permission admin of user is valid, false otherwise
   **/
  function isUserPermissionAdminValid(address user) external view returns (bool);
}
