import asserts from './asserts';
import { wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Allowance:', function () {
  it('allowance', async () => {
    const { lenderA, lenderB } = setup.lenders;

    const allowanceBefore = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceBefore.toString(), wei`0`);

    await lenderA.astETH.approve(lenderB.address, wei`10 ether`);
    const allowanceAfter = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceAfter.toString(), wei`10 ether`);
  });
  it('decreaseAllowance', async () => {
    const { lenderA, lenderB } = setup.lenders;

    const allowanceBefore = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceBefore.toString(), wei`0`);

    await lenderA.astETH.approve(lenderB.address, wei`10 ether`);
    const allowanceAfter = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceAfter.toString(), wei`10 ether`);

    await lenderA.astETH.decreaseAllowance(lenderB.address, wei`5 ether`);
    const allowanceAfterDecrease = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceAfterDecrease.toString(), wei`5 ether`);
  });

  it('increaseAllowance', async () => {
    const { lenderA, lenderB } = setup.lenders;

    const allowanceBefore = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceBefore.toString(), wei`0`);

    await lenderA.astETH.approve(lenderB.address, wei`10 ether`);
    const allowanceAfter = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceAfter.toString(), wei`10 ether`);

    await lenderA.astETH.increaseAllowance(lenderB.address, wei`5 ether`);
    const allowanceAfterDecrease = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceAfterDecrease.toString(), wei`15 ether`);
  });
});
