pragma solidity 0.7.6;

import {UFragments} from "uFragments/contracts/UFragments.sol";

contract MintableAmplERC20 is UFragments {

  constructor() public UFragments() {
    initialize(tx.origin);
  }

}
