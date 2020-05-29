// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;


import "./MintableERC20.sol";


contract MockSUSD is MintableERC20("SUSD", "Synthetix USD", 6) {}