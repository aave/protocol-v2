pragma solidity 0.7.6;

import {UFragments} from "uFragments/contracts/UFragments.sol";

contract MockAmplERC20 is UFragments {

  constructor() public UFragments() {
    initialize(tx.origin);
  }

}
