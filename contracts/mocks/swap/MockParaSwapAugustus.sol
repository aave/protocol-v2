// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IParaSwapAugustus} from '../../interfaces/IParaSwapAugustus.sol';
import {MockParaSwapTokenTransferProxy} from './MockParaSwapTokenTransferProxy.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {MintableERC20} from '../tokens/MintableERC20.sol';

contract MockParaSwapAugustus is IParaSwapAugustus {
  MockParaSwapTokenTransferProxy immutable TOKEN_TRANSFER_PROXY;
  bool _expectingSwap;
  address _expectedFromToken;
  address _expectedToToken;
  uint256 _expectedFromAmountMin;
  uint256 _expectedFromAmountMax;
  uint256 _receivedAmount;

  constructor() public {
    TOKEN_TRANSFER_PROXY = new MockParaSwapTokenTransferProxy();
  }

  function getTokenTransferProxy() external view override returns (address) {
    return address(TOKEN_TRANSFER_PROXY);
  }

  function expectSwap(
    address fromToken,
    address toToken,
    uint256 fromAmountMin,
    uint256 fromAmountMax,
    uint256 receivedAmount
  ) external {
    _expectingSwap = true;
    _expectedFromToken = fromToken;
    _expectedToToken = toToken;
    _expectedFromAmountMin = fromAmountMin;
    _expectedFromAmountMax = fromAmountMax;
    _receivedAmount = receivedAmount;
  }

  function swap(
    address fromToken,
    address toToken,
    uint256 fromAmount,
    uint256 toAmount
  ) external returns (uint256) {
    require(_expectingSwap, 'Not expecting swap');
    require(fromToken == _expectedFromToken, 'Unexpected from token');
    require(toToken == _expectedToToken, 'Unexpected to token');
    require(fromAmount >= _expectedFromAmountMin && fromAmount <= _expectedFromAmountMax, 'From amount out of range');
    require(_receivedAmount >= toAmount, 'Received amount of tokens are less than expected');
    TOKEN_TRANSFER_PROXY.transferFrom(fromToken, msg.sender, address(this), fromAmount);
    MintableERC20(toToken).mint(_receivedAmount);
    IERC20(toToken).transfer(msg.sender, _receivedAmount);
    _expectingSwap = false;
    return _receivedAmount;
  }
}
