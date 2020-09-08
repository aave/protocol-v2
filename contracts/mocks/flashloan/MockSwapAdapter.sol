// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {MintableERC20} from '../tokens/MintableERC20.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {ISwapAdapter} from '../../interfaces/ISwapAdapter.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract MockSwapAdapter is ISwapAdapter {

    uint256 amountToReturn;
    ILendingPoolAddressesProvider public addressesProvider;

    event Swapped(address fromAsset, address toAsset, uint256 fromAmount, uint256 receivedAmount);

    constructor(ILendingPoolAddressesProvider provider) public {
        addressesProvider = provider;
    }

    function setAmountToReturn(uint256 amount) public {
        amountToReturn = amount;
    }

    function executeOperation(
        address assetToSwapFrom,
        address assetToSwapTo,
        uint256 amountToSwap,
        address fundsDestination,
        bytes calldata params
    ) external override {
        params;
        IERC20(assetToSwapFrom).transfer(address(1), amountToSwap); // We don't want to keep funds here
        MintableERC20(assetToSwapTo).mint(amountToReturn);
        IERC20(assetToSwapTo).approve(fundsDestination, amountToReturn);
        
        emit Swapped(assetToSwapFrom, assetToSwapTo, amountToSwap, amountToReturn);
    }

    function burnAsset(IERC20 asset, uint256 amount) public {
        uint256 amountToBurn = (amount == type(uint256).max) ? asset.balanceOf(address(this)) : amount;
        asset.transfer(address(0), amountToBurn);
    }
}