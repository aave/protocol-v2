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

  constructor(ILendingPoolAddressesProvider _provider) public {
    addressesProvider = _provider;
  }

  receive() external payable {}

  function _transferFundsBack(
    address _reserve,
    address _destination,
    uint256 _amount
  ) internal {
    _transfer(_destination, _reserve, _amount);
  }

  function _transfer(
    address _destination,
    address _reserve,
    uint256 _amount
  ) internal {
    IERC20(_reserve).safeTransfer(_destination, _amount);
  }
}
