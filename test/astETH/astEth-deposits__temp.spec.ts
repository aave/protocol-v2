import { expect } from 'chai';
import { zeroAddress } from 'ethereumjs-util';
import { ProtocolErrors } from '../../helpers/types';
import asserts from './asserts';
import { ONE_RAY, wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH deposits', async () => {
  it('First deposit: should mint exact amount of AStETH', async () => {
    const { lenderA } = setup.lenders;
    const depositAmount = wei`10 ether`;
    await lenderA.depositStEth(depositAmount);

    await asserts.astEthBalance(lenderA, depositAmount);
    await asserts.astEthTotalSupply(setup, depositAmount);
  });

  it('Multiple deposits: should mint exact amount of AStETH ', async () => {
    const { lenderA, lenderB } = setup.lenders;

    // lenderA deposits
    await lenderA.depositStEth(wei`10 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);
    await asserts.astEthTotalSupply(setup, wei`10 ether`);

    // lenderB deposits
    await lenderB.depositStEth(wei`5 ether`);
    await asserts.astEthBalance(lenderB, wei`5 ether`);
    await asserts.astEthTotalSupply(setup, wei`15 ether`);

    // lenderB deposits again
    await lenderB.depositStEth(wei`7 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);
    await asserts.astEthBalance(lenderB, wei`12 ether`, '2');
    await asserts.astEthTotalSupply(setup, wei`22 ether`, '2');
  });

  it('Zero scaled amount is zero: should revert with correct message', async () => {
    const { lenderA } = setup.lenders;
    // rebase 200%
    await setup.rebaseStETH(2);
    await expect(lenderA.depositStEth(1)).to.revertedWith(ProtocolErrors.CT_INVALID_MINT_AMOUNT);
  });

  it('Small deposit 100 wei: should mint exact amount of AStETH', async () => {
    const { lenderA } = setup.lenders;

    await lenderA.depositStEth('100');
    await asserts.astEthBalance(lenderA, '100');
    await asserts.astEthTotalSupply(setup, '100');
  });

  it('Deposit Events', async () => {
    const { lenderA } = setup.lenders;

    const depositAmount = wei`10 ether`;
    await expect(lenderA.depositStEth(depositAmount))
      .to.emit(setup.astETH, 'Transfer')
      .withArgs(zeroAddress(), lenderA.address, depositAmount)
      .emit(setup.astETH, 'Mint')
      .withArgs(lenderA.address, depositAmount, ONE_RAY);
  });
});
