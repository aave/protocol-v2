// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../flashloan/base/FlashLoanReceiverBase.sol";
import "../tokens/MintableERC20.sol";
import "../../libraries/UniversalERC20.sol";

contract MockFlashLoanReceiver is FlashLoanReceiverBase {

    using SafeMath for uint256;
    using UniversalERC20 for IERC20;

    event ExecutedWithFail(address _reserve, uint256 _amount, uint256 _fee);
    event ExecutedWithSuccess(address _reserve, uint256 _amount, uint256 _fee);


    bool failExecution = false;

    constructor(ILendingPoolAddressesProvider _provider) FlashLoanReceiverBase(_provider)  public {
    }

    function setFailExecutionTransfer(bool _fail) public {
        failExecution = _fail;
    }

    function executeOperation(
        address _reserve,
        uint256 _amount,
        uint256 _fee,
        bytes memory _params) public override {
        //mint to this contract the specific amount
        MintableERC20 token = MintableERC20(_reserve);


        //check the contract has the specified balance
        require(
            _amount <= IERC20(_reserve).universalBalanceOf(address(this)),
            "Invalid balance for the contract"
        );

        if(failExecution) {
            emit ExecutedWithFail(_reserve, _amount, _fee);
            return;
        }

        //execution does not fail - mint tokens and return them to the _destination
        //note: if the reserve is eth, the mock contract must receive at least _fee ETH before calling executeOperation

        if(!IERC20(_reserve).isETH()) {
            token.mint(_fee);
        }
        //returning amount + fee to the destination
        transferFundsBackToPoolInternal(_reserve, _amount.add(_fee));
        emit ExecutedWithSuccess(_reserve, _amount, _fee);
    }
}
