// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {ILendingPool} from '../../../interfaces/ILendingPool.sol';
import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeMath} from '../../../dependencies/openzeppelin/contracts/SafeMath.sol';

contract FlashLoanReceiverMock {
  using SafeMath for uint256;

  event FlashLoanExecuted(address[] _assets, uint256[] _amounts, uint256[] _premiums);

  address public immutable LENDING_POOL;

  constructor(address lendingPool) public {
    LENDING_POOL = lendingPool;
  }

  function executeOperation(
    address[] memory assets,
    uint256[] memory amounts,
    uint256[] memory premiums,
    address initiator,
    bytes memory params
  ) public returns (bool) {
    for (uint256 i = 0; i < assets.length; i++) {
      uint256 amountToReturn = amounts[i].add(premiums[i]).add(1);
      IERC20(assets[i]).approve(LENDING_POOL, amountToReturn);
    }
    emit FlashLoanExecuted(assets, amounts, premiums);
    return true;
  }
}
