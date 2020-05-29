// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

library UintConstants {
    /**
    * @dev returns max uint256
    * @return max uint256
     */
    function maxUint() internal pure returns(uint256) {
        return uint256(-1);
    }

    /**
    * @dev returns max uint256-1
    * @return max uint256-1
     */
    function maxUintMinus1() internal pure returns(uint256) {
        return uint256(-1) - 1;
    }
}