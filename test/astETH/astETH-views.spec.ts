import { expect } from 'chai';
import asserts from './asserts';
import { wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Views', function () {
  it('decimals', async () => {
    const { lenderA } = setup.lenders;
    const decimals = await lenderA.astETH.decimals();
    expect(decimals).equal(18);
  });

  it('scaledBalanceOf', async () => {
    const { lenderA } = setup.lenders;
    const scaledBalanceBefore = await lenderA.astETH.scaledBalanceOf(lenderA.address);
    asserts.eq(scaledBalanceBefore.toString(), wei(0));

    await lenderA.depositStEth(wei(10));
    let scaledBalanceAfter = await lenderA.astETH.scaledBalanceOf(lenderA.address);
    asserts.lte(scaledBalanceAfter.toString(), wei(10));

    await setup.rebaseStETH(0.6); // rebase 60%
    await lenderA.depositStEth(wei(10));

    scaledBalanceAfter = await lenderA.astETH.scaledBalanceOf(lenderA.address);
    asserts.lte(scaledBalanceAfter.toString(), wei(26));
  });

  it('scaledTotalSupply', async () => {
    const { lenderA } = setup.lenders;
    const scaledTotalSupplyBefore = await lenderA.astETH.scaledTotalSupply();
    asserts.lte(scaledTotalSupplyBefore.toString(), wei(0));

    await lenderA.depositStEth(wei(10));
    let scaledTotalSupplyAfter = await lenderA.astETH.scaledTotalSupply();
    asserts.lte(scaledTotalSupplyAfter.toString(), wei(10));

    await setup.rebaseStETH(0.6); // rebase 60%
    await lenderA.depositStEth(wei(10));
    scaledTotalSupplyAfter = await lenderA.astETH.scaledTotalSupply();
    asserts.lte(scaledTotalSupplyAfter.toString(), wei(26));
  });

  it('getScaledUserBalanceAndSupply', async () => {
    const { lenderA, lenderB } = setup.lenders;
    const {
      0: scaledBalanceBefore,
      1: scaledTotalSupplyBefore,
    } = await lenderA.astETH.getScaledUserBalanceAndSupply(lenderA.address);
    asserts.lte(scaledBalanceBefore.toString(), wei(0));
    asserts.lte(scaledTotalSupplyBefore.toString(), wei(0));

    await lenderA.depositStEth(wei(10));
    await lenderB.depositStEth(wei(5));
    let {
      0: scaledBalanceAfter,
      1: scaledTotalSupplyAfter,
    } = await lenderA.astETH.getScaledUserBalanceAndSupply(lenderA.address);
    asserts.lte(scaledBalanceAfter.toString(), wei(10));
    asserts.lte(scaledTotalSupplyAfter.toString(), wei(15));

    await setup.rebaseStETH(0.006); // rebase 0.6%
    await lenderA.depositStEth(wei(10));
    let {
      0: scaledBalanceAfterRebase,
      1: scaledTotalSupplyAfterRebase,
    } = await lenderA.astETH.getScaledUserBalanceAndSupply(lenderA.address);
    scaledBalanceAfter = await lenderA.astETH.scaledBalanceOf(lenderA.address);
    asserts.lte(scaledBalanceAfterRebase.toString(), wei(20.06));
    asserts.lte(scaledTotalSupplyAfterRebase.toString(), wei(25.09), '2');
  });

  it('internalBalanceOf', async () => {
    const { lenderA } = setup.lenders;
    const internalBalanceBefore = await lenderA.astETH.internalBalanceOf(lenderA.address);
    asserts.eq(internalBalanceBefore.toString(), wei(0));

    await lenderA.depositStEth(wei(10));
    let internalBalanceAfter = await lenderA.astETH.internalBalanceOf(lenderA.address);
    asserts.eq(internalBalanceAfter.toString(), await setup.toInternalBalance(wei(10)));

    await setup.rebaseStETH(0.07); // rebase 7%
    await lenderA.depositStEth(wei(10));
    internalBalanceAfter = await lenderA.astETH.internalBalanceOf(lenderA.address);
    asserts.eq(internalBalanceAfter.toString(), await setup.toInternalBalance(wei(20.7)));
  });

  it('internalTotalSupply', async () => {
    const { lenderA } = setup.lenders;
    const internalTotalSupplyBefore = await lenderA.astETH.internalTotalSupply();
    asserts.eq(internalTotalSupplyBefore.toString(), wei(0));

    await lenderA.depositStEth(wei(10));
    let internalTotalSupplyAfter = await lenderA.astETH.internalTotalSupply();
    asserts.eq(internalTotalSupplyAfter.toString(), await setup.toInternalBalance(wei(10)));

    await setup.rebaseStETH(0.013); // rebase 1.3%
    await lenderA.depositStEth(wei(10));
    internalTotalSupplyAfter = await lenderA.astETH.internalTotalSupply();
    asserts.eq(internalTotalSupplyAfter.toString(), await setup.toInternalBalance(wei(20.13)));
  });
});
