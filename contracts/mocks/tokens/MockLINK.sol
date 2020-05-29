// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;


import "./MintableERC20.sol";


contract MockLINK is MintableERC20("LINK", "ChainLink", 18) {}