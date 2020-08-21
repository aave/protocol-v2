// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IFlashLoanReceiver} from '../interfaces/IFlashLoanReceiver.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@nomiclabs/buidler/console.sol';

abstract contract FlashLoanReceiverBase is IFlashLoanReceiver {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  ILendingPoolAddressesProvider public addressesProvider;

  constructor(ILendingPoolAddressesProvider provider) public {
    addressesProvider = provider;
  }

  receive() external payable {}

  function transferFundsBackInternal(
    address reserve,
    address destination,
    uint256 amount
  ) internal {
    transferInternal(destination, reserve, amount);
  }

  function transferInternal(
    address destination,
    address reserve,
    uint256 amount
  ) internal {
    IERC20(reserve).safeTransfer(destination, amount);
  }
}
