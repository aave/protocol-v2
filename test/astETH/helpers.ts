import hre from 'hardhat';
import ethers from 'ethers';
import { expect } from 'chai';
import BigNumber from 'bignumber.js';

export const ONE_RAY = '1000000000000000000000000000';

export function wei(amount: number | string | ethers.BigNumber) {
  if (hre.ethers.BigNumber.isBigNumber(amount)) {
    return amount.toString();
  }
  return hre.ethers.utils.parseEther(Number(amount).toFixed(4)).toString();
}

export function assertBalance(actual: string, expected: string, epsilon: string = '1') {
  const lowerBound = new BigNumber(expected).minus(epsilon).toString();
  const upperBound = new BigNumber(expected).plus(epsilon).toString();
  expect(actual).to.be.bignumber.gte(lowerBound).lte(upperBound);
}
