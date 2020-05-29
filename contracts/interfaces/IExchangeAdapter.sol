// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../libraries/EthAddressLib.sol";
import "../libraries/UintConstants.sol";

interface IExchangeAdapter {
    using SafeERC20 for IERC20;

    event Exchange(
        address indexed from,
        address indexed to,
        address indexed platform,
        uint256 fromAmount,
        uint256 toAmount
    );

    function approveExchange(IERC20[] calldata _tokens) external;

    function exchange(address _from, address _to, uint256 _amount, uint256 _maxSlippage) external returns(uint256);
}