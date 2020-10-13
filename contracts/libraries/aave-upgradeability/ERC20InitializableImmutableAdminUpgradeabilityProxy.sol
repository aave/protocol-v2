// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import './InitializableImmutableAdminUpgradeabilityProxy.sol';
import '../openzeppelin-upgradeability/InitializableUpgradeabilityProxy.sol';

/**
 * @title ERC20InitializableImmutableAdminUpgradeabilityProxy
 * @dev Extends from BaseAdminUpgradeabilityProxy with an initializer for
 * initializing the implementation, admin, and init data.
 * It also implement native functions to map the ERC20 calls, to further save gas
 * by directly calling the implementation.
 */
contract ERC20InitializableImmutableAdminUpgradeabilityProxy is
  InitializableImmutableAdminUpgradeabilityProxy
{
  constructor(address admin) public InitializableImmutableAdminUpgradeabilityProxy(admin) {}

  function totalSupply() external view returns (uint256) {
    abi.decode(_delegateView(abi.encodeWithSignature('totalSupply()')), (uint256));
  }

  function balanceOf(address account) external view returns (uint256) {
    abi.decode(_delegateView(abi.encodeWithSignature('balanceOf(address)', account)), (uint256));
  }

  function transfer(address recipient, uint256 amount) external returns (bool) {
    abi.decode(
      _delegateToImpl(abi.encodeWithSignature('balanceOf(address,uint256)', recipient, amount)),
      (bool)
    );
  }

  function allowance(address owner, address spender) external view returns (uint256) {
    abi.decode(
      _delegateView(abi.encodeWithSignature('allowance(address,address)', owner, spender)),
      (uint256)
    );
  }

  function approve(address spender, uint256 amount) external returns (bool) {
    abi.decode(
      _delegateToImpl(abi.encodeWithSignature('approve(address,uint256)', spender, amount)),
      (bool)
    );
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool) {
    abi.decode(
      _delegateToImpl(
        abi.encodeWithSignature('transferFrom(address,address,uint256)', sender, recipient, amount)
      ),
      (bool)
    );
  }

  /**
   * @notice Delegates execution to an implementation contract
   * @dev It returns to the external caller whatever the implementation returns or forwards reverts
   *  There are an additional 2 prefix uints from the wrapper returndata, which we ignore since we make an extra hop.
   * @param data The raw data to delegatecall
   * @return The returned bytes from the delegatecall
   */
  function _delegateView(bytes memory data) internal view returns (bytes memory) {
    (bool success, bytes memory returnData) = address(this).staticcall(
      abi.encodeWithSignature('delegateToImpl(bytes)', data)
    );
    assembly {
      if eq(success, 0) {
        revert(add(returnData, 0x20), returndatasize())
      }
    }
    return returnData;
  }

  function _delegateToImpl(bytes memory data) internal returns (bytes memory) {
    (bool success, bytes memory returnData) = _implementation().delegatecall(data);
    assembly {
      if eq(success, 0) {
        revert(add(returnData, 0x20), returndatasize())
      }
    }
    return returnData;
  }
}
