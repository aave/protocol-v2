import { expect } from 'chai';
import { assertBalance, ONE_RAY, wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Transfers', function () {
  it('Transfer all tokens: must update balances correctly', async () => {
    const { lenderA, lenderB } = setup.lenders;

    const transferAmount = wei(10);
    await lenderA.depositStEth(transferAmount);
    await lenderA.transferAstEth(lenderB.address, transferAmount);

    assertBalance(await lenderA.astEthBalance(), wei(0));
    assertBalance(await lenderB.astEthBalance(), transferAmount);
    assertBalance(await setup.astETH.totalSupply().then(wei), transferAmount);
  });

  it('Transfer part of tokens: must update balances correctly', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei(10));
    await lenderA.transferAstEth(lenderB.address, wei(5));

    assertBalance(await lenderA.astEthBalance(), wei(5));
    assertBalance(await lenderB.astEthBalance(), wei(5));
    assertBalance(await setup.astETH.totalSupply().then(wei), wei(10));
  });

  it('Transfer From', async () => {
    const { lenderA, lenderB } = setup.lenders;
    await lenderA.depositStEth(wei(10));
    await lenderA.astETH.approve(lenderB.address, wei(10));

    await lenderB.astETH.transferFrom(lenderA.address, lenderB.address, wei(10));
    assertBalance(await lenderB.astEthBalance(), wei(10));
    assertBalance(await lenderA.astEthBalance(), wei(0));
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

    const transferAmount = wei(10);
    await lenderA.depositStEth(transferAmount);

    await expect(lenderA.transferAstEth(lenderB.address, transferAmount))
      .to.emit(setup.astETH, 'BalanceTransfer')
      .withArgs(lenderA.address, lenderB.address, transferAmount, ONE_RAY)
      .emit(setup.astETH, 'Transfer')
      .withArgs(lenderA.address, lenderB.address, transferAmount);
  });
});
