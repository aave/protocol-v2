import { expect } from 'chai';
import { zeroAddress } from 'ethereumjs-util';
import { ProtocolErrors } from '../../helpers/types';
import { assertBalance, ONE_RAY, wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH deposits', async () => {
  it('First deposit: should mint exact amount of AStETH', async () => {
    const { lenderA } = setup.lenders;
    const depositAmount = wei(10);
    await lenderA.depositStEth(depositAmount);

    assertBalance(await lenderA.astEthBalance(), depositAmount);
    assertBalance(await setup.astETH.totalSupply().then(wei), depositAmount);
  });

  it('Multiple deposits: should mint exact amount of AStETH ', async () => {
    const { lenderA, lenderB } = setup.lenders;

    // lenderA deposits
    const lenderADepositAmount = wei(10);
    await lenderA.depositStEth(lenderADepositAmount);

    assertBalance(await lenderA.astEthBalance(), lenderADepositAmount);
    assertBalance(await setup.astETH.totalSupply().then(wei), lenderADepositAmount);

    // lenderB deposits
    const lenderBDepositAmount = wei(5);
    await lenderB.depositStEth(lenderBDepositAmount);

    assertBalance(await lenderB.astEthBalance(), lenderBDepositAmount);
    assertBalance(await setup.astETH.totalSupply().then(wei), wei(15));

    // lenderA deposits again
    const lenderBSecondDepositAmount = wei(7);
    await lenderB.depositStEth(lenderBSecondDepositAmount);

    assertBalance(await lenderB.astEthBalance(), wei(12));
    assertBalance(await setup.astETH.totalSupply().then(wei), wei(22));
  });

  it('Zero scaled amount is zero: should revert with correct message', async () => {
    const { lenderA } = setup.lenders;
    // rebase 200%
    await setup.rebaseStETH(2);
    await expect(lenderA.depositStEth(1)).to.revertedWith(ProtocolErrors.CT_INVALID_MINT_AMOUNT);
  });

  it('Small deposit 100 wei: should mint exact amount of AStETH', async () => {
    const { lenderA } = setup.lenders;
    const depositAmount = '100';
    await lenderA.depositStEth(depositAmount);

    assertBalance(await lenderA.astEthBalance(), depositAmount);
    assertBalance(await setup.astETH.totalSupply().then(wei), depositAmount);
  });

  it('Deposit Events', async () => {
    const { lenderA } = setup.lenders;
    const depositAmount = wei(10);
    await lenderA.depositStEth(depositAmount);

    await expect(lenderA.depositStEth(depositAmount))
      .to.emit(setup.astETH, 'Transfer')
      .withArgs(zeroAddress(), lenderA.address, depositAmount)
      .emit(setup.astETH, 'Mint')
      .withArgs(lenderA.address, depositAmount, ONE_RAY);
  });
});
