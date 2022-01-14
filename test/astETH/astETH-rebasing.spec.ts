import { assertBalance, wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Rebasing', function () {
  it('Positive rebase: must update balances correctly', async () => {
    const { lenderA } = setup.lenders;
    await lenderA.depositStEth(wei(1000));
    await setup.rebaseStETH(0.1);
    assertBalance(await lenderA.astEthBalance(), wei(1100));
    assertBalance(await setup.astEthTotalSupply(), wei(1100));
  });

  it('Negative rebase: must update balances correctly', async () => {
    const { lenderA } = setup.lenders;
    await lenderA.depositStEth(wei(1000));
    await setup.rebaseStETH(-0.1);
    assertBalance(await lenderA.astEthBalance(), wei(900));
    assertBalance(await setup.astEthTotalSupply(), wei(900));
  });

  it('Neutral rebase: must stay balances same', async () => {
    const { lenderA } = setup.lenders;
    await lenderA.depositStEth(wei(1000));
    await setup.rebaseStETH(0);
    assertBalance(await lenderA.astEthBalance(), wei(1000));
    assertBalance(await setup.astEthTotalSupply(), wei(1000));
  });

  it('Large deposits rebasing: must update balances correctly', async () => {
    const { lenderA } = setup.lenders;
    const depositAmount = wei(99_999_999);
    await setup.stETH.mint(lenderA.address, depositAmount);
    await lenderA.depositStEth(depositAmount);
    assertBalance(await lenderA.astEthBalance(), depositAmount);
    await setup.rebaseStETH(0.03);
    assertBalance(await lenderA.astEthBalance(), wei(102999998.97));
  });

  it('Rebase before first deposit" must mint correct amount of tokens', async () => {
    await setup.rebaseStETH(0.1);
    const { lenderA } = setup.lenders;
    await lenderA.depositStEth(wei(13));
    assertBalance(await lenderA.astEthBalance(), wei(13));
  });

  it('lenderA deposits 1 stETH, positive rebase, lenderA transfers 1 astETH to lenderB', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei(1));
    await setup.rebaseStETH(1);
    await lenderA.transferAstEth(lenderB.address, wei(1));

    assertBalance(await lenderA.astEthBalance(), wei(1));
    assertBalance(await lenderB.astEthBalance(), wei(1));
  });

  it('lenderA deposits 1 stETH, negative rebase, lenderA transfers 0.5 astETH to lenderB', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei(1));
    await setup.rebaseStETH(-0.5);
    await lenderA.transferAstEth(lenderB.address, wei(0.5));

    assertBalance(await lenderA.astEthBalance(), wei(0));
    assertBalance(await lenderB.astEthBalance(), wei(0.5));
  });

  it('lenderA deposits, positive rebase, lenderB deposits', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei(97));
    await setup.rebaseStETH(1);
    await lenderB.depositStEth(wei(13));

    assertBalance(await lenderA.astEthBalance(), wei(194));
    assertBalance(await lenderB.astEthBalance(), wei(13));
    assertBalance(await setup.astEthTotalSupply(), wei(207));
  });
});
