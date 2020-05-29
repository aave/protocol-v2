// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;


import "./MintableERC20.sol";


contract MockBUSD is MintableERC20("BUSD", "Binance USD", 18) {}