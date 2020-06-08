pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {ILendingPoolAddressesProvider} from "../interfaces/ILendingPoolAddressesProvider.sol";
import {LendingPoolCore} from "../lendingpool/LendingPool.sol";
import {AToken} from "../tokenization/AToken.sol";

contract AaveProtocolTestHelpers {
    struct ATokenData {
        string symbol;
        address aTokenAddress;
    }

    ILendingPoolAddressesProvider public immutable ADDRESSES_PROVIDER;

    constructor(ILendingPoolAddressesProvider addressesProvider) public {
        ADDRESSES_PROVIDER = addressesProvider;
    }

    function getAllATokens() external view returns(ATokenData[] memory) {
        LendingPoolCore core = LendingPoolCore(ADDRESSES_PROVIDER.getLendingPoolCore());
        address[] memory reserves = core.getReserves();
        ATokenData[] memory aTokens = new ATokenData[](reserves.length);
        for (uint256 i = 0; i < reserves.length; i++) {
            address aTokenAddress = core.getReserveATokenAddress(reserves[i]);
            aTokens[i] = ATokenData({
                symbol: AToken(aTokenAddress).symbol(),
                aTokenAddress: aTokenAddress
            });
        }
        return aTokens;
    }
}