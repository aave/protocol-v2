// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import "../../configuration/LendingPoolAddressesProvider.sol";
import "../../lendingpool/LendingPoolCore.sol";

/*************************************************************************************
* @title MockLendingPoolCore contract
* @author Aave
* @notice This is a mock contract to test upgradeability of the AddressProvider
 *************************************************************************************/

contract MockLendingPoolCore is LendingPoolCore {

    event ReserveUpdatedFromMock(uint256 indexed revision);

    uint256 constant private CORE_REVISION = 0x8;

    function getRevision() internal override pure returns(uint256) {
        return CORE_REVISION;
    }

    function initialize(LendingPoolAddressesProvider _addressesProvider) public override initializer {
        addressesProvider = _addressesProvider;
        refreshConfigInternal();
    }

    function updateReserveInterestRatesAndTimestampInternal(address _reserve, uint256 _liquidityAdded, uint256 _liquidityTaken)
        internal override
    {
        super.updateReserveInterestRatesAndTimestampInternal(_reserve, _liquidityAdded, _liquidityTaken);

        emit ReserveUpdatedFromMock(getRevision());

    }
}
