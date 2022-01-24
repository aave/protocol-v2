import asserts from './asserts';
import { setup } from './__setup.spec';
import { wei } from './helpers';

describe('AStETH Rebasing', function () {
  it('Positive rebase: must update balances correctly', async () => {
    const { lenderA } = setup.lenders;

    await lenderA.depositStEth(wei`1000 ether`);
    await asserts.astEthBalance(lenderA, wei`1000 ether`);
    await asserts.astEthTotalSupply(setup, wei`1000 ether`);

    await setup.rebaseStETH(0.01);
    await asserts.astEthBalance(lenderA, wei`1010 ether`);
    await asserts.astEthTotalSupply(setup, wei`1010 ether`);
  });

  it('Negative rebase: must update balances correctly', async () => {
    const { lenderA } = setup.lenders;

    await lenderA.depositStEth(wei`1000 ether`);
    await asserts.astEthBalance(lenderA, wei`1000 ether`);
    await asserts.astEthTotalSupply(setup, wei`1000 ether`);

    await setup.rebaseStETH(-0.0093);
    await asserts.astEthBalance(lenderA, wei`990.7 ether`);
    await asserts.astEthTotalSupply(setup, wei`990.7 ether`);
  });

  it('Neutral rebase: must stay balances same', async () => {
    const { lenderA } = setup.lenders;

    await lenderA.depositStEth(wei`1000 ether`);
    await asserts.astEthBalance(lenderA, wei`1000 ether`);
    await asserts.astEthTotalSupply(setup, wei`1000 ether`);

    await setup.rebaseStETH(0);
    await asserts.astEthBalance(lenderA, wei`1000 ether`);
    await asserts.astEthTotalSupply(setup, wei`1000 ether`);
  });

  it('Large deposits rebasing: must update balances correctly', async () => {
    const { lenderA } = setup.lenders;

    const depositAmount = wei`99999999 ether`;
    await setup.stETH.mint(lenderA.address, depositAmount);

    await lenderA.depositStEth(depositAmount);
    await asserts.astEthBalance(lenderA, depositAmount);
    await asserts.astEthTotalSupply(setup, depositAmount);

    await setup.rebaseStETH(0.03);
    await asserts.astEthBalance(lenderA, wei`102999998.97 ether`);
    await asserts.astEthTotalSupply(setup, wei`102999998.97 ether`);
  });

  it('Rebase before first deposit: must mint correct amount of tokens', async () => {
    await setup.rebaseStETH(0.05);
    const { lenderA } = setup.lenders;

    await lenderA.depositStEth(wei`13 ether`);
    await asserts.astEthBalance(lenderA, wei`13 ether`);
    await asserts.astEthTotalSupply(setup, wei`13 ether`);
  });

  it('lenderA deposits 1 stETH, positive rebase, lenderA transfers 1 astETH to lenderB', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei`1 ether`);
    await asserts.astEthBalance(lenderA, wei`1 ether`);
    await asserts.astEthTotalSupply(setup, wei`1 ether`);

    await setup.rebaseStETH(0.015);
    await asserts.astEthBalance(lenderA, wei`1.015 ether`);
    await asserts.astEthTotalSupply(setup, wei`1.015 ether`);

    await lenderA.transferAstEth(lenderB.address, wei`1 ether`);
    await asserts.astEthBalance(lenderA, wei`0.015 ether`);
    await asserts.astEthBalance(lenderB, wei`1 ether`);
    await asserts.astEthTotalSupply(setup, wei`1.015 ether`);
  });

  it('lenderA deposits 1 stETH, negative rebase, lenderA transfers 0.5 astETH to lenderB', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei`1 ether`);
    await asserts.astEthBalance(lenderA, wei`1 ether`);
    await asserts.astEthTotalSupply(setup, wei`1 ether`);

    await setup.rebaseStETH(-0.02);
    await asserts.astEthBalance(lenderA, wei`0.98 ether`);
    await asserts.astEthTotalSupply(setup, wei`0.98 ether`);

    await lenderA.transferAstEth(lenderB.address, wei`0.5 ether`);
    await asserts.astEthBalance(lenderA, wei`0.48 ether`);
    await asserts.astEthBalance(lenderB, wei`0.5 ether`);
    await asserts.astEthTotalSupply(setup, wei`0.98 ether`);
  });

  it('lenderA deposits, positive rebase, lenderB deposits', async () => {
    const { lenderA, lenderB } = setup.lenders;

    await lenderA.depositStEth(wei`97 ether`);
    await asserts.astEthBalance(lenderA, wei`97 ether`);
    await asserts.astEthTotalSupply(setup, wei`97 ether`);

    await setup.rebaseStETH(0.0003);
    await asserts.astEthBalance(lenderA, wei`97.0291 ether`);
    await asserts.astEthTotalSupply(setup, wei`97.0291 ether`);

    await lenderB.depositStEth(wei`13 ether`);
    await asserts.astEthBalance(lenderB, wei`13 ether`);
    await asserts.astEthBalance(lenderA, wei`97.0291 ether`);
    await asserts.astEthTotalSupply(setup, wei`110.0291 ether`, '2');
  });
});
