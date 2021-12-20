import BigNumber from 'bignumber.js';

import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from '../helpers/constants';
import { convertToCurrencyDecimals } from '../helpers/contracts-helpers';
import { makeSuite } from './helpers/make-suite';
import { RateMode } from '../helpers/types';
import { AStETH } from '../types/AStETH';
import { getAStETH } from '../helpers/contracts-getters';
import { evmSnapshot, evmRevert } from '../helpers/misc-utils';

const chai = require('chai');
const { expect } = chai;
let reserveData, astETH: AStETH, treasuryAddress, evmSnapshotId;

makeSuite('LendingPool liquidation happy path', (testEnv) => {
  before(async () => {
    evmSnapshotId = await evmSnapshot();
  });

  after(async () => {
    await evmRevert(evmSnapshotId);
  });
  beforeEach(async () => {
    const { stETH, pool } = testEnv;
    reserveData = await pool.getReserveData(stETH.address);
    astETH = await getAStETH(reserveData.aTokenAddress);
    treasuryAddress = await astETH.RESERVE_TREASURY_ADDRESS();
  });

  it('User 3 deposits 1000 USDC, user 4 1 stETH, user 4 borrows - drops HF, liquidates the borrow', async () => {
    const { users, pool, usdc, oracle, stETH, helpersContract } = testEnv;

    const depositor = users[3];
    const borrower = users[4];

    //mints USDC to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 3 deposits 1000 USDC
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');

    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    //user 4 deposits 1 stETH
    const amountETHtoDeposit = await convertToCurrencyDecimals(stETH.address, '1');

    //mints stETH to borrower
    await stETH.connect(borrower.signer).mint(borrower.address, amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await stETH.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool
      .connect(borrower.signer)
      .deposit(stETH.address, amountETHtoDeposit, borrower.address, '0');

    //user 4 borrows
    const userGlobalData = await pool.getUserAccountData(borrower.address);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.9502)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Stable, '0', borrower.address);

    //drops HF below 1

    await oracle.setAssetPrice(
      usdc.address,
      new BigNumber(usdcPrice.toString()).multipliedBy(2).toFixed(0)
    );

    //mints dai to the liquidator

    await usdc.mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const userReserveDataBefore = await helpersContract.getUserReserveData(
      usdc.address,
      borrower.address
    );

    const usdcReserveDataBefore = await helpersContract.getReserveData(usdc.address);
    const ethReserveDataBefore = await helpersContract.getReserveData(stETH.address);

    const amountToLiquidate = new BigNumber(userReserveDataBefore.currentStableDebt.toString())
      .multipliedBy(0.5)
      .toFixed(0);

    await pool.liquidationCall(
      stETH.address,
      usdc.address,
      borrower.address,
      amountToLiquidate,
      true
    );

    const userReserveDataAfter = await helpersContract.getUserReserveData(
      usdc.address,
      borrower.address
    );

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    const usdcReserveDataAfter = await helpersContract.getReserveData(usdc.address);
    const ethReserveDataAfter = await helpersContract.getReserveData(stETH.address);

    expect(userGlobalDataAfter.healthFactor.toString()).to.be.bignumber.gt(
      oneEther.toFixed(0),
      'Invalid health factor'
    );

    expect(userReserveDataAfter.currentStableDebt.toString()).to.be.bignumber.almostEqual(
      new BigNumber(userReserveDataBefore.currentStableDebt.toString())
        .minus(amountToLiquidate)
        .toFixed(0),
      'Invalid user borrow balance after liquidation'
    );

    expect(usdcReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(usdcReserveDataBefore.availableLiquidity.toString())
        .plus(amountToLiquidate)
        .toFixed(0),
      'Invalid principal available liquidity'
    );

    //the liquidity index of the principal reserve needs to be bigger than the index before
    expect(usdcReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gte(
      usdcReserveDataBefore.liquidityIndex.toString(),
      'Invalid liquidity index'
    );

    //the principal APY after a liquidation needs to be lower than the APY before
    expect(usdcReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lt(
      usdcReserveDataBefore.liquidityRate.toString(),
      'Invalid liquidity APY'
    );

    expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(ethReserveDataBefore.availableLiquidity.toString()).toFixed(0),
      'Invalid collateral available liquidity'
    );
  });
});
