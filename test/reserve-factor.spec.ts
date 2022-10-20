import BigNumber from 'bignumber.js';

import { DRE, increaseTime } from '../helpers/misc-utils';
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from '../helpers/constants';
import { convertToCurrencyDecimals } from '../helpers/contracts-helpers';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { RateMode } from '../helpers/types';
import { ConfigNames, getTreasuryAddress, loadPoolConfig } from '../helpers/configuration';

const chai = require('chai');

const { expect } = chai;

// Setup function to have 1 user with DAI deposits, and another user with WETH collateral
// and DAI borrowings at an indicated borrowing mode
const setupPositions = async (testEnv: TestEnv, borrowingMode: RateMode) => {
  const { dai, weth, users, pool, oracle } = testEnv;
  const depositor = users[0];
  const borrower = users[1];

  // mints DAI to depositor
  await dai.connect(depositor.signer).mint(await convertToCurrencyDecimals(dai.address, '2000'));

  // approve protocol to access depositor wallet
  await dai.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

  // user 1 deposits 1000 DAI
  const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

  await pool
    .connect(depositor.signer)
    .deposit(dai.address, amountDAItoDeposit, depositor.address, '0');
  // user 2 deposits 1 ETH
  const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

  // mints WETH to borrower
  await weth.connect(borrower.signer).mint(await convertToCurrencyDecimals(weth.address, '1000'));

  // approve protocol to access the borrower wallet
  await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

  await pool
    .connect(borrower.signer)
    .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

  //user 2 borrows

  const userGlobalData = await pool.getUserAccountData(borrower.address);
  const daiPrice = await oracle.getAssetPrice(dai.address);

  const amountDAIToBorrow = await convertToCurrencyDecimals(
    dai.address,
    new BigNumber(userGlobalData.availableBorrowsETH.toString())
      .div(daiPrice.toString())
      .multipliedBy(0.95)
      .toFixed(0)
  );

  await pool
    .connect(borrower.signer)
    .borrow(dai.address, amountDAIToBorrow, borrowingMode, '0', borrower.address);
};

makeSuite('LendingPool Reserve Factor 100%. Only variable borrowings', (testEnv) => {
  before('Before LendingPool Reserve Factor accrual: set config', () => {
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
  });

  after('After LendingPool Reserve Factor accrual: reset config', () => {
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });

  it('Validates that variable borrow index accrue, liquidity index not, and the Collector receives aTokens after interest accrues', async () => {
    const { configurator, dai, users, pool, aDai } = testEnv;

    await setupPositions(testEnv, RateMode.Variable);

    // Set the RF to 100%
    await configurator.setReserveFactor(dai.address, '10000');

    const depositor = users[0];

    const collectorAddress = await getTreasuryAddress(loadPoolConfig(ConfigNames.Aave));

    const collectorADAIBalanceBefore = await aDai.scaledBalanceOf(collectorAddress);

    const reserveDataBefore = await pool.getReserveData(dai.address);

    await increaseTime(10000);

    // Deposit to "settle" the liquidity index accrual from pre-RF increase to 100%
    await pool
      .connect(depositor.signer)
      .deposit(
        dai.address,
        await convertToCurrencyDecimals(dai.address, '1'),
        depositor.address,
        '0'
      );

    const reserveDataAfter1 = await pool.getReserveData(dai.address);
    const collectorADAIBalanceAfter1 = await aDai.balanceOf(collectorAddress);

    expect(reserveDataAfter1.variableBorrowIndex).to.be.gt(reserveDataBefore.variableBorrowIndex);
    expect(collectorADAIBalanceAfter1).to.be.gt(collectorADAIBalanceBefore);
    expect(reserveDataAfter1.liquidityIndex).to.be.gt(reserveDataBefore.liquidityIndex);

    await increaseTime(10000);

    // "Clean" update, that should not increase the liquidity index, only variable borrow
    await pool
      .connect(depositor.signer)
      .deposit(
        dai.address,
        await convertToCurrencyDecimals(dai.address, '1'),
        depositor.address,
        '0'
      );

    const reserveDataAfter2 = await pool.getReserveData(dai.address);
    const collectorADAIBalanceAfter2 = await aDai.balanceOf(collectorAddress);

    expect(reserveDataAfter2.variableBorrowIndex).to.be.gt(reserveDataAfter1.variableBorrowIndex);
    expect(collectorADAIBalanceAfter2).to.be.gt(collectorADAIBalanceAfter1);
    expect(reserveDataAfter2.liquidityIndex).to.be.eq(reserveDataAfter1.liquidityIndex);
  });
});

makeSuite('LendingPool Reserve Factor 100%. Only stable borrowings', (testEnv) => {
  before('Before LendingPool Reserve Factor accrual: set config', () => {
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
  });

  after('After LendingPool Reserve Factor accrual: reset config', () => {
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });

  it('Validates that neither variable borrow index nor liquidity index increase, but the Collector receives aTokens after interest accrues', async () => {
    const { configurator, dai, users, pool, aDai } = testEnv;

    await setupPositions(testEnv, RateMode.Stable);

    // Set the RF to 100%
    await configurator.setReserveFactor(dai.address, '10000');

    const depositor = users[0];

    const collectorAddress = await getTreasuryAddress(loadPoolConfig(ConfigNames.Aave));

    const collectorADAIBalanceBefore = await aDai.scaledBalanceOf(collectorAddress);

    const reserveDataBefore = await pool.getReserveData(dai.address);

    await increaseTime(10000);

    // Deposit to "settle" the liquidity index accrual from pre-RF increase to 100%
    await pool
      .connect(depositor.signer)
      .deposit(
        dai.address,
        await convertToCurrencyDecimals(dai.address, '1'),
        depositor.address,
        '0'
      );

    const reserveDataAfter1 = await pool.getReserveData(dai.address);
    const collectorADAIBalanceAfter1 = await aDai.balanceOf(collectorAddress);

    expect(reserveDataAfter1.variableBorrowIndex).to.be.eq(reserveDataBefore.variableBorrowIndex);
    expect(collectorADAIBalanceAfter1).to.be.gt(collectorADAIBalanceBefore);
    expect(reserveDataAfter1.liquidityIndex).to.be.gt(reserveDataBefore.liquidityIndex);

    await increaseTime(10000);

    // "Clean" update, that should not increase the liquidity index, only variable borrow
    await pool
      .connect(depositor.signer)
      .deposit(
        dai.address,
        await convertToCurrencyDecimals(dai.address, '1'),
        depositor.address,
        '0'
      );

    const reserveDataAfter2 = await pool.getReserveData(dai.address);
    const collectorADAIBalanceAfter2 = await aDai.balanceOf(collectorAddress);

    expect(reserveDataAfter2.variableBorrowIndex).to.be.eq(reserveDataAfter1.variableBorrowIndex);
    expect(collectorADAIBalanceAfter2).to.be.gt(collectorADAIBalanceAfter1);
    expect(reserveDataAfter2.liquidityIndex).to.be.eq(reserveDataAfter1.liquidityIndex);
  });
});
