// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IParaSwapAugustusRegistry} from '../../interfaces/IParaSwapAugustusRegistry.sol';

contract MockParaSwapAugustusRegistry is IParaSwapAugustusRegistry {
  address immutable AUGUSTUS;

  constructor(address augustus) public {
    AUGUSTUS = augustus;
  }

  function isValidAugustus(address augustus) external view override returns (bool) {
    return augustus == AUGUSTUS;
  }
}
