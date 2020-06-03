// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IFlashLoanReceiver.sol";
import "../../interfaces/ILendingPoolAddressesProvider.sol";
import "../../libraries/UniversalERC20.sol";

abstract contract FlashLoanReceiverBase is IFlashLoanReceiver {

    using UniversalERC20 for IERC20;
    using SafeMath for uint256;

    ILendingPoolAddressesProvider public addressesProvider;

    constructor(ILendingPoolAddressesProvider _provider) public {
        addressesProvider = _provider;
    }

    receive() external payable {}

    function transferFundsBackToPoolInternal(address _reserve, uint256 _amount) internal {
        IERC20(_reserve).universalTransfer(
            addressesProvider.getLendingPoolCore(), // lending-pool core address
            _amount
        );
    }
}
