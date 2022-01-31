import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import asserts from './asserts';
import { ONE_RAY, wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Transfers', function () {
  it('Transfer all tokens: must update balances correctly', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei`10 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);
    await asserts.astEthTotalSupply(setup, wei`10 ether`);

    // after deposit user might receive 10 ether - 1 wei of asETH.
    // So in transfer below we retrieve actual user balance to transfer all user's tokens
    // which might be 10 ether of 10 ether - 1 wei
    await lenderA.transferAstEth(lenderB.address, await lenderA.astEthBalance());
    await asserts.astEthBalance(lenderA, '1');
    // Due to stEth shares mechanic it might be possible, that lenderA transfered
    // to lenderB not all his balance but 1 wei less. Taking into consideration
    // that after lenderA deposited 10 ether, he also might lost 1 wei, max difference
    // between expected and actual balance might be 2 wei or less.
    await asserts.astEthBalance(lenderB, wei`10 ether`, '2');
    await asserts.astEthTotalSupply(setup, wei`10 ether`);
  });

  it('Transfer part of tokens: must update balances correctly', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei`10 ether`); // 10 or 9.9..99
    await asserts.astEthBalance(lenderA, wei`10 ether`);
    await asserts.astEthTotalSupply(setup, wei`10 ether`);

    await lenderA.transferAstEth(lenderB.address, wei`5 ether`);
    // after lenderA deposit and transfer max possible amount of
    // tokens he might has is 5 ether  + 1 wei (deposit all 10 ether and transfer 5 ether - 1 wei).
    // The min possible amount of astETH is 5 ether - 2 wei (deposit 10 ether - 1 wei and transfer 5 ether - 1 wei)
    await asserts.astEthBalance(lenderA, new BigNumber(wei`5 ether`).plus(1).toFixed(0), '2');
    await asserts.astEthBalance(lenderB, wei`5 ether`);
    await asserts.astEthTotalSupply(setup, wei`10 ether`);
  });

  it('Transfer From: transfer all tokens', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei`10 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);
    await asserts.astEthTotalSupply(setup, wei`10 ether`);

    await lenderA.astETH.approve(lenderB.address, await lenderA.astEthBalance());
    await lenderB.astETH.transferFrom(
      lenderA.address,
      lenderB.address,
      await lenderA.astEthBalance()
    );

    await asserts.astEthBalance(lenderA, '1');
    await asserts.astEthBalance(lenderB, wei`10 ether`, '2');
    await asserts.astEthTotalSupply(setup, wei`10 ether`);
  });

  it('Transfer From: transfer part of tokens', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei`10 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);
    await asserts.astEthTotalSupply(setup, wei`10 ether`);

    await lenderA.astETH.approve(lenderB.address, wei`5 ether`);
    await lenderB.astETH.transferFrom(lenderA.address, lenderB.address, wei`5 ether`);

    await asserts.astEthBalance(lenderA, wei`5 ether`);
    await asserts.astEthBalance(lenderB, wei`5 ether`);
    await asserts.astEthTotalSupply(setup, wei`10 ether`);
  });

  it('Transfer more than deposited: must revert', async () => {
    const { lenderA, lenderB } = setup.lenders;
    await lenderA.depositStEth(wei`10 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);

    const lenderAAstEthAmount = await lenderA.astEthBalance();
    await expect(
      lenderA.transferAstEth(lenderB.address, new BigNumber(lenderAAstEthAmount).plus(1).toFixed(0))
    ).to.be.revertedWith('transfer amount exceeds balance');

    await expect(
      lenderA.transferAstEth(
        lenderB.address,
        new BigNumber(lenderAAstEthAmount).plus('100').toFixed(0)
      )
    ).to.be.revertedWith('transfer amount exceeds balance');
  });

  it('Transfer Events', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei`10 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);

    await expect(lenderA.transferAstEth(lenderB.address, wei`5 ether`))
      .to.emit(setup.astETH, 'BalanceTransfer')
      .withArgs(lenderA.address, lenderB.address, wei`5 ether`, ONE_RAY)
      .emit(setup.astETH, 'Transfer')
      .withArgs(lenderA.address, lenderB.address, wei`5 ether`);
  });
});
