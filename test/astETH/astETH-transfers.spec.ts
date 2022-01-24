import { expect } from 'chai';
import { ContractTransaction } from 'ethers';
import asserts from './asserts';
import { ONE_RAY, wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Transfers', function () {
  it('Transfer all tokens: must update balances correctly', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei`10 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);
    await asserts.astEthTotalSupply(setup, wei`10 ether`);

    await lenderA.transferAstEth(lenderB.address, await lenderA.astEthBalance());
    await asserts.astEthBalance(lenderA, '1');
    await asserts.astEthBalance(lenderB, wei`10 ether`, '2');
    await asserts.astEthTotalSupply(setup, wei`10 ether`);
  });

  it('Transfer part of tokens: must update balances correctly', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei`10 ether`);
    await asserts.astEthBalance(lenderA, wei`10 ether`);
    await asserts.astEthTotalSupply(setup, wei`10 ether`);

    await lenderA.transferAstEth(lenderB.address, wei`5 ether`);
    await asserts.astEthBalance(lenderA, wei`5 ether`);
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
    await expect(lenderA.transferAstEth(lenderB.address, wei`11 ether`)).to.be.revertedWith(
      'transfer amount exceeds balance'
    );
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
