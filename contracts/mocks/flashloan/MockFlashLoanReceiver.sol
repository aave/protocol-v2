// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import {FlashLoanReceiverBase} from '../../flashloan/base/FlashLoanReceiverBase.sol';
import {MintableERC20} from '../tokens/MintableERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';

contract MockFlashLoanReceiver is FlashLoanReceiverBase {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  ILendingPoolAddressesProvider internal _provider;

  event ExecutedWithFail(address _reserve, uint256 _amount, uint256 _fee);
  event ExecutedWithSuccess(address _reserve, uint256 _amount, uint256 _fee);

  bool failExecution = false;

  constructor(ILendingPoolAddressesProvider provider) public FlashLoanReceiverBase(provider) {}

  function setFailExecutionTransfer(bool _fail) public {
    failExecution = _fail;
  }

  function executeOperation(
    address reserve,
    uint256 amount,
    uint256 fee,
    bytes memory params
  ) public override {
    //mint to this contract the specific amount
    MintableERC20 token = MintableERC20(reserve);

    //check the contract has the specified balance
    require(
      amount <= IERC20(reserve).balanceOf(address(this)),
      'Invalid balance for the contract'
    );

    if (failExecution) {
      emit ExecutedWithFail(reserve, amount, fee);
      return;
    }

    //execution does not fail - mint tokens and return them to the _destination
    //note: if the reserve is eth, the mock contract must receive at least _fee ETH before calling executeOperation

    token.mint(fee);

    IERC20(reserve).approve(_addressesProvider.getLendingPool(), amount.add(fee));

    emit ExecutedWithSuccess(reserve, amount, fee);
  }
}
