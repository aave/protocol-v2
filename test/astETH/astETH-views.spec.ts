import { expect } from 'chai';
import { assertBalance, wei } from './helpers';
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
    assertBalance(scaledBalanceBefore.toString(), wei(0));
    await lenderA.depositStEth(wei(10));
    let scaledBalanceAfter = await lenderA.astETH.scaledBalanceOf(lenderA.address);
    assertBalance(scaledBalanceAfter.toString(), wei(10));
    await setup.rebaseStETH(0.6); // rebase 60%
    await lenderA.depositStEth(wei(10));
    scaledBalanceAfter = await lenderA.astETH.scaledBalanceOf(lenderA.address);
    assertBalance(scaledBalanceAfter.toString(), wei(26));
  });

  it('scaledTotalSupply', async () => {
    const { lenderA } = setup.lenders;
    const scaledTotalSupplyBefore = await lenderA.astETH.scaledTotalSupply();
    assertBalance(scaledTotalSupplyBefore.toString(), wei(0));
    await lenderA.depositStEth(wei(10));
    let scaledTotalSupplyAfter = await lenderA.astETH.scaledTotalSupply();
    assertBalance(scaledTotalSupplyAfter.toString(), wei(10));
    await setup.rebaseStETH(0.6); // rebase 60%
    await lenderA.depositStEth(wei(10));
    scaledTotalSupplyAfter = await lenderA.astETH.scaledTotalSupply();
    assertBalance(scaledTotalSupplyAfter.toString(), wei(26));
  });

  it('getScaledUserBalanceAndSupply', async () => {
    const { lenderA, lenderB } = setup.lenders;
    const {
      0: scaledBalanceBefore,
      1: scaledTotalSupplyBefore,
    } = await lenderA.astETH.getScaledUserBalanceAndSupply(lenderA.address);
    assertBalance(scaledBalanceBefore.toString(), wei(0));
    assertBalance(scaledTotalSupplyBefore.toString(), wei(0));
    await lenderA.depositStEth(wei(10));
    await lenderB.depositStEth(wei(5));

    let {
      0: scaledBalanceAfter,
      1: scaledTotalSupplyAfter,
    } = await lenderA.astETH.getScaledUserBalanceAndSupply(lenderA.address);

    assertBalance(scaledBalanceAfter.toString(), wei(10));
    assertBalance(scaledTotalSupplyAfter.toString(), wei(15));
    await setup.rebaseStETH(0.6); // rebase 60%
    await lenderA.depositStEth(wei(10));
    let {
      0: scaledBalanceAfterRebase,
      1: scaledTotalSupplyAfterRebase,
    } = await lenderA.astETH.getScaledUserBalanceAndSupply(lenderA.address);
    scaledBalanceAfter = await lenderA.astETH.scaledBalanceOf(lenderA.address);
    assertBalance(scaledBalanceAfterRebase.toString(), wei(26));
    assertBalance(scaledTotalSupplyAfterRebase.toString(), wei(34));
  });

  it('internalBalanceOf', async () => {
    const { lenderA } = setup.lenders;
    const internalBalanceBefore = await lenderA.astETH.internalBalanceOf(lenderA.address);
    assertBalance(internalBalanceBefore.toString(), wei(0));
    await lenderA.depositStEth(wei(10));
    let internalBalanceAfter = await lenderA.astETH.internalBalanceOf(lenderA.address);
    assertBalance(internalBalanceAfter.toString(), wei(10));
    await setup.rebaseStETH(0.6); // rebase 60%
    await lenderA.depositStEth(wei(10));
    internalBalanceAfter = await lenderA.astETH.internalBalanceOf(lenderA.address);
    assertBalance(internalBalanceAfter.toString(), wei(16.25));
  });

  it('internalTotalSupply', async () => {
    const { lenderA } = setup.lenders;
    const internalTotalSupplyBefore = await lenderA.astETH.internalTotalSupply();
    assertBalance(internalTotalSupplyBefore.toString(), wei(0));
    await lenderA.depositStEth(wei(10));
    let internalTotalSupplyAfter = await lenderA.astETH.internalTotalSupply();
    assertBalance(internalTotalSupplyAfter.toString(), wei(10));
    await setup.rebaseStETH(0.6); // rebase 60%
    await lenderA.depositStEth(wei(10));
    internalTotalSupplyAfter = await lenderA.astETH.internalTotalSupply();
    assertBalance(internalTotalSupplyAfter.toString(), wei(16.25));
  });
});
