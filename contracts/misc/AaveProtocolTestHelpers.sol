pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {ILendingPoolAddressesProvider} from "../interfaces/ILendingPoolAddressesProvider.sol";
import {IERC20Detailed} from "../interfaces/IERC20Detailed.sol";
import {LendingPoolCore} from "../lendingpool/LendingPool.sol";
import {AToken} from "../tokenization/AToken.sol";

contract AaveProtocolTestHelpers {
    struct TokenData {
        string symbol;
        address tokenAddress;
    }

    ILendingPoolAddressesProvider public immutable ADDRESSES_PROVIDER;

    constructor(ILendingPoolAddressesProvider addressesProvider) public {
        ADDRESSES_PROVIDER = addressesProvider;
    }

    function getAllReservesTokens() external view returns(TokenData[] memory) {
        LendingPoolCore core = LendingPoolCore(ADDRESSES_PROVIDER.getLendingPoolCore());
        address[] memory reserves = core.getReserves();
        TokenData[] memory reservesTokens = new TokenData[](reserves.length);
        for (uint256 i = 0; i < reserves.length; i++) {
            reservesTokens[i] = TokenData({
                symbol: (reserves[i] == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) ? "ETH" : IERC20Detailed(reserves[i]).symbol(),
                tokenAddress: reserves[i]
            });
        }
        return reservesTokens;
    }

    function getAllATokens() external view returns(TokenData[] memory) {
        LendingPoolCore core = LendingPoolCore(ADDRESSES_PROVIDER.getLendingPoolCore());
        address[] memory reserves = core.getReserves();
        TokenData[] memory aTokens = new TokenData[](reserves.length);
        for (uint256 i = 0; i < reserves.length; i++) {
            address aTokenAddress = core.getReserveATokenAddress(reserves[i]);
            aTokens[i] = TokenData({
                symbol: AToken(aTokenAddress).symbol(),
                tokenAddress: aTokenAddress
            });
        }
        return aTokens;
    }
}