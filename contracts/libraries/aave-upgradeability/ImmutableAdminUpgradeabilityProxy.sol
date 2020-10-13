// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import './BaseImmutableAdminUpgradeabilityProxy.sol';
import '../openzeppelin-upgradeability/UpgradeabilityProxy.sol';

/**
 * @title AdminUpgradeabilityProxy
 * @dev Extends from BaseAdminUpgradeabilityProxy with a constructor for
 * initializing the implementation, admin, and init data.
 */
contract ImmutableAdminUpgradeabilityProxy is BaseImmutableAdminUpgradeabilityProxy, UpgradeabilityProxy {
  /**
   * Contract constructor.
   * @param _logic address of the initial implementation.
   * @param _admin Address of the proxy administrator.
   * @param _data Data to send as msg.data to the implementation to initialize the proxied contract.
   * It should include the signature and the parameters of the function to be called, as described in
   * https://solidity.readthedocs.io/en/v0.4.24/abi-spec.html#function-selector-and-argument-encoding.
   * This parameter is optional, if no data is given the initialization call to proxied contract will be skipped.
   */
  constructor(
    address _logic,
    address _admin,
    bytes memory _data
  ) public payable UpgradeabilityProxy(_logic, _data) BaseImmutableAdminUpgradeabilityProxy(_admin) {
  }

  /**
   * @dev Only fall back when the sender is not the admin.
   */
  function _willFallback() internal override(BaseImmutableAdminUpgradeabilityProxy, Proxy) {
    BaseImmutableAdminUpgradeabilityProxy._willFallback();
  }
}
