import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import { ProtocolErrors } from '../../helpers/types';
import asserts from './asserts';
import {
  advanceTimeAndBlock,
  expectedBalanceAfterRebase,
  expectedBalanceAfterFlashLoan,
  expectedLiquidityIndexAfterFlashLoan,
  wei,
  ONE_RAY,
  toWei,
} from './helpers';
import { setup } from './__setup.spec';

describe('AStETH FlashLoans', function () {
  it('FlashLoan with mode = 0 must increase liquidity index', async () => {
    const { stETH, aave, lenders } = setup;
    const { lenderA, lenderC } = lenders;

    // lenderA deposit steth
    await lenderA.depositStEth(wei`300 ether`);
    await asserts.astEthBalance(lenderA, wei`300 ether`);
    await asserts.astEthTotalSupply(setup, wei`300 ether`);

    let prevAstEthTotalSupply = await setup.astEthTotalSupply();
    let prevLiquidityIndex = ONE_RAY;
    let currentLiquidityIndex = ONE_RAY;

    const reserveDataBeforeFirstFlashLoan = await aave.protocolDataProvider.getReserveData(
      stETH.address
    );
    asserts.eq(reserveDataBeforeFirstFlashLoan.liquidityIndex.toString(), currentLiquidityIndex);

    // lenderC makes flashloan with mode = 0 when liquidity index = 1
    await lenderC.makeStEthFlashLoanMode0(wei`10 ether`);

    // Validate that liquidityIndex increased correctly
    prevLiquidityIndex = currentLiquidityIndex;
    currentLiquidityIndex = await aave.protocolDataProvider
      .getReserveData(stETH.address)
      .then((rd) => rd.liquidityIndex.toString());
    asserts.eq(
      currentLiquidityIndex,
      expectedLiquidityIndexAfterFlashLoan(prevLiquidityIndex, prevAstEthTotalSupply, wei`10 ether`)
    );
    prevAstEthTotalSupply = await setup.astEthTotalSupply();

    // lenderC makes another flashloan with mode = 0 when liquidity index != 1
    await lenderC.makeStEthFlashLoanMode0(wei`20 ether`);
    prevLiquidityIndex = currentLiquidityIndex;
    currentLiquidityIndex = await aave.protocolDataProvider
      .getReserveData(stETH.address)
      .then((rd) => rd.liquidityIndex.toString());
    asserts.eq(
      currentLiquidityIndex,
      expectedLiquidityIndexAfterFlashLoan(prevLiquidityIndex, prevAstEthTotalSupply, wei`20 ether`)
    );
  });

  it('FlashLoans with mode = 0 with multiple rebases must update balances correctly', async () => {
    const { lenderA, lenderB, lenderC } = setup.lenders;

    // lenderA deposits stETH
    const lenderADeposit = wei`25 ether`;
    await lenderA.depositStEth(lenderADeposit);
    await asserts.astEthBalance(lenderA, lenderADeposit);
    let expectedLenderABalance = await lenderA.astEthBalance();

    // lenderC makes flash loan
    const firstFlashLoanAmount = wei`13 ether`;
    let prevTotalSupply = await setup.astEthTotalSupply();
    await lenderC.makeStEthFlashLoanMode0(firstFlashLoanAmount);

    // validate reward was distributed correctly
    expectedLenderABalance = await expectedBalanceAfterFlashLoan(
      expectedLenderABalance,
      prevTotalSupply,
      firstFlashLoanAmount
    );
    await asserts.astEthBalance(lenderA, expectedLenderABalance);
    // validate that mock receiver might have not more than 1 wei
    // after flash loan due to stETH specificities
    await asserts.lte(
      await setup.stETH.balanceOf(setup.flashLoanReceiverLoan.address).then(toWei),
      '1'
    );
    // validate that astETH total supply might be only 1 wei less than total supply
    // of underlying asset
    await asserts.almostEq(
      await setup.stETH.balanceOf(setup.astETH.address).then(toWei),
      await setup.astEthTotalSupply()
    );
    await asserts.gte(await setup.astEthTotalSupply(), expectedLenderABalance);

    // lenderB deposits stETH
    const lenderBDeposit = wei`15 ether`;
    await lenderB.depositStEth(lenderBDeposit);
    let expectedLenderBBalance = await lenderB.astEthBalance();
    await asserts.astEthBalance(lenderB, expectedLenderBBalance, '2');
    await asserts.almostEq(
      await setup.stETH.balanceOf(setup.astETH.address).then(toWei),
      await setup.astEthTotalSupply()
    );
    await asserts.gte(
      await setup.astEthTotalSupply(),
      new BigNumber(expectedLenderABalance).plus(expectedLenderBBalance).toFixed(0),
      '2'
    );

    // wait one week
    await advanceTimeAndBlock(7 * 24 * 3600);

    // validate balances stays same
    await asserts.astEthBalance(lenderA, expectedLenderABalance);
    await asserts.astEthBalance(lenderB, expectedLenderBBalance, '2');
    await asserts.almostEq(
      await setup.stETH.balanceOf(setup.astETH.address).then(toWei),
      await setup.astEthTotalSupply()
    );
    await asserts.gte(
      await setup.astEthTotalSupply(),
      new BigNumber(expectedLenderABalance).plus(expectedLenderBBalance).toFixed(0),
      '2'
    );

    // positive 1% rebase happens
    await setup.rebaseStETH(+0.01);

    // validate balances updates correctly
    expectedLenderABalance = expectedBalanceAfterRebase(expectedLenderABalance, +0.01);
    expectedLenderBBalance = expectedBalanceAfterRebase(expectedLenderBBalance, +0.01);

    await asserts.astEthBalance(lenderA, expectedLenderABalance);
    await asserts.astEthBalance(lenderB, expectedLenderBBalance, '2');
    asserts.almostEq(
      await setup.stETH.balanceOf(setup.astETH.address).then(toWei),
      await setup.astEthTotalSupply()
    );
    await asserts.gte(
      await setup.astEthTotalSupply(),
      new BigNumber(expectedLenderABalance).plus(expectedLenderBBalance).toFixed(0),
      '2'
    );

    // lenderC makes flashLoan
    const secondFlashLoanAmount = wei`13 ether`;
    prevTotalSupply = await setup.astEthTotalSupply();
    await lenderC.makeStEthFlashLoanMode0(secondFlashLoanAmount);

    // validate balances updated correctly
    expectedLenderABalance = await expectedBalanceAfterFlashLoan(
      expectedLenderABalance,
      prevTotalSupply,
      secondFlashLoanAmount
    );
    await asserts.astEthBalance(lenderA, expectedLenderABalance);
    expectedLenderBBalance = expectedBalanceAfterFlashLoan(
      expectedLenderBBalance,
      prevTotalSupply,
      secondFlashLoanAmount
    );

    await asserts.astEthBalance(lenderB, expectedLenderBBalance, '2');
    asserts.almostEq(
      await setup.stETH.balanceOf(setup.astETH.address).then(toWei),
      await setup.astEthTotalSupply()
    );
    await asserts.gte(
      await setup.astEthTotalSupply(),
      new BigNumber(expectedLenderABalance).plus(expectedLenderBBalance).toFixed(0),
      '2'
    );

    // wait one week
    await advanceTimeAndBlock(30 * 24 * 3060);

    // validate balances
    await asserts.astEthBalance(lenderA, expectedLenderABalance);
    await asserts.astEthBalance(lenderB, expectedLenderBBalance, '2');
    asserts.almostEq(
      await setup.stETH.balanceOf(setup.astETH.address).then(toWei),
      await setup.astEthTotalSupply()
    );
    await asserts.gte(
      await setup.astEthTotalSupply(),
      new BigNumber(expectedLenderABalance).plus(expectedLenderBBalance).toFixed(0),
      '2'
    );

    // negative rebase -5 % happens
    await setup.rebaseStETH(-0.05);

    // validate balances
    expectedLenderABalance = expectedBalanceAfterRebase(expectedLenderABalance, -0.05);
    expectedLenderBBalance = expectedBalanceAfterRebase(expectedLenderBBalance, -0.05);

    await asserts.astEthBalance(lenderA, expectedLenderABalance);
    await asserts.astEthBalance(lenderB, expectedLenderBBalance, '2');
    asserts.almostEq(
      await setup.stETH.balanceOf(setup.astETH.address).then(toWei),
      await setup.astEthTotalSupply(),
      '2'
    );
    await asserts.gte(
      await setup.astEthTotalSupply(),
      new BigNumber(expectedLenderABalance).plus(expectedLenderBBalance).toFixed(0),
      '2'
    );

    // lenderA withdraws all his tokens
    await lenderA.withdrawStEth(await lenderA.astEthBalance());
    await asserts.astEthBalance(lenderA, '1');
    await asserts.astEthBalance(lenderB, expectedLenderBBalance, '2');
    asserts.almostEq(
      await setup.stETH.balanceOf(setup.astETH.address).then(toWei),
      await setup.astEthTotalSupply(),
      '2'
    );
    await asserts.gte(
      await setup.astEthTotalSupply(),
      new BigNumber(expectedLenderBBalance).toFixed(0),
      '2'
    );

    // lenderB withdraws all his tokens
    await lenderB.withdrawStEth(await lenderB.astEthBalance());
    await asserts.astEthBalance(lenderA, '1');
    await asserts.astEthBalance(lenderB, '1');

    await asserts.almostEq(
      await setup.stETH.balanceOf(setup.astETH.address).then(toWei),
      await setup.astEthTotalSupply(),
      '2'
    );
    await asserts.gte(await setup.astEthTotalSupply(), '0', '2');
  });

  it('Flash Loan with mode = 1 when stable rate borrowing disabled must revert with VL_BORROWING_NOT_ENABLED', async () => {
    const { lenderA, lenderC } = setup.lenders;

    // lenderA deposit steth
    await lenderA.depositStEth(wei`300 ether`);

    // lenderC makes flashloan with mode = 1 when liquidity index = 1
    await expect(lenderC.makeStEthFlashLoanMode1(wei`10 ether`)).to.revertedWith(
      ProtocolErrors.VL_BORROWING_NOT_ENABLED
    );
  });

  it('Flash Loan with mode = 2 when variable rate borrowing disabled must revert with VL_BORROWING_NOT_ENABLED', async () => {
    const { lenderA, lenderC } = setup.lenders;

    // lenderA deposit steth
    await lenderA.depositStEth(wei`300 ether`);

    // lenderC makes flashloan with mode = 2 when liquidity index = 1
    await expect(lenderC.makeStEthFlashLoanMode2(wei`10 ether`)).to.revertedWith(
      ProtocolErrors.VL_BORROWING_NOT_ENABLED
    );
  });

  it('Flash Loan with mode = 1 when stable rate borrowing enabled must revert with CONTRACT_NOT_ACTIVE', async () => {
    await setup.aave.lendingPoolConfigurator.enableBorrowingOnReserve(setup.stETH.address, true);
    const { lenderA, lenderC } = setup.lenders;

    // lenderA deposit steth
    await lenderA.depositStEth(wei`300 ether`);

    // lenderC makes flashloan with mode = 1 when liquidity index = 1
    await expect(lenderC.makeStEthFlashLoanMode1(wei`10 ether`)).to.revertedWith(
      'CONTRACT_NOT_ACTIVE'
    );
  });

  it('Flash Loan with mode = 2 when variable rate borrowing enabled must revert with CONTRACT_NOT_ACTIVE', async () => {
    await setup.aave.lendingPoolConfigurator.enableBorrowingOnReserve(setup.stETH.address, false);
    const { lenderA, lenderC } = setup.lenders;

    // lenderA deposit steth
    await lenderA.depositStEth(wei`300 ether`);

    // lenderB makes flashloan with mode = 2 when liquidity index = 1
    await expect(lenderC.makeStEthFlashLoanMode2(wei`10 ether`)).to.revertedWith(
      'CONTRACT_NOT_ACTIVE'
    );
  });
});
