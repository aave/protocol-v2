// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;


import "./MintableERC20.sol";


contract MockUSD is MintableERC20("USD", "USD", 18) {}