// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;


import "./MintableERC20.sol";


contract MockUSDC is MintableERC20("USDC", "USD Coin", 6) {}