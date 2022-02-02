import { expect } from 'chai';
import { ProtocolErrors, RateMode } from '../../helpers/types';
import asserts from './asserts';
import { toWei, wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Borrowing', function () {
  it('VariableDebtStETH total supply is zero', async () => {
    asserts.eq(await setup.variableDebtStETH.totalSupply().then(toWei), '0');
  });

  it('StableDebtStETH total supply is zero', async () => {
    asserts.eq(await setup.stableDebtStETH.totalSupply().then(toWei), '0');
  });

  it('Variable borrowing disabled: must revert with correct message', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei`10 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);
    await expect(
      lenderB.lendingPool.borrow(
        lenderB.stETH.address,
        wei`1 ether`,
        RateMode.Variable,
        '0',
        lenderB.address
      )
    ).to.revertedWith(ProtocolErrors.VL_BORROWING_NOT_ENABLED);
  });

  it('Stable borrowing disabled: must revert with correct message', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei`10 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);

    await expect(
      lenderB.lendingPool.borrow(
        lenderB.stETH.address,
        wei`1 ether`,
        RateMode.Stable,
        '0',
        lenderB.address
      )
    ).to.revertedWith(ProtocolErrors.VL_BORROWING_NOT_ENABLED);
  });

  it('Variable borrowing enabled: must revert with correct message', async () => {
    const { lenderA, lenderB } = setup.lenders;
    await setup.aave.lendingPoolConfigurator.enableBorrowingOnReserve(lenderA.stETH.address, false);

    await lenderA.depositStEth(wei`10 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);

    await lenderB.depositWeth(wei`10 ether`);

    await expect(
      lenderB.lendingPool.borrow(
        lenderB.stETH.address,
        wei`1 ether`,
        RateMode.Variable,
        '0',
        lenderB.address
      )
    ).to.revertedWith('CONTRACT_NOT_ACTIVE');
  });

  it('Stable borrowing enabled: must revert with correct message', async () => {
    const { lenderA, lenderB } = setup.lenders;
    await setup.aave.lendingPoolConfigurator.enableBorrowingOnReserve(lenderA.stETH.address, true);

    await lenderA.depositStEth(wei`10 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);

    await lenderB.depositWeth(wei`10 ether`);

    await expect(
      lenderB.lendingPool.borrow(
        lenderB.stETH.address,
        wei`1 ether`,
        RateMode.Stable,
        '0',
        lenderB.address
      )
    ).to.revertedWith('CONTRACT_NOT_ACTIVE');
  });
});
