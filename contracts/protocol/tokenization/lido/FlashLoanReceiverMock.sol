// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {ILendingPool} from '../../../interfaces/ILendingPool.sol';

contract FlashLoanReceiverMock {
  event FlashLoanExecuted(address[] _assets, uint256[] _amounts, uint256[] _premiums);

  function executeOperation(
    address[] memory assets,
    uint256[] memory amounts,
    uint256[] memory premiums,
    address initiator,
    bytes memory params
  ) public returns (bool) {
    emit FlashLoanExecuted(assets, amounts, premiums);
    return true;
  }
}
