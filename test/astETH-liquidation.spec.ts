import BigNumber from 'bignumber.js';

import { DRE } from '../helpers/misc-utils';
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from '../helpers/constants';
import { convertToCurrencyDecimals } from '../helpers/contracts-helpers';
import { makeSuite } from './helpers/make-suite';
import { ProtocolErrors, RateMode } from '../helpers/types';
import { calcExpectedVariableDebtTokenBalance } from './helpers/utils/calculations';
import { getUserData, getReserveData } from './helpers/utils/helpers';
import { AStETH } from '../types/AStETH';
import { getAStETH } from '../helpers/contracts-getters';
import { evmSnapshot, evmRevert } from '../helpers/misc-utils';

const chai = require('chai');
const { expect } = chai;
let reserveData, astETH: AStETH, treasuryAddress, evmSnapshotId;

makeSuite('LendingPool liquidation - liquidator receiving aToken', (testEnv) => {
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

  const { LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD, INVALID_HF } = ProtocolErrors;

  it('Deposits stETH, borrows DAI/Check liquidation fails because health factor is above 1', async () => {
    const { dai, stETH, users, pool, oracle } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    //mints DAI to depositor
    await dai.connect(depositor.signer).mint(await convertToCurrencyDecimals(dai.address, '1000'));

    //approve protocol to access depositor wallet
    await dai.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');
    await pool
      .connect(depositor.signer)
      .deposit(dai.address, amountDAItoDeposit, depositor.address, '0');

    const amountETHtoDeposit = await convertToCurrencyDecimals(stETH.address, '1');

    //mints stETH to borrower
    await stETH.connect(borrower.signer).mint(borrower.address, amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await stETH.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 2 deposits 1 stETH
    await pool
      .connect(borrower.signer)
      .deposit(stETH.address, amountETHtoDeposit, borrower.address, '0');

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
      .borrow(dai.address, amountDAIToBorrow, RateMode.Variable, '0', borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
      '4500',
      'Invalid liquidation threshold'
    );

    //someone tries to liquidate user 2
    await expect(
      pool.liquidationCall(stETH.address, dai.address, borrower.address, 1, true)
    ).to.be.revertedWith(LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD);
  });

  it('Drop the health factor below 1', async () => {
    const { dai, users, pool, oracle } = testEnv;
    const borrower = users[1];

    const daiPrice = await oracle.getAssetPrice(dai.address);
    let userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.gt(
      oneEther.toString(),
      INVALID_HF
    );
    await oracle.setAssetPrice(
      dai.address,
      new BigNumber(daiPrice.toString()).multipliedBy(2).toFixed(0)
    );

    userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
      oneEther.toString(),
      INVALID_HF
    );
  });

  it('Liquidates the borrow', async () => {
    const { pool, dai, stETH, users, oracle, helpersContract, deployer } = testEnv;
    const borrower = users[1];

    //mints dai to the caller

    await dai.mint(await convertToCurrencyDecimals(dai.address, '1000'));

    //approve protocol to access depositor wallet
    await dai.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const daiReserveDataBefore = await getReserveData(helpersContract, dai.address);
    const ethReserveDataBefore = await helpersContract.getReserveData(stETH.address);

    const userReserveDataBefore = await getUserData(
      pool,
      helpersContract,
      dai.address,
      borrower.address
    );

    const amountToLiquidate = new BigNumber(userReserveDataBefore.currentVariableDebt.toString())
      .div(2)
      .toFixed(0);

    const tx = await pool.liquidationCall(
      stETH.address,
      dai.address,
      borrower.address,
      amountToLiquidate,
      true
    );

    const userReserveDataAfter = await helpersContract.getUserReserveData(
      dai.address,
      borrower.address
    );

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    const daiReserveDataAfter = await helpersContract.getReserveData(dai.address);
    const ethReserveDataAfter = await helpersContract.getReserveData(stETH.address);

    const collateralPrice = (await oracle.getAssetPrice(stETH.address)).toString();
    const principalPrice = (await oracle.getAssetPrice(dai.address)).toString();

    const collateralDecimals = (
      await helpersContract.getReserveConfigurationData(stETH.address)
    ).decimals.toString();
    const principalDecimals = (
      await helpersContract.getReserveConfigurationData(dai.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice)
      .times(new BigNumber(amountToLiquidate).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(new BigNumber(collateralPrice).times(new BigNumber(10).pow(principalDecimals)))
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    if (!tx.blockNumber) {
      expect(false, 'Invalid block number');
      return;
    }

    const txTimestamp = new BigNumber(
      (await DRE.ethers.provider.getBlock(tx.blockNumber)).timestamp
    );

    const variableDebtBeforeTx = calcExpectedVariableDebtTokenBalance(
      daiReserveDataBefore,
      userReserveDataBefore,
      txTimestamp
    );

    expect(userGlobalDataAfter.healthFactor.toString()).to.be.bignumber.gt(
      oneEther.toFixed(0),
      'Invalid health factor'
    );

    expect(userReserveDataAfter.currentVariableDebt.toString()).to.be.bignumber.almostEqual(
      new BigNumber(variableDebtBeforeTx).minus(amountToLiquidate).toFixed(0),
      'Invalid user borrow balance after liquidation'
    );

    expect(daiReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(daiReserveDataBefore.availableLiquidity.toString())
        .plus(amountToLiquidate)
        .toFixed(0),
      'Invalid principal available liquidity'
    );

    //the liquidity index of the principal reserve needs to be bigger than the index before
    expect(daiReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gte(
      daiReserveDataBefore.liquidityIndex.toString(),
      'Invalid liquidity index'
    );

    //the principal APY after a liquidation needs to be lower than the APY before
    expect(daiReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lt(
      daiReserveDataBefore.liquidityRate.toString(),
      'Invalid liquidity APY'
    );

    expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(ethReserveDataBefore.availableLiquidity.toString()).toFixed(0),
      'Invalid collateral available liquidity'
    );

    expect(
      (await helpersContract.getUserReserveData(stETH.address, deployer.address))
        .usageAsCollateralEnabled
    ).to.be.true;
  });
});
