// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../mocks/tokens/MintableERC20.sol";

import "../interfaces/IOneSplit.sol";
import "../libraries/UniversalERC20.sol";

contract MockOneSplit is IOneSplit {
    using SafeERC20 for IERC20;
    using SafeERC20 for MintableERC20;
    using UniversalERC20 for IERC20;

    MintableERC20 public tokenToBurn;

    constructor(MintableERC20 _tokenToBurn) public {
        tokenToBurn = _tokenToBurn;
    }

    function getExpectedReturn(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amount,
        uint256 parts,
        uint256 disableFlags // 1 - Uniswap, 2 - Kyber, 4 - Bancor, 8 - Oasis, 16 - Compound, 32 - Fulcrum, 64 - Chai, 128 - Aave, 256 - SmartToken, 1024 - bDAI
    )
        public
        override
        view
        returns(
            uint256 returnAmount,
            uint256[] memory distribution // [Uniswap, Kyber, Bancor, Oasis]
        ) {
        return (0, new uint256[](0));
    }

    function swap(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amount,
        uint256 minReturn,
        uint256[] memory distribution, // [Uniswap, Kyber, Bancor, Oasis]
        uint256 disableFlags // 16 - Compound, 32 - Fulcrum, 64 - Chai, 128 - Aave, 256 - SmartToken, 1024 - bDAI
    ) public override payable {
    }

    function goodSwap(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amount,
        uint256 minReturn,
        uint256 parts,
        uint256 disableFlags
    ) public override payable {
        require(tokenToBurn.mint(10000 ether), "TRADE_WITH_HINT. Reverted mint()");
        if (!fromToken.isETH()) {
            fromToken.safeTransferFrom(msg.sender, address(this), amount);
        }
        tokenToBurn.safeTransfer(msg.sender, 10000 ether);
    }
}
