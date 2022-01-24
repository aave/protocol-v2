import BigNumber from 'bignumber.js';
import { MAX_UINT_AMOUNT } from '../../helpers/constants';
import asserts from './asserts';
import { wei, advanceTimeAndBlock } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Happy Path', function () {
  it('Should be passed without exceptions', async () => {
    const { lenderA, lenderB, lenderC } = setup.lenders;

    // lender A deposits 100 stETH
    await lenderA.depositStEth(wei(100));

    await asserts.astEthBalance(lenderA, wei(100));
    await asserts.astEthBalance(lenderB, wei(0));
    await asserts.astEthBalance(lenderC, wei(0));
    await asserts.astEthTotalSupply(setup, wei(100));

    // wait one month
    await advanceTimeAndBlock(30 * 24 * 3600);

    // validate that balance stays same
    await asserts.astEthBalance(lenderA, wei(100));
    await asserts.astEthBalance(lenderB, wei(0));
    await asserts.astEthBalance(lenderC, wei(0));
    await asserts.astEthTotalSupply(setup, wei(100));

    // lender B deposits 50 stETH
    await lenderB.depositStEth(wei(50));

    await asserts.astEthBalance(lenderA, wei(100));
    await asserts.astEthBalance(lenderB, wei(50));
    await asserts.astEthBalance(lenderC, wei(0));
    await asserts.astEthTotalSupply(setup, wei(150), '2');

    // positive rebase 0.1%
    await setup.rebaseStETH(0.001);

    await asserts.astEthBalance(lenderA, wei(100.1));
    await asserts.astEthBalance(lenderB, wei(50.05));
    await asserts.astEthBalance(lenderC, wei(0));
    await asserts.astEthTotalSupply(setup, wei(150.15), '2');

    // wait 1 month
    await advanceTimeAndBlock(3600 * 24 * 30);

    // validate balances stays same
    await asserts.astEthBalance(lenderA, wei(100.1));
    await asserts.astEthBalance(lenderB, wei(50.05));
    await asserts.astEthBalance(lenderC, wei(0));
    await asserts.astEthTotalSupply(setup, wei(150.15), '2');

    // lender C deposits 50 stETH
    await lenderC.depositStEth(wei(50));

    await asserts.astEthBalance(lenderA, wei(100.1));
    await asserts.astEthBalance(lenderB, wei(50.05));
    await asserts.astEthBalance(lenderC, wei(50));
    await asserts.astEthTotalSupply(setup, wei(200.15), '2');

    // wait 1 month
    await advanceTimeAndBlock(3600 * 24 * 30);

    // validate balances stays same
    await asserts.astEthBalance(lenderA, wei(100.1));
    await asserts.astEthBalance(lenderB, wei(50.05));
    await asserts.astEthBalance(lenderC, wei(50));
    await asserts.astEthTotalSupply(setup, wei(200.15), '2');

    // negative rebase happens -5%
    await setup.rebaseStETH(-0.05);

    await asserts.astEthBalance(lenderA, wei(95.095));
    await asserts.astEthBalance(lenderB, wei(47.5475));
    await asserts.astEthBalance(lenderC, wei(47.5));
    await asserts.astEthTotalSupply(setup, wei(190.1425), '2');

    // lender A transfers 50 astETH to lender C
    await lenderA.transferAstEth(lenderC.address, wei(50));

    await asserts.astEthBalance(lenderA, wei(45.095));
    await asserts.astEthBalance(lenderB, wei(47.5475));
    await asserts.astEthBalance(lenderC, wei(97.5), '2');
    await asserts.astEthTotalSupply(setup, wei(190.1425), '2');

    // lenderA withdraws 30 stETH from the pool
    let lenderAAstEthBalanceBefore = await lenderA.astEthBalance();
    let lenderAStEthBalanceBefore = await lenderA.stEthBalance();
    await lenderA.withdrawStEth(wei(30));

    asserts.eq(
      new BigNumber(lenderAAstEthBalanceBefore).minus(await lenderA.astEthBalance()).toString(),
      new BigNumber(await lenderA.stEthBalance()).minus(lenderAStEthBalanceBefore).toString()
    );

    // it's possible that after withdraw user will have couple of wei on balance
    // count it in assertion
    const expectedLenderABalanceAfterWithdraw = new BigNumber(wei(15.095)).plus(1).toFixed(0);
    await asserts.astEthBalance(lenderA, expectedLenderABalanceAfterWithdraw);
    await asserts.astEthBalance(lenderB, wei(47.5475));
    await asserts.astEthBalance(lenderC, wei(97.5), '2');
    await asserts.astEthTotalSupply(setup, wei(160.1425), '2');

    // wait 1 month
    await advanceTimeAndBlock(3600 * 24 * 30);

    // validate balances stays same
    await asserts.astEthBalance(lenderA, expectedLenderABalanceAfterWithdraw);
    await asserts.astEthBalance(lenderB, wei(47.5475));
    await asserts.astEthBalance(lenderC, wei(97.5), '2');
    await asserts.astEthTotalSupply(setup, wei(160.1425), '2');

    // lender A withdraws all his tokens
    await lenderA.withdrawStEth(await lenderA.astEthBalance());

    await asserts.astEthBalance(lenderA, '1');
    await asserts.astEthBalance(lenderB, wei(47.5475));
    await asserts.astEthBalance(lenderC, wei(97.5), '2');
    await asserts.astEthTotalSupply(setup, wei(145.0475), '2');

    // positive rebase happens +5.3%
    await setup.rebaseStETH(0.053);
    await asserts.astEthBalance(lenderA, '1');
    await asserts.astEthBalance(lenderB, wei(50.0675175));
    await asserts.astEthBalance(lenderC, wei(102.6675), '2');
    await asserts.astEthTotalSupply(setup, wei(152.7350175), '2');

    // lender B withdraws all his tokens
    await lenderB.withdrawStEth(MAX_UINT_AMOUNT);

    await asserts.astEthBalance(lenderA, '1');
    await asserts.astEthBalance(lenderB, '1');
    await asserts.astEthBalance(lenderC, wei(102.6675), '2');
    await asserts.astEthTotalSupply(setup, wei(102.6675), '2');

    // lender C withdraws all his tokens
    await lenderC.withdrawStEth(MAX_UINT_AMOUNT);

    await asserts.astEthBalance(lenderA, '1');
    await asserts.astEthBalance(lenderB, '1');
    await asserts.astEthBalance(lenderC, '1');
    await asserts.astEthTotalSupply(setup, '3');
  });
});
