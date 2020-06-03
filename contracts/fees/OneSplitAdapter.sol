// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IOneSplit.sol";
import "../interfaces/IPriceOracleGetter.sol";
import "../interfaces/IExchangeAdapter.sol";
import "../libraries/UniversalERC20.sol";
/// @title OneSplitAdapter
/// @author Aave
/// @notice Implements the logic to exchange assets through 1Split
/// The hardcoded parameters are:
/// 0x1814222fa8c8c1C1bf380e3BBFBd9De8657Da476: ONE_SPLIT. The address of the 1Split exchange
/// 0x76B47460d7F7c5222cFb6b6A75615ab10895DDe4: AAVE_PRICES_PROVIDER. Contract providing prices of the assets
///     in the Aave protocol, in token/ETH.
/// 512 : MULTI_PATH_ETH_FLAG. By using this flag on OneSplit, the swap sequence will introduce a step to ETH
///     in the middle, resulting in a sequence like FROM-to-ETH -> ETH-to-TO.
///     This is optimal for cases where the pair FROM/TO is not liquid enough in the
///     underlying exchanges used by OneSplit, reducing this way the slippage.
/// 10: SPLIT_PARTS. It defines in how many chunks the amount to swap will be splitted to then
///     divide the chunks amongst the underlying exchanges.
///     For example, using 10 as SPLIT_PARTS and having 4 underlying exchanges on 1Split,
///     the division amongst could look like [4,4,0,2].

contract OneSplitAdapter is IExchangeAdapter {
    using SafeMath for uint256;
    using UniversalERC20 for IERC20;

    event OneSplitAdapterSetup(address oneSplit, address priceOracle, uint256 splitParts);

    constructor() public {
        emit OneSplitAdapterSetup(0x1814222fa8c8c1C1bf380e3BBFBd9De8657Da476, 0x76B47460d7F7c5222cFb6b6A75615ab10895DDe4, 10);
    }

    /// @notice "Infinite" approval for all the tokens initialized
    /// @param _tokens the list of token addresses to approve
    function approveExchange(IERC20[] calldata _tokens) external override {
        for (uint256 i = 0; i < _tokens.length; i++) {
            _tokens[i].universalApprove(
                0x1814222fa8c8c1C1bf380e3BBFBd9De8657Da476,
                UintConstants.maxUintMinus1()
            );
        }
    }

    /// @notice Exchanges _amount of _from token (or ETH) to _to token (or ETH)
    /// - Uses UniversalERC20.isETH() as the reference on 1Split of ETH
    /// @param _from The asset to exchange from
    /// @param _to The asset to exchange to
    /// @param _amount The amount to exchange
    /// @param _maxSlippage Max slippage acceptable, taken into account after the goodSwap()
    function exchange(address _from, address _to, uint256 _amount, uint256 _maxSlippage) external override returns(uint256) {
        uint256 _value = IERC20(_from).isETH() ? _amount : 0;

        uint256 _fromAssetPriceInWei = IPriceOracleGetter(0x76B47460d7F7c5222cFb6b6A75615ab10895DDe4).getAssetPrice(_from);
        uint256 _toAssetPriceInWei = IPriceOracleGetter(0x76B47460d7F7c5222cFb6b6A75615ab10895DDe4).getAssetPrice(_to);
        uint256 _toBalanceBefore = IERC20(_to).balanceOf(address(this));

        IOneSplit(0x1814222fa8c8c1C1bf380e3BBFBd9De8657Da476).goodSwap{value: _value}(
            IERC20(_from),
            IERC20(_to),
            _amount,
            0,
            10,
            512
        );

        uint256 _toReceivedAmount = IERC20(_to).balanceOf(address(this)).sub(_toBalanceBefore);

        require(
            (_toAssetPriceInWei.mul(_toReceivedAmount).mul(100))
                .div(_fromAssetPriceInWei.mul(_amount)) >= (100 - _maxSlippage),
            "INVALID_SLIPPAGE"
        );

        emit Exchange(_from, _to, 0x1814222fa8c8c1C1bf380e3BBFBd9De8657Da476, _amount, _toReceivedAmount);
        return _toReceivedAmount;
    }
}
