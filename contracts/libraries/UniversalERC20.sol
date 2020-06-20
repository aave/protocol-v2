// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

/**
 * @title UniversalERC20 library
 * @author Aave inspired by @k06a (Anton Bukov)
 * original version: https://github.com/CryptoManiacsZone/1inchProtocol/blob/master/contracts/UniversalERC20.sol
 * @dev Provides unified interface for ERC20 and native ETH operations
 **/
library UniversalERC20 {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 private constant ZERO_ADDRESS = IERC20(0x0000000000000000000000000000000000000000);
  // @notice mock address of ETH
  IERC20 private constant ETH_ADDRESS = IERC20(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

  uint256 private constant DEFAULT_TRANSFER_GAS = 50000;

  /**
   * @dev Moves amount of asset from caller to recipient
   * @param token underlying asset address
   * @param to asset recipient
   * @param amount to move
   **/
  function universalTransfer(
    IERC20 token,
    address to,
    uint256 amount
  ) internal {
    if (amount == 0) {
      return;
    }

    if (isETH(token)) {
      (bool result, ) = payable(to).call{value: amount, gas: DEFAULT_TRANSFER_GAS}('');
      require(result, 'ETH_TRANSFER_FAILED');
    } else {
      token.safeTransfer(to, amount);
    }
  }

  /**
   * @dev Moves amount of asset from sender to recipient
   * in terms of ETH it redirects amount in transaction to recipient
   * @param token underlying asset address
   * @param from asset sender
   * @param to asset recipient
   * @param amount to move
   * @param returnExcess if true returns exceeded amount to sender
   **/
  function universalTransferFrom(
    IERC20 token,
    address from,
    address to,
    uint256 amount,
    bool returnExcess
  ) internal {
    if (amount == 0) {
      return;
    }

    if (isETH(token)) {
      require(msg.value >= amount, 'Wrong usage of ETH.universalTransferFrom()'); // TODO: think one more time from == msg.sender
      if (to != address(this)) {
        (bool result, ) = payable(to).call{value: amount, gas: DEFAULT_TRANSFER_GAS}('');
        require(result, 'ETH_TRANSFER_FAILED');
      }
      if (returnExcess && msg.value > amount) {
        (bool result, ) = address(uint160(from)).call.value(msg.value.sub(amount)).gas(
          DEFAULT_TRANSFER_GAS
        )('');
        require(result, 'ETH_TRANSFER_FAILED');
      }
    } else {
      token.safeTransferFrom(from, to, amount);
    }
  }

  /**
   * @dev Moves amount of asset from caller to this contract
   * @param token underlying asset address
   * @param amount to move
   **/
  function universalTransferFromSenderToThis(
    IERC20 token,
    uint256 amount,
    bool returnExcess
  ) internal {
    if (amount == 0) {
      return;
    }

    if (isETH(token)) {
      require(msg.value >= amount, 'The amount and the value sent to deposit do not match');
      if (returnExcess) {
        // Return remainder if exist
        (bool result, ) = msg.sender.call{value: msg.value.sub(amount), gas: DEFAULT_TRANSFER_GAS}('');
        require(result, 'ETH_TRANSFER_FAILED');
      }
    } else {
      token.safeTransferFrom(msg.sender, address(this), amount);
    }
  }

  /**
   * @dev Sets the allowance over the caller's tokens to recipient address.
   * @param token underlying asset address
   * @param to allowance recipient
   * @param amount of the allowance
   **/
  function universalApprove(
    IERC20 token,
    address to,
    uint256 amount
  ) internal {
    if (!isETH(token)) {
      if (amount > 0 && token.allowance(address(this), to) > 0) {
        token.safeApprove(to, 0);
      }
      token.safeApprove(to, amount);
    }
  }

  /**
   * @dev Returns the amount of underlying asset owned by address
   * @param token underlying asset address
   * @param who address to check
   * @return balance of the who address
   **/
  function universalBalanceOf(IERC20 token, address who) internal view returns (uint256) {
    if (isETH(token)) {
      return who.balance;
    } else {
      return token.balanceOf(who);
    }
  }

  /**
   * @dev Returns decimals of underlying asset
   * @param token underlying asset address
   * @return decimals
   **/
  function universalDecimals(IERC20 token) internal view returns (uint256) {
    if (isETH(token)) {
      return 18;
    }

    (bool success, bytes memory data) = address(token).staticcall.gas(10000)(
      abi.encodeWithSignature('decimals()')
    );
    if (!success || data.length == 0) {
      (success, data) = address(token).staticcall.gas(10000)(abi.encodeWithSignature('DECIMALS()'));
    }

    return (success && data.length > 0) ? abi.decode(data, (uint256)) : 18;
  }

  /**
   * @dev Checks is underlying asset ETH or not
   * @param token underlying asset address
   * @return boolean
   **/
  function isETH(IERC20 token) internal pure returns (bool) {
    return (address(token) == address(ZERO_ADDRESS) || address(token) == address(ETH_ADDRESS));
  }
}
