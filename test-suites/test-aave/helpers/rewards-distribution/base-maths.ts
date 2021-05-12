import { BigNumber } from 'ethers';

import {
  BigNumberValue,
  ethersValueToZDBigNumber,
  valueToZDBigNumber,
} from '../utils/ray-math/bignumber';

export function getRewards(
  balance: BigNumber,
  assetIndex: BigNumber,
  userIndex: BigNumber,
  precision: number = 18
): BigNumber {
  return BigNumber.from(
    ethersValueToZDBigNumber(balance)
      .multipliedBy(ethersValueToZDBigNumber(assetIndex).minus(ethersValueToZDBigNumber(userIndex)))
      .dividedBy(valueToZDBigNumber(10).exponentiatedBy(precision))
      .toString()
  );
}
