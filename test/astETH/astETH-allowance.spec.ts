import asserts from './asserts';
import { wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Allowance:', function () {
  it('allowance', async () => {
    const { lenderA, lenderB } = setup.lenders;

    const allowanceBefore = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceBefore.toString(), wei(0));

    await lenderA.astETH.approve(lenderB.address, wei(10));
    const allowanceAfter = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceAfter.toString(), wei(10));
  });
  it('decreaseAllowance', async () => {
    const { lenderA, lenderB } = setup.lenders;

    const allowanceBefore = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceBefore.toString(), wei(0));

    await lenderA.astETH.approve(lenderB.address, wei(10));
    const allowanceAfter = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceAfter.toString(), wei(10));

    await lenderA.astETH.decreaseAllowance(lenderB.address, wei(5));
    const allowanceAfterDecrease = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceAfterDecrease.toString(), wei(5));
  });

  it('increaseAllowance', async () => {
    const { lenderA, lenderB } = setup.lenders;

    const allowanceBefore = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceBefore.toString(), wei(0));

    await lenderA.astETH.approve(lenderB.address, wei(10));
    const allowanceAfter = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceAfter.toString(), wei(10));

    await lenderA.astETH.increaseAllowance(lenderB.address, wei(5));
    const allowanceAfterDecrease = await lenderA.astETH.allowance(lenderA.address, lenderB.address);
    asserts.eq(allowanceAfterDecrease.toString(), wei(15));
  });
});
