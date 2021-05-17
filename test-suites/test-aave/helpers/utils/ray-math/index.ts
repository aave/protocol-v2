import BigNumber from 'bignumber.js';
import { BigNumberValue, valueToZDBigNumber } from './bignumber';

export function getLinearCumulatedRewards(
  emissionPerSecond: BigNumberValue,
  lastUpdateTimestamp: BigNumberValue,
  currentTimestamp: BigNumberValue
): BigNumber {
  const timeDelta = valueToZDBigNumber(currentTimestamp).minus(lastUpdateTimestamp.toString());
  return timeDelta.multipliedBy(emissionPerSecond.toString());
}

export function getNormalizedDistribution(
  balance: BigNumberValue,
  oldIndex: BigNumberValue,
  emissionPerSecond: BigNumberValue,
  lastUpdateTimestamp: BigNumberValue,
  currentTimestamp: BigNumberValue,
  emissionEndTimestamp: BigNumberValue,
  precision: number = 18
): BigNumber {
  if (
    balance.toString() === '0' ||
    valueToZDBigNumber(lastUpdateTimestamp).gte(emissionEndTimestamp.toString())
  ) {
    return valueToZDBigNumber(oldIndex);
  }
  const linearReward = getLinearCumulatedRewards(
    emissionPerSecond,
    lastUpdateTimestamp,
    valueToZDBigNumber(currentTimestamp).gte(emissionEndTimestamp.toString())
      ? emissionEndTimestamp
      : currentTimestamp
  );

  return linearReward
    .multipliedBy(valueToZDBigNumber(10).exponentiatedBy(precision))
    .div(balance.toString())
    .plus(oldIndex.toString());
}
