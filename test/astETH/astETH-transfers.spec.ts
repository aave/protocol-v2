import { expect } from 'chai';
import asserts from './asserts';
import { ONE_RAY, wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Transfers', function () {
  it('Transfer all tokens: must update balances correctly', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei(10));
    await asserts.astEthBalance(lenderA, wei(10));
    await asserts.astEthTotalSupply(setup, wei(10));

    await lenderA.transferAstEth(lenderB.address, await lenderA.astEthBalance());
    await asserts.astEthBalance(lenderA, '1');
    await asserts.astEthBalance(lenderB, wei(10), '2');
    await asserts.astEthTotalSupply(setup, wei(10));
  });

  it('Transfer part of tokens: must update balances correctly', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei(10));
    await asserts.astEthBalance(lenderA, wei(10));
    await asserts.astEthTotalSupply(setup, wei(10));

    await lenderA.transferAstEth(lenderB.address, wei(5));
    await asserts.astEthBalance(lenderA, wei(5));
    await asserts.astEthBalance(lenderB, wei(5));
    await asserts.astEthTotalSupply(setup, wei(10));
  });

  it('Transfer From: transfer all tokens', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei(10));
    await asserts.astEthBalance(lenderA, wei(10));
    await asserts.astEthTotalSupply(setup, wei(10));

    await lenderA.astETH.approve(lenderB.address, await lenderA.astEthBalance());
    await lenderB.astETH.transferFrom(
      lenderA.address,
      lenderB.address,
      await lenderA.astEthBalance()
    );

    await asserts.astEthBalance(lenderA, '1');
    await asserts.astEthBalance(lenderB, wei(10), '2');
    await asserts.astEthTotalSupply(setup, wei(10));
  });

  it('Transfer From: transfer part of tokens', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei(10));
    await asserts.astEthBalance(lenderA, wei(10));
    await asserts.astEthTotalSupply(setup, wei(10));

    await lenderA.astETH.approve(lenderB.address, wei(5));
    await lenderB.astETH.transferFrom(lenderA.address, lenderB.address, wei(5));

    await asserts.astEthBalance(lenderA, wei(5));
    await asserts.astEthBalance(lenderB, wei(5));
    await asserts.astEthTotalSupply(setup, wei(10));
  });

  it('Transfer more than deposited: must revert', async () => {
    const { lenderA, lenderB } = setup.lenders;
    await lenderA.depositStEth(wei(10));
    await expect(lenderA.transferAstEth(lenderB.address, wei(11))).to.be.revertedWith(
      'transfer amount exceeds balance'
    );
  });

  it('Transfer Events', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei(10));
    await asserts.astEthBalance(lenderA, wei(10));

    await expect(lenderA.transferAstEth(lenderB.address, wei(5)))
      .to.emit(setup.astETH, 'BalanceTransfer')
      .withArgs(lenderA.address, lenderB.address, wei(5), ONE_RAY)
      .emit(setup.astETH, 'Transfer')
      .withArgs(lenderA.address, lenderB.address, wei(5));
  });
});
