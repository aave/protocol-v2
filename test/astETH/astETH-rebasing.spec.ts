import asserts from './asserts';
import { setup } from './__setup.spec';
import { wei } from './helpers';

describe('AStETH Rebasing', function () {
  it('Positive rebase: must update balances correctly', async () => {
    const { lenderA } = setup.lenders;

    await lenderA.depositStEth(wei(1000));
    await asserts.astEthBalance(lenderA, wei(1000));
    await asserts.astEthTotalSupply(setup, wei(1000));

    await setup.rebaseStETH(0.01);
    await asserts.astEthBalance(lenderA, wei(1010));
    await asserts.astEthTotalSupply(setup, wei(1010));
  });

  it('Negative rebase: must update balances correctly', async () => {
    const { lenderA } = setup.lenders;

    await lenderA.depositStEth(wei(1000));
    await asserts.astEthBalance(lenderA, wei(1000));
    await asserts.astEthTotalSupply(setup, wei(1000));

    await setup.rebaseStETH(-0.0093);
    await asserts.astEthBalance(lenderA, wei(990.7));
    await asserts.astEthTotalSupply(setup, wei(990.7));
  });

  it('Neutral rebase: must stay balances same', async () => {
    const { lenderA } = setup.lenders;

    await lenderA.depositStEth(wei(1000));
    await asserts.astEthBalance(lenderA, wei(1000));
    await asserts.astEthTotalSupply(setup, wei(1000));

    await setup.rebaseStETH(0);
    await asserts.astEthBalance(lenderA, wei(1000));
    await asserts.astEthTotalSupply(setup, wei(1000));
  });

  it('Large deposits rebasing: must update balances correctly', async () => {
    const { lenderA } = setup.lenders;

    const depositAmount = wei(99_999_999);
    await setup.stETH.mint(lenderA.address, depositAmount);

    await lenderA.depositStEth(depositAmount);
    await asserts.astEthBalance(lenderA, depositAmount);
    await asserts.astEthTotalSupply(setup, depositAmount);

    await setup.rebaseStETH(0.03);
    await asserts.astEthBalance(lenderA, wei(102999998.97));
    await asserts.astEthTotalSupply(setup, wei(102999998.97));
  });

  it('Rebase before first deposit: must mint correct amount of tokens', async () => {
    await setup.rebaseStETH(0.05);
    const { lenderA } = setup.lenders;

    await lenderA.depositStEth(wei(13));
    await asserts.astEthBalance(lenderA, wei(13));
    await asserts.astEthTotalSupply(setup, wei(13));
  });

  it('lenderA deposits 1 stETH, positive rebase, lenderA transfers 1 astETH to lenderB', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei(1));
    await asserts.astEthBalance(lenderA, wei(1));
    await asserts.astEthTotalSupply(setup, wei(1));

    await setup.rebaseStETH(0.015);
    await asserts.astEthBalance(lenderA, wei(1.015));
    await asserts.astEthTotalSupply(setup, wei(1.015));

    await lenderA.transferAstEth(lenderB.address, wei(1));
    await asserts.astEthBalance(lenderA, wei(0.015));
    await asserts.astEthBalance(lenderB, wei(1));
    await asserts.astEthTotalSupply(setup, wei(1.015));
  });

  it('lenderA deposits 1 stETH, negative rebase, lenderA transfers 0.5 astETH to lenderB', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei(1));
    await asserts.astEthBalance(lenderA, wei(1));
    await asserts.astEthTotalSupply(setup, wei(1));

    await setup.rebaseStETH(-0.02);
    await asserts.astEthBalance(lenderA, wei(0.98));
    await asserts.astEthTotalSupply(setup, wei(0.98));

    await lenderA.transferAstEth(lenderB.address, wei(0.5));
    await asserts.astEthBalance(lenderA, wei(0.48));
    await asserts.astEthBalance(lenderB, wei(0.5));
    await asserts.astEthTotalSupply(setup, wei(0.98));
  });

  it('lenderA deposits, positive rebase, lenderB deposits', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei(97));
    await asserts.astEthBalance(lenderA, wei(97));
    await asserts.astEthTotalSupply(setup, wei(97));

    await setup.rebaseStETH(0.0003);
    await asserts.astEthBalance(lenderA, wei(97.0291));
    await asserts.astEthTotalSupply(setup, wei(97.0291));

    await lenderB.depositStEth(wei(13));
    await asserts.astEthBalance(lenderB, wei(13));
    await asserts.astEthBalance(lenderA, wei(97.0291));
    await asserts.astEthTotalSupply(setup, wei(110.0291), '2');
  });
});
