import BigNumber from 'bignumber.js';

import { DRE, impersonateAccountsHardhat, increaseTime } from '../../helpers/misc-utils';
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther, ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { makeSuite } from './helpers/make-suite';
import { ProtocolErrors, RateMode } from '../../helpers/types';
import {
  calcExpectedStableDebtTokenBalance,
  calcExpectedVariableDebtTokenBalance,
} from './helpers/utils/calculations';
import { getReserveData, getUserData } from './helpers/utils/helpers';
import { CommonsConfig } from '../../markets/sturdy/commons';

import { parseEther } from 'ethers/lib/utils';

const chai = require('chai');

const { expect } = chai;

makeSuite('LendingPool liquidation - liquidator receiving the underlying asset', (testEnv) => {
  const { INVALID_HF } = ProtocolErrors;

  before('Before LendingPool liquidation: set config', () => {
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
  });

  after('After LendingPool liquidation: reset config', () => {
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });

  // It's impossible to test deactiveReserve because of forked network.
  // it("It's not possible to liquidate on a non-active collateral or a non active principal", async () => {
  //   const { configurator, mootomb_ftm, pool, users, dai, deployer } = testEnv;
  //   const user = users[1];
  //   await configurator.connect(deployer.signer).deactivateReserve(mootomb_ftm.address);

  //   await expect(
  //     pool.liquidationCall(mootomb_ftm.address, dai.address, user.address, parseEther('7000'), false)
  //   ).to.be.revertedWith('2');

  //   await configurator.connect(deployer.signer).activateReserve(mootomb_ftm.address);

  //   await configurator.connect(deployer.signer).deactivateReserve(dai.address);

  //   await expect(
  //     pool.liquidationCall(mootomb_ftm.address, dai.address, user.address, parseEther('7000'), false)
  //   ).to.be.revertedWith('2');

  //   await configurator.connect(deployer.signer).activateReserve(dai.address);
  // });

  it('Deposits TOMB_FTM_LP, borrows DAI', async () => {
    const { dai, users, pool, oracle, TombFtmBeefyVault, deployer, TOMB_FTM_LP } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const ethers = (DRE as any).ethers;

    //user 1 deposits 7000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '7000');
    await dai.connect(deployer.signer).transfer(depositor.address, amountDAItoDeposit);

    //approve protocol to access depositor wallet
    await dai.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool
      .connect(depositor.signer)
      .deposit(dai.address, amountDAItoDeposit, depositor.address, '0');

    //user 2 deposits 100 TOMB_FTM_LP
    const amountTombFtmLPtoDeposit = ethers.utils.parseEther('100');
    await TOMB_FTM_LP.connect(deployer.signer).transfer(borrower.address, amountTombFtmLPtoDeposit);

    //approve protocol to access borrower wallet
    await TOMB_FTM_LP.connect(borrower.signer).approve(TombFtmBeefyVault.address, APPROVAL_AMOUNT_LENDING_POOL);

    await TombFtmBeefyVault
      .connect(borrower.signer)
      .depositCollateral(TOMB_FTM_LP.address, amountTombFtmLPtoDeposit);

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
      '7500',
      INVALID_HF
    );
  });

  it('Drop the health factor below 1', async () => {
    const { dai, users, pool, oracle, deployer } = testEnv;
    const borrower = users[1];

    const daiPrice = await oracle.getAssetPrice(dai.address);

    await oracle
      .connect(deployer.signer)
      .setAssetPrice(dai.address, new BigNumber(daiPrice.toString()).multipliedBy(1.5).toFixed(0));

    const userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
      oneEther.toFixed(0),
      INVALID_HF
    );
  });

  it('Liquidates the borrow', async () => {
    const { dai, mootomb_ftm, TOMB_FTM_LP, users, pool, oracle, helpersContract, deployer } = testEnv;
    const liquidator = users[3];
    const borrower = users[1];

    const ethers = (DRE as any).ethers;

    //user 1 deposits 7000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '7000');
    await dai.connect(deployer.signer).transfer(liquidator.address, amountDAItoDeposit);

    //approve protocol to access the liquidator wallet
    await dai.connect(liquidator.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const daiReserveDataBefore = await getReserveData(helpersContract, dai.address);
    const ethReserveDataBefore = await helpersContract.getReserveData(mootomb_ftm.address);

    const userReserveDataBefore = await getUserData(
      pool,
      helpersContract,
      dai.address,
      borrower.address
    );

    const amountToLiquidate = new BigNumber(userReserveDataBefore.currentVariableDebt.toString())
      .div(2)
      .toFixed(0);

    await increaseTime(100);

    const tx = await pool
      .connect(liquidator.signer)
      .liquidationCall(TOMB_FTM_LP.address, dai.address, borrower.address, amountToLiquidate, false);

    const userReserveDataAfter = await getUserData(
      pool,
      helpersContract,
      dai.address,
      borrower.address
    );

    const daiReserveDataAfter = await helpersContract.getReserveData(dai.address);
    const ethReserveDataAfter = await helpersContract.getReserveData(mootomb_ftm.address);

    const collateralPrice = await oracle.getAssetPrice(mootomb_ftm.address);
    const principalPrice = await oracle.getAssetPrice(dai.address);

    const collateralDecimals = (
      await helpersContract.getReserveConfigurationData(mootomb_ftm.address)
    ).decimals.toString();
    const principalDecimals = (
      await helpersContract.getReserveConfigurationData(dai.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
      .times(new BigNumber(amountToLiquidate).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(
        new BigNumber(collateralPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
      )
      .div(100)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    if (!tx.blockNumber) {
      expect(false, 'Invalid block number');
      return;
    }
    const txTimestamp = new BigNumber((await ethers.provider.getBlock(tx.blockNumber)).timestamp);

    const variableDebtBeforeTx = calcExpectedVariableDebtTokenBalance(
      daiReserveDataBefore,
      userReserveDataBefore,
      txTimestamp
    );

    expect(userReserveDataAfter.currentVariableDebt.toString()).to.be.bignumber.almostEqual(
      variableDebtBeforeTx.minus(amountToLiquidate).toFixed(0),
      'Invalid user debt after liquidation'
    );

    //the liquidity index of the principal reserve needs to be bigger than the index before
    expect(daiReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gte(
      daiReserveDataBefore.liquidityIndex.toString(),
      'Invalid liquidity index'
    );

    //the principal APY after a liquidation needs to be lower than the APY before
    expect(daiReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lte(
      daiReserveDataBefore.liquidityRate.toString(),
      'Invalid liquidity APY'
    );

    expect(daiReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(daiReserveDataBefore.availableLiquidity.toString())
        .plus(amountToLiquidate)
        .toFixed(0),
      'Invalid principal available liquidity'
    );

    // expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
    //   new BigNumber(ethReserveDataBefore.availableLiquidity.toString())
    //     .minus(expectedCollateralLiquidated)
    //     .toFixed(0),
    //   'Invalid collateral available liquidity'
    // );

    expect(
      new BigNumber(ethReserveDataBefore.availableLiquidity.toString())
        .minus(expectedCollateralLiquidated)
        .minus(ethReserveDataAfter.availableLiquidity.toString())
        .toString()
    ).to.be.bignumber.gte(
      ethers.utils.parseEther('0.015'),
      'Invalid collateral available liquidity'
    );
  });

  it('User 3 deposits 7000 USDC, user 4 100 TOMB_FTM_LP, user 4 borrows - drops HF, liquidates the borrow', async () => {
    const { usdc, users, pool, oracle, TOMB_FTM_LP, helpersContract, TombFtmBeefyVault, deployer, mootomb_ftm } = testEnv;

    const depositor = users[3];
    const borrower = users[4];
    const liquidator = users[5];

    const ethers = (DRE as any).ethers;
    await usdc
      .connect(deployer.signer)
      .transfer(depositor.address, await convertToCurrencyDecimals(usdc.address, '7000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //depositor deposits 7000 USDC
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '7000');

    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    //borrower deposits 100 BOTOMB_FTM_LPO
    const amountTombFtmLPtoDeposit = await convertToCurrencyDecimals(TOMB_FTM_LP.address, '100');
    await TOMB_FTM_LP.connect(deployer.signer).transfer(borrower.address, amountTombFtmLPtoDeposit);

    //approve protocol to access borrower wallet
    await TOMB_FTM_LP.connect(borrower.signer).approve(TombFtmBeefyVault.address, APPROVAL_AMOUNT_LENDING_POOL);

    await TombFtmBeefyVault.connect(borrower.signer).depositCollateral(TOMB_FTM_LP.address, amountTombFtmLPtoDeposit);

    //borrower borrows
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
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    //drops HF below 1
    await oracle
      .connect(deployer.signer)
      .setAssetPrice(
        usdc.address,
        new BigNumber(usdcPrice.toString()).multipliedBy(1.5).toFixed(0)
      );

    //mints usdc to the liquidator
    await usdc
      .connect(deployer.signer)
      .transfer(liquidator.address, await convertToCurrencyDecimals(usdc.address, '7000'));

    //approve protocol to access depositor wallet
    await usdc.connect(liquidator.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const userReserveDataBefore = await helpersContract.getUserReserveData(
      usdc.address,
      borrower.address
    );

    const usdcReserveDataBefore = await helpersContract.getReserveData(usdc.address);
    const ethReserveDataBefore = await helpersContract.getReserveData(mootomb_ftm.address);

    const amountToLiquidate = ethers.BigNumber.from(
      userReserveDataBefore.currentVariableDebt.toString()
    )
      .div(2)
      .toString();

    await pool
      .connect(liquidator.signer)
      .liquidationCall(TOMB_FTM_LP.address, usdc.address, borrower.address, amountToLiquidate, false);

    const userReserveDataAfter = await helpersContract.getUserReserveData(
      usdc.address,
      borrower.address
    );

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    const usdcReserveDataAfter = await helpersContract.getReserveData(usdc.address);
    const ethReserveDataAfter = await helpersContract.getReserveData(mootomb_ftm.address);

    const collateralPrice = await oracle.getAssetPrice(mootomb_ftm.address);
    const principalPrice = await oracle.getAssetPrice(usdc.address);

    const collateralDecimals = (
      await helpersContract.getReserveConfigurationData(mootomb_ftm.address)
    ).decimals.toString();
    const principalDecimals = (
      await helpersContract.getReserveConfigurationData(usdc.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
      .times(new BigNumber(amountToLiquidate).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(
        new BigNumber(collateralPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
      )
      .div(100)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    // expect(userGlobalDataAfter.healthFactor.toString()).to.be.bignumber.gt(
    //   oneEther.toFixed(0),
    //   'Invalid health factor'
    // );

    expect(userReserveDataAfter.currentVariableDebt.toString()).to.be.bignumber.almostEqual(
      new BigNumber(userReserveDataBefore.currentVariableDebt.toString())
        .minus(amountToLiquidate)
        .toFixed(0),
      'Invalid user borrow balance after liquidation'
    );

    //the liquidity index of the principal reserve needs to be bigger than the index before
    expect(usdcReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gte(
      usdcReserveDataBefore.liquidityIndex.toString(),
      'Invalid liquidity index'
    );

    //the principal APY after a liquidation needs to be lower than the APY before
    expect(usdcReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lte(
      usdcReserveDataBefore.liquidityRate.toString(),
      'Invalid liquidity APY'
    );

    expect(usdcReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(usdcReserveDataBefore.availableLiquidity.toString())
        .plus(amountToLiquidate)
        .toFixed(0),
      'Invalid principal available liquidity'
    );

    // expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
    //   new BigNumber(ethReserveDataBefore.availableLiquidity.toString())
    //     .minus(expectedCollateralLiquidated)
    //     .toFixed(0),
    //   'Invalid collateral available liquidity'
    // );

    expect(
      new BigNumber(ethReserveDataBefore.availableLiquidity.toString())
        .minus(expectedCollateralLiquidated)
        .minus(ethReserveDataAfter.availableLiquidity.toString())
        .toString()
    ).to.be.bignumber.gte(
      ethers.utils.parseEther('0.015'),
      'Invalid collateral available liquidity'
    );
  });
});
