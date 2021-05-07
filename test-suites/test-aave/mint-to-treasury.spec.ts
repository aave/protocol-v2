import { makeSuite, TestEnv } from './helpers/make-suite';
import { ProtocolErrors, RateMode } from '../../helpers/types';
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther, ONE_YEAR, RAY } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { BigNumber } from 'bignumber.js';
import { MockFlashLoanReceiver } from '../../types/MockFlashLoanReceiver';
import { getMockFlashLoanReceiver } from '../../helpers/contracts-getters';
import { advanceTimeAndBlock, timeLatest, waitForTx } from '../../helpers/misc-utils';
import './helpers/utils/math';
import { calcCompoundedInterest } from './helpers/utils/calculations';
import {getTxCostAndTimestamp } from './helpers/actions';

const { expect } = require('chai');

makeSuite('Mint to treasury', (testEnv: TestEnv) => {
  let _mockFlashLoanReceiver = {} as MockFlashLoanReceiver;

  const {
    LP_IS_PAUSED,
    INVALID_FROM_BALANCE_AFTER_TRANSFER,
    INVALID_TO_BALANCE_AFTER_TRANSFER,
  } = ProtocolErrors;

  before(async () => {
    _mockFlashLoanReceiver = await getMockFlashLoanReceiver();
  });

  it('User 0 deposits 1000 DAI. Borrower borrows 100 DAI. Clock moved forward one year. Calculates and verifies the amount earned by the treasury', async () => {
    const { users, pool, dai, helpersContract } = testEnv;

    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');
    const amountDAItoBorrow = await convertToCurrencyDecimals(dai.address, '100');

    await dai.connect(users[0].signer).mint(amountDAItoDeposit);

    // user 0 deposits 1000 DAI
    await dai.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await pool
      .connect(users[0].signer)
      .deposit(dai.address, amountDAItoDeposit, users[0].address, '0');

    const borrowTx = await waitForTx(await pool
      .connect(users[0].signer)
      .borrow(dai.address, amountDAItoBorrow, RateMode.Variable, '0', users[0].address));

    const {txTimestamp : lastUpdateTimestamp} = await getTxCostAndTimestamp(borrowTx);


    const {
      currentLiquidityRate: liquidityRate,
      currentVariableBorrowRate: variableBorrowRate,
    } = await pool.getReserveData(dai.address);
    const { reserveFactor } = await helpersContract.getReserveConfigurationData(dai.address);

    await advanceTimeAndBlock(parseInt(ONE_YEAR));

    await dai.connect(users[0].signer).mint(amountDAItoDeposit);

    const depositTx = await waitForTx(await pool
      .connect(users[0].signer)
      .deposit(dai.address, amountDAItoDeposit, users[0].address, '0'));

    
    const {txTimestamp : currTimestamp} = await getTxCostAndTimestamp(depositTx);

    const interestNormalized = calcCompoundedInterest(new BigNumber(variableBorrowRate.toString()), currTimestamp, lastUpdateTimestamp).minus(RAY);


    const expectedReserveFactor = new BigNumber(amountDAItoBorrow.toString())
      .rayMul(interestNormalized)
      .times(reserveFactor.toString())
      .div(10000);

    const reserveData = await pool.getReserveData(dai.address);

    console.log(reserveData.accruedToTreasury.toString(), expectedReserveFactor.toString());
  });
});
