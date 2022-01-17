import { expect } from 'chai';
import { ProtocolErrors } from '../../helpers/types';
import {
  advanceTimeAndBlock,
  assertBalance,
  expectedBalanceAfterRebase,
  expectedBalanceAfterFlashLoan,
  expectedLiquidityIndexAfterFlashLoan,
  ray,
  wei,
} from './helpers';
import { setup } from './__setup.spec';

describe('AStETH FlashLoans', function () {
  it('FlashLoan with mode = 0 must increase liquidity index', async () => {
    const { stETH, aave, lenders } = setup;
    const { lenderA, lenderC } = lenders;

    // lenderA deposit steth
    await lenderA.depositStEth(wei(300));

    const reserveDataBeforeFirstFlashLoan = await aave.protocolDataProvider.getReserveData(
      stETH.address
    );
    expect(reserveDataBeforeFirstFlashLoan.liquidityIndex.toString()).equals(ray(1));

    // lenderC makes flashloan with mode = 1 when liquidity index = 1
    const firstFlashLoanAmount = wei(10);
    await lenderC.makeStEthFlashLoanMode0(firstFlashLoanAmount);

    // Validate that liquidityIndex increased correctly
    const reserveDataBeforeSecondFlashLoan = await aave.protocolDataProvider.getReserveData(
      stETH.address
    );
    expect(reserveDataBeforeSecondFlashLoan.liquidityIndex.toString()).equals(
      expectedLiquidityIndexAfterFlashLoan(reserveDataBeforeFirstFlashLoan, firstFlashLoanAmount)
    );

    // lenderB makes another flashloan with mode = 1 when liquidity index != 1
    const secondFlashLoanAmount = wei(20);
    await lenderC.makeStEthFlashLoanMode0(secondFlashLoanAmount);

    const reserveDataAfterSecondFlashLoan = await aave.protocolDataProvider.getReserveData(
      stETH.address
    );
    expect(reserveDataAfterSecondFlashLoan.liquidityIndex.toString()).equals(
      expectedLiquidityIndexAfterFlashLoan(reserveDataBeforeSecondFlashLoan, secondFlashLoanAmount)
    );
  });

  it('FlashLoans with mode = 0 with multiple rebases must update balances correctly', async () => {
    const { lenderA, lenderB, lenderC } = setup.lenders;

    // lenderA deposits stETH
    const lenderADeposit = wei(25);
    await lenderA.depositStEth(lenderADeposit);
    let expectedLenderABalance = lenderADeposit;
    expect(await lenderA.astEthBalance()).equals(expectedLenderABalance);

    // lenderB makes flash loan
    const firstFlashLoanAmount = wei(13);
    const providerDataBeforeFirstFlashLoan = await setup.aave.protocolDataProvider.getReserveData(
      setup.stETH.address
    );
    await lenderC.makeStEthFlashLoanMode0(firstFlashLoanAmount);

    // validate reward was distributed correctly
    expectedLenderABalance = await expectedBalanceAfterFlashLoan(
      expectedLenderABalance,
      providerDataBeforeFirstFlashLoan,
      firstFlashLoanAmount
    );
    expect(await lenderA.astEthBalance()).equals(expectedLenderABalance);

    // lenderC deposits stETH
    const lenderBDeposit = wei(15);
    await lenderB.depositStEth(lenderBDeposit);
    let expectedLenderBBalance = lenderBDeposit;
    assertBalance(await lenderB.astEthBalance(), expectedLenderBBalance);

    // wait one week
    await advanceTimeAndBlock(7 * 24 * 3600);

    // validate balances stays same
    assertBalance(await lenderA.astEthBalance(), expectedLenderABalance);
    assertBalance(await lenderB.astEthBalance(), expectedLenderBBalance);

    // positive 10% rebase happens
    await setup.rebaseStETH(+0.1);

    // validate balances updates correctly
    expectedLenderABalance = expectedBalanceAfterRebase(expectedLenderABalance, +0.1);
    expectedLenderBBalance = expectedBalanceAfterRebase(expectedLenderBBalance, +0.1);

    assertBalance(await lenderA.astEthBalance(), expectedLenderABalance);
    assertBalance(await lenderB.astEthBalance(), expectedLenderBBalance);

    const providerDataBeforeSecondFlashLoan = await setup.aave.protocolDataProvider.getReserveData(
      setup.stETH.address
    );
    // lenderC makes flashLoan
    const secondFlashLoanAmount = wei(13);
    await lenderC.makeStEthFlashLoanMode0(secondFlashLoanAmount);

    // validate balances updated correctly
    expectedLenderABalance = await expectedBalanceAfterFlashLoan(
      expectedLenderABalance,
      providerDataBeforeSecondFlashLoan,
      secondFlashLoanAmount
    );
    expect(await lenderA.astEthBalance()).equals(expectedLenderABalance);
    expectedLenderBBalance = expectedBalanceAfterFlashLoan(
      expectedLenderBBalance,
      providerDataBeforeSecondFlashLoan,
      secondFlashLoanAmount
    );
    expect(await lenderB.astEthBalance()).equals(expectedLenderBBalance);

    // wait one week
    await advanceTimeAndBlock(30 * 24 * 3060);

    // validate balances
    assertBalance(await lenderA.astEthBalance(), expectedLenderABalance);
    assertBalance(await lenderB.astEthBalance(), expectedLenderBBalance);

    // negative rebase -5 % happens
    await setup.rebaseStETH(-0.05);

    // validate balances
    expectedLenderABalance = expectedBalanceAfterRebase(expectedLenderABalance, -0.05);
    expectedLenderBBalance = expectedBalanceAfterRebase(expectedLenderBBalance, -0.05);
    assertBalance(await lenderA.astEthBalance(), expectedLenderABalance);
    assertBalance(await lenderB.astEthBalance(), expectedLenderBBalance);

    // lenderA withdraws all his tokens
    await lenderA.withdrawStEth(expectedLenderABalance);
    assertBalance(await lenderA.astEthBalance(), wei(0));
    assertBalance(await lenderB.astEthBalance(), expectedLenderBBalance);

    // lenderC withdraws all his tokens
    await lenderB.withdrawStEth(expectedLenderBBalance);
    assertBalance(await lenderA.astEthBalance(), wei(0));
    assertBalance(await lenderB.astEthBalance(), wei(0));
  });

  it('Flash Loan with mode = 1 when stable rate borrowing disabled must revert with VL_BORROWING_NOT_ENABLED', async () => {
    const { lenderA, lenderC } = setup.lenders;

    // lenderA deposit steth
    await lenderA.depositStEth(wei(300));

    // lenderC makes flashloan with mode = 1 when liquidity index = 1
    await expect(lenderC.makeStEthFlashLoanMode1(wei(10))).to.revertedWith(
      ProtocolErrors.VL_BORROWING_NOT_ENABLED
    );
  });

  it('Flash Loan with mode = 2 when variable rate borrowing disabled must revert with VL_BORROWING_NOT_ENABLED', async () => {
    const { lenderA, lenderC } = setup.lenders;

    // lenderA deposit steth
    await lenderA.depositStEth(wei(300));

    // lenderC makes flashloan with mode = 1 when liquidity index = 1
    await expect(lenderC.makeStEthFlashLoanMode2(wei(10))).to.revertedWith(
      ProtocolErrors.VL_BORROWING_NOT_ENABLED
    );
  });

  it('Flash Loan with mode = 1 when stable rate borrowing enabled must revert with CONTRACT_NOT_ACTIVE', async () => {
    await setup.aave.lendingPoolConfigurator.enableBorrowingOnReserve(setup.stETH.address, true);
    const { lenderA, lenderC } = setup.lenders;

    // lenderA deposit steth
    await lenderA.depositStEth(wei(300));

    // lenderC makes flashloan with mode = 1 when liquidity index = 1
    await expect(lenderC.makeStEthFlashLoanMode1(wei(10))).to.revertedWith('CONTRACT_NOT_ACTIVE');
  });

  it('Flash Loan with mode = 2 when variable rate borrowing enabled must revert with CONTRACT_NOT_ACTIVE', async () => {
    await setup.aave.lendingPoolConfigurator.enableBorrowingOnReserve(setup.stETH.address, false);
    const { lenderA, lenderC } = setup.lenders;

    // lenderA deposit steth
    await lenderA.depositStEth(wei(300));

    // lenderB makes flashloan with mode = 1 when liquidity index = 1
    await expect(lenderC.makeStEthFlashLoanMode2(wei(10))).to.revertedWith('CONTRACT_NOT_ACTIVE');
  });
});
