pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

library UniversalERC20 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 private constant ZERO_ADDRESS = IERC20(
        0x0000000000000000000000000000000000000000
    );
    IERC20 private constant ETH_ADDRESS = IERC20(
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
    );

    function universalTransfer(
        IERC20 token,
        address to,
        uint256 amount
    ) internal returns (bool) {
        if (amount == 0) {
            return true;
        }

        if (isETH(token)) {
            (bool result, ) = payable(to).call{value: amount, gas: 50000}("");
            require(result, "ETH_TRANSFER_FAILED");
        } else {
            token.safeTransfer(to, amount);
        }
        return true;
    }

    function universalTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 amount,
        bool returnExcess
    ) internal {
        if (amount == 0) {
            return;
        }

        if (isETH(token)) {
            require(
                msg.value >= amount,
                "Wrong usage of ETH.universalTransferFrom()"
            ); // TODO: think one more time from == msg.sender
            if (to != address(this)) {
                (bool result, ) = payable(to).call{value: amount, gas: 50000}(
                    ""
                );
                require(result, "ETH_TRANSFER_FAILED");
            }
            if (returnExcess && msg.value > amount) {
                (bool result, ) = msg.sender.call{
                    value: msg.value.sub(amount),
                    gas: 50000
                }("");
                require(result, "ETH_TRANSFER_FAILED");
            }
        } else {
            token.safeTransferFrom(from, to, amount);
        }
    }

    function universalTransferFromSenderToThis(IERC20 token, uint256 amount)
        internal
    {
        if (amount == 0) {
            return;
        }

        if (isETH(token)) {
            if (msg.value > amount) {
                // Return remainder if exist
                (bool result, ) = msg.sender.call{
                    value: msg.value.sub(amount),
                    gas: 50000
                }("");
                require(result, "ETH_TRANSFER_FAILED");
            }
        } else {
            token.safeTransferFrom(msg.sender, address(this), amount);
        }
    }

    function universalApprove(
        IERC20 token,
        address to,
        uint256 amount
    ) internal {
        if (!isETH(token)) {
            if (amount > 0 && token.allowance(address(this), to) > 0) {
                token.safeApprove(to, 0);
            }
            token.safeApprove(to, amount);
        }
    }

    function universalBalanceOf(IERC20 token, address who)
        internal
        view
        returns (uint256)
    {
        if (isETH(token)) {
            return who.balance;
        } else {
            return token.balanceOf(who);
        }
    }

    function universalDecimals(IERC20 token) internal view returns (uint256) {
        if (isETH(token)) {
            return 18;
        }

        (bool success, bytes memory data) = address(token).staticcall{
            gas: 10000
        }(abi.encodeWithSignature("decimals()"));
        if (!success || data.length == 0) {
            (success, data) = address(token).staticcall{gas: 10000}(
                abi.encodeWithSignature("DECIMALS()")
            );
        }

        return (success && data.length > 0) ? abi.decode(data, (uint256)) : 18;
    }

    function isETH(IERC20 token) internal pure returns (bool) {
        return (address(token) == address(ZERO_ADDRESS) ||
            address(token) == address(ETH_ADDRESS));
    }
}
