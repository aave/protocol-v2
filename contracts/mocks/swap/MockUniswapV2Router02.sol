// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {IUniswapV2Router02} from "../../interfaces/IUniswapV2Router02.sol";
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {MintableERC20} from '../tokens/MintableERC20.sol';

contract MockUniswapV2Router02 is IUniswapV2Router02 {
  uint256 internal _amountToReturn;
  uint256 internal _amountToSwap;

  function setAmountToReturn(uint256 amount) public {
    _amountToReturn = amount;
  }

  function setAmountToSwap(uint256 amount) public {
    _amountToSwap = amount;
  }

  function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 /* amountOutMin */,
    address[] calldata path,
    address to,
    uint256 /* deadline */
  ) external override returns (uint256[] memory amounts) {
    IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);

    MintableERC20(path[1]).mint(_amountToReturn);
    IERC20(path[1]).transfer(to, _amountToReturn);

    amounts = new uint[](path.length);
    amounts[0] = amountIn;
    amounts[1] = _amountToReturn;
  }

  function swapTokensForExactTokens(
    uint amountOut,
    uint amountInMax,
    address[] calldata path,
    address to,
    uint /* deadline */
  ) external override returns (uint256[] memory amounts) {
    IERC20(path[0]).transferFrom(msg.sender, address(this), _amountToSwap);

    MintableERC20(path[1]).mint(_amountToReturn);
    IERC20(path[1]).transfer(to, _amountToReturn);

    amounts = new uint[](path.length);
    amounts[0] = _amountToSwap;
    amounts[1] = _amountToReturn;
  }
}
