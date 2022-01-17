import { MAX_UINT_AMOUNT } from '../../helpers/constants';
import { assertBalance, wei, advanceTimeAndBlock } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Happy Path', function () {
  it('Should be passed without exceptions', async () => {
    const { aave, stETH, astETH } = setup;
    const { lenderA, lenderB, lenderC } = setup.lenders;

    // lender A deposits 100 stETH
    await lenderA.depositStEth(wei(100));

    assertBalance(await astETH.totalSupply().then(wei), wei(100));
    assertBalance(await lenderA.astEthBalance(), wei(100));
    assertBalance(await lenderB.astEthBalance(), wei(0));
    assertBalance(await lenderC.astEthBalance(), wei(0));

    // wait one month
    await advanceTimeAndBlock(30 * 24 * 3600);

    // validate that balance stays same
    assertBalance(await astETH.totalSupply().then(wei), wei(100));
    assertBalance(await lenderA.astEthBalance(), wei(100));
    assertBalance(await lenderB.astEthBalance(), wei(0));
    assertBalance(await lenderC.astEthBalance(), wei(0));

    // lender B deposits 50 stETH
    await lenderB.depositStEth(wei(50));

    assertBalance(await astETH.totalSupply().then(wei), wei(150));
    assertBalance(await lenderA.astEthBalance(), wei(100));
    assertBalance(await lenderB.astEthBalance(), wei(50));
    assertBalance(await lenderC.astEthBalance(), wei(0));

    // positive rebase 1%
    await setup.rebaseStETH(0.01);

    assertBalance(await astETH.totalSupply().then(wei), wei(151.5));
    assertBalance(await lenderA.astEthBalance(), wei(101));
    assertBalance(await lenderB.astEthBalance(), wei(50.5));
    assertBalance(await lenderC.astEthBalance(), wei(0));

    // wait 1 month
    await advanceTimeAndBlock(3600 * 24 * 30);

    // validate balances stays same
    assertBalance(await astETH.totalSupply().then(wei), wei(151.5));
    assertBalance(await lenderA.astEthBalance(), wei(101));
    assertBalance(await lenderB.astEthBalance(), wei(50.5));
    assertBalance(await lenderC.astEthBalance(), wei(0));

    // lender C deposits 50 stETH
    await lenderC.depositStEth(wei(50));

    assertBalance(await astETH.totalSupply().then(wei), wei(201.5));
    assertBalance(await lenderA.astEthBalance(), wei(101));
    assertBalance(await lenderB.astEthBalance(), wei(50.5));
    assertBalance(await lenderC.astEthBalance(), wei(50));

    // wait 1 month
    await advanceTimeAndBlock(3600 * 24 * 30);

    // validate balances stays same
    assertBalance(await astETH.totalSupply().then(wei), wei(201.5));
    assertBalance(await lenderA.astEthBalance(), wei(101));
    assertBalance(await lenderB.astEthBalance(), wei(50.5));
    assertBalance(await lenderC.astEthBalance(), wei(50));

    // negative rebase happens -0.05%
    await setup.rebaseStETH(-0.05);

    assertBalance(await astETH.totalSupply().then(wei), wei(191.425));
    assertBalance(await lenderA.astEthBalance(), wei(95.95));
    assertBalance(await lenderB.astEthBalance(), wei(47.975));
    assertBalance(await lenderC.astEthBalance(), wei(47.5));

    // lender A transfers 50 astETH to lender C
    await lenderA.transferAstEth(lenderC.address, wei(50));

    assertBalance(await astETH.totalSupply().then(wei), wei(191.425));
    assertBalance(await lenderA.astEthBalance(), wei(45.95));
    assertBalance(await lenderB.astEthBalance(), wei(47.975));
    assertBalance(await lenderC.astEthBalance(), wei(97.5));

    // lenderA withdraws 30 stETH from the pool
    await lenderA.withdrawStEth(wei(30));

    assertBalance(await astETH.totalSupply().then(wei), wei(161.425));
    assertBalance(await lenderA.astEthBalance(), wei(15.95));
    assertBalance(await lenderB.astEthBalance(), wei(47.975));
    assertBalance(await lenderC.astEthBalance(), wei(97.5));

    // wait 1 month
    await advanceTimeAndBlock(3600 * 24 * 30);

    // validate balances stays same
    assertBalance(await astETH.totalSupply().then(wei), wei(161.425));
    assertBalance(await lenderA.astEthBalance(), wei(15.95));
    assertBalance(await lenderB.astEthBalance(), wei(47.975));
    assertBalance(await lenderC.astEthBalance(), wei(97.5));

    // lender A withdraws all his tokens
    await lenderA.withdrawStEth(wei(15.95));

    assertBalance(await astETH.totalSupply().then(wei), wei(145.475));
    assertBalance(await lenderA.astEthBalance(), wei(0));
    assertBalance(await lenderB.astEthBalance(), wei(47.975));
    assertBalance(await lenderC.astEthBalance(), wei(97.5));

    // positive rebase happens +7%
    await setup.rebaseStETH(0.07);

    assertBalance(await astETH.totalSupply().then(wei), wei(155.65825));
    assertBalance(await lenderA.astEthBalance(), wei(0));
    assertBalance(await lenderB.astEthBalance(), wei(51.33325));
    assertBalance(await lenderC.astEthBalance(), wei(104.325));

    // lender B withdraws all his tokens
    await lenderB.withdrawStEth(MAX_UINT_AMOUNT);

    assertBalance(await astETH.totalSupply().then(wei), wei(104.325));
    assertBalance(await lenderA.astEthBalance(), wei(0));
    assertBalance(await lenderB.astEthBalance(), wei(0));
    assertBalance(await lenderC.astEthBalance(), wei(104.325));

    // lender C withdraws all his tokens
    await lenderC.withdrawStEth(MAX_UINT_AMOUNT);

    assertBalance(await astETH.totalSupply().then(wei), wei(0));
    assertBalance(await lenderA.astEthBalance(), wei(0));
    assertBalance(await lenderB.astEthBalance(), wei(0));
    assertBalance(await lenderC.astEthBalance(), wei(0));
  });
});
