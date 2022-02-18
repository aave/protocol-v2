import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import { toWei } from './helpers';
import { AstEthSetup, Lender } from './init';

export function lt(actual: string, expected: string, message?: string) {
  expect(actual).to.be.bignumber.lt(expected, message);
}

export function gt(actual: string, expected: string, message?: string) {
  expect(actual).to.be.bignumber.gt(expected, message);
}

export function eq(actual: string, expected: string, message?: string) {
  expect(actual).is.equal(expected, message);
}

export function almostEq(actual: string, expected: string, epsilon: string = '1') {
  const lowerBound = new BigNumber(expected).minus(epsilon).toString();
  const upperBound = new BigNumber(expected).plus(epsilon).toString();
  expect(actual).to.be.bignumber.lte(upperBound);
  expect(actual).to.be.bignumber.gte(lowerBound);
}

export function lte(actual: string, expected: string, epsilon: string = '1') {
  const lowerBound = new BigNumber(expected).minus(epsilon).toString();
  expect(actual).to.be.bignumber.lte(expected);
  expect(actual).to.be.bignumber.gte(lowerBound);
}

export function gte(actual: string, expected: string, epsilon: string = '1') {
  const upperBound = new BigNumber(expected).plus(epsilon).toString();
  expect(actual).to.be.bignumber.gte(expected);
  expect(actual).to.be.bignumber.lte(upperBound);
}

export async function astEthBalance(
  lender: Lender,
  expectedBalance: string,
  epsilon: string = '1'
) {
  const [balance, internalBalance, liquidityIndex] = await Promise.all([
    lender.astEthBalance(),
    lender.astEthInternalBalance(),
    lender.lendingPool.getReserveNormalizedIncome(lender.stETH.address).then(toWei),
  ]);
  lte(balance, expectedBalance, epsilon);
  // to validate that amount of shares is correct
  // we convert internal balance to stETH shares and assert with astETH balance
  const fromInternalBalance = await lender.stETH.getPooledEthByShares(internalBalance).then(toWei);
  eq(
    new BigNumber(fromInternalBalance).rayMul(new BigNumber(liquidityIndex)).toFixed(0),
    balance,
    `Unexpected astETH.internalBalanceOf() value`
  );
}

export async function astEthTotalSupply(
  setup: AstEthSetup,
  expectedValue: string,
  epsilon: string = '1'
) {
  const [totalSupply, internalTotalSupply, stEthBalance, liquidityIndex] = await Promise.all([
    setup.astEthTotalSupply(),
    setup.astETH.internalTotalSupply().then(toWei),
    setup.stETH.balanceOf(setup.astETH.address).then(toWei),
    setup.aave.lendingPool.getReserveNormalizedIncome(setup.stETH.address).then(toWei),
  ]);

  lte(totalSupply, expectedValue, epsilon);
  // to validate that internal number of shares is correct
  // internal total supply converts to stETH and assert it with astETH total supply
  const fromInternalTotalSupply = await setup.stETH
    .getPooledEthByShares(internalTotalSupply)
    .then(toWei);
  eq(
    new BigNumber(fromInternalTotalSupply).rayMul(new BigNumber(liquidityIndex)).toFixed(0),
    totalSupply,
    `Unexpected astETH.internalTotalSupply()`
  );
  eq(
    totalSupply,
    stEthBalance,
    `astETH.totalSupply() is ${totalSupply}, but stETH.balanceOf(astETH) is ${stEthBalance}`
  );
}

export default { lt, lte, eq, almostEq, gt, gte, astEthBalance, astEthTotalSupply };
