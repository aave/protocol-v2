// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/UniversalERC20.sol";
import "../mocks/tokens/MintableERC20.sol";

/// @title MockKyberProxy
/// @author Aave
/// @notice Mock contract to simulate the behaviour of the Kyber DEX
/// - Receives ETH/tokens
/// - Mints the tokenToBurn
/// - Sends back the tokenToBurn
contract MockKyberProxy {
    using UniversalERC20 for IERC20;
    using UniversalERC20 for MintableERC20;

    /// @notice The token which the msg.sender of tradeWithHint will burn
    MintableERC20 public tokenToBurn;

    constructor(MintableERC20 _tokenToBurn) public {
        tokenToBurn = _tokenToBurn;
    }

    /// @notice Simulates the function with the same name on the Kyber Proxy contract
    function tradeWithHint(
        IERC20 _fromToken,
        uint256 _amount,
        IERC20 _toToken,
        address _receiver,
        uint256 _maxAmount,
        uint256 minConversionRate,
        address _referral,
        bytes calldata _filtering
    ) external payable returns (uint256) {
        require(tokenToBurn.mint(1 ether), "TRADE_WITH_HINT. Reverted mint()");
        if (!_fromToken.isETH()) {
            _fromToken.universalTransferFromSenderToThis(_amount, true);
        }
        tokenToBurn.universalTransfer(msg.sender, 1 ether);
        return 1 ether;
    }
}
