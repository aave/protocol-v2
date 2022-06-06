import BigNumber from 'bignumber.js';

import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { makeSuite } from './helpers/make-suite';
import { ProtocolErrors, RateMode } from '../../helpers/types';
import { calcExpectedVariableDebtTokenBalance } from './helpers/utils/calculations';
import { getUserData, getReserveData } from './helpers/utils/helpers';

const chai = require('chai');
const { expect } = chai;
const hre = require("hardhat");

makeSuite('LendingPool liquidation - liquidator receiving aToken', (testEnv) => {
  const {
    LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD,
    INVALID_HF,
    LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER,
    LPCM_COLLATERAL_CANNOT_BE_LIQUIDATED,
    LP_IS_PAUSED,
  } = ProtocolErrors;

  it('Deposits BASED_MIMATIC_LP, borrows DAI/Check liquidation fails because health factor is above 1', async () => {
    const { dai, users, pool, oracle, BasedMiMaticBeefyVault, deployer, BASED_MIMATIC_LP } = testEnv;
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

    const amountBasedMiMaticLPtoDeposit = await convertToCurrencyDecimals(BASED_MIMATIC_LP.address, '1');

    //prepare BASED_MIMATIC_LP to deposit
    await BASED_MIMATIC_LP.connect(deployer.signer).transfer(borrower.address, amountBasedMiMaticLPtoDeposit);

    //approve protocol to access borrower wallet
    await BASED_MIMATIC_LP.connect(borrower.signer).approve(BasedMiMaticBeefyVault.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 2 deposits 1 BASED_MIMATIC_LP
    await BasedMiMaticBeefyVault.connect(borrower.signer).depositCollateral(BASED_MIMATIC_LP.address, amountBasedMiMaticLPtoDeposit);

    //user 2 borrows
    const userGlobalData = await pool.connect(depositor.signer).getUserAccountData(borrower.address);
    const daiPrice = await oracle.getAssetPrice(dai.address);

    const amountDAIToBorrow = await convertToCurrencyDecimals(
      dai.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(daiPrice.toString())
        .multipliedBy(0.95)
        .toFixed(3)
    );
    await pool
      .connect(borrower.signer)
      .borrow(dai.address, amountDAIToBorrow, RateMode.Variable, '0', borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
      '7500',
      'Invalid liquidation threshold'
    );

    //someone tries to liquidate user 2
    await expect(
      pool.liquidationCall(BASED_MIMATIC_LP.address, dai.address, borrower.address, 1, true)
    ).to.be.revertedWith(LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD);
  });

  it('Drop the health factor below 1', async () => {
    const { dai, users, pool, oracle } = testEnv;
    const borrower = users[1];

    const daiPrice = await oracle.getAssetPrice(dai.address);

    await oracle.setAssetPrice(
      dai.address,
      new BigNumber(daiPrice.toString()).multipliedBy(1.5).toFixed(0)
    );

    const userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
      oneEther.toString(),
      INVALID_HF
    );
  });

  it('Tries to liquidate a different currency than the loan principal', async () => {
    const { pool, users, BASED_MIMATIC_LP, usdc } = testEnv;
    const borrower = users[1];
    //user 2 tries to borrow
    await expect(
      pool.liquidationCall(BASED_MIMATIC_LP.address, usdc.address, borrower.address, oneEther.toString(), true)
    ).revertedWith(LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER);
  });

  it('Tries to liquidate a different collateral than the borrower collateral', async () => {
    const { pool, dai, WETH, users } = testEnv;
    const borrower = users[1];

    await expect(
      pool.liquidationCall(WETH.address, dai.address, borrower.address, oneEther.toString(), true)
    ).revertedWith(LPCM_COLLATERAL_CANNOT_BE_LIQUIDATED);
  });

  it('Liquidates the borrow', async () => {
    const { pool, dai, BASED_MIMATIC_LP, moobased_mimatic, users, oracle, helpersContract, deployer } = testEnv;
    const borrower = users[1];
    const ethers = (DRE as any).ethers;

    //approve protocol to access depositor wallet
    await dai.connect(deployer.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const daiReserveDataBefore = await getReserveData(helpersContract, dai.address);
    const ethReserveDataBefore = await helpersContract.getReserveData(moobased_mimatic.address);

    const userReserveDataBefore = await getUserData(
      pool,
      helpersContract,
      dai.address,
      borrower.address
    );

    const amountToLiquidate = new BigNumber(userReserveDataBefore.currentVariableDebt.toString())
      .div(2)
      .toFixed(0);

    const tx = await pool
      .connect(deployer.signer)
      .liquidationCall(BASED_MIMATIC_LP.address, dai.address, borrower.address, amountToLiquidate, true);

    const userReserveDataAfter = await helpersContract.getUserReserveData(
      dai.address,
      borrower.address
    );

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    const daiReserveDataAfter = await helpersContract.getReserveData(dai.address);
    const ethReserveDataAfter = await helpersContract.getReserveData(moobased_mimatic.address);

    const collateralPrice = (await oracle.getAssetPrice(BASED_MIMATIC_LP.address)).toString();
    const principalPrice = (await oracle.getAssetPrice(dai.address)).toString();

    const collateralDecimals = (
      await helpersContract.getReserveConfigurationData(moobased_mimatic.address)
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

    const txTimestamp = new BigNumber((await ethers.provider.getBlock(tx.blockNumber)).timestamp);

    const variableDebtBeforeTx = calcExpectedVariableDebtTokenBalance(
      daiReserveDataBefore,
      userReserveDataBefore,
      txTimestamp
    );

    // expect(userGlobalDataAfter.healthFactor.toString()).to.be.bignumber.gt(
    //   oneEther.toFixed(0),
    //   'Invalid health factor'
    // );

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
    expect(daiReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lte(
      daiReserveDataBefore.liquidityRate.toString(),
      'Invalid liquidity APY'
    );

    expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(ethReserveDataBefore.availableLiquidity.toString()).toFixed(0),
      'Invalid collateral available liquidity'
    );

    expect(
      (await helpersContract.getUserReserveData(moobased_mimatic.address, deployer.address))
        .usageAsCollateralEnabled
    ).to.be.true;
  });

  it('User 3 deposits 7000 USDC, user 4 1 BASED_MIMATIC_LP, user 4 borrows - drops HF, liquidates the borrow', async () => {
    const { users, pool, usdc, oracle, BASED_MIMATIC_LP, moobased_mimatic, helpersContract, BasedMiMaticBeefyVault, deployer } = testEnv;
    const depositor = users[3];
    const borrower = users[4];

    const ethers = (DRE as any).ethers;
    await usdc
      .connect(deployer.signer)
      .transfer(depositor.address, await convertToCurrencyDecimals(usdc.address, '7000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 3 deposits 7000 USDC
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '7000');

    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    //user 4 deposits 1 BASED_MIMATIC_LP
    const amountBasedMiMaticLPtoDeposit = await convertToCurrencyDecimals(BASED_MIMATIC_LP.address, '1');
    await BASED_MIMATIC_LP.connect(deployer.signer).transfer(borrower.address, amountBasedMiMaticLPtoDeposit);

    //approve protocol to access borrower wallet
    await BASED_MIMATIC_LP.connect(borrower.signer).approve(BasedMiMaticBeefyVault.address, APPROVAL_AMOUNT_LENDING_POOL);

    await BasedMiMaticBeefyVault.connect(borrower.signer).depositCollateral(BASED_MIMATIC_LP.address, amountBasedMiMaticLPtoDeposit);

    //user 4 borrows
    const userGlobalData = await pool.getUserAccountData(borrower.address);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.9502)
        .toFixed(3)
    );

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    //drops HF below 1
    await oracle.setAssetPrice(
      usdc.address,
      new BigNumber(usdcPrice.toString()).multipliedBy(1.5).toFixed(0)
    );

    await usdc
      .connect(deployer.signer)
      .transfer(deployer.address, await convertToCurrencyDecimals(usdc.address, '7000'));

    //approve protocol to access depositor wallet
    await usdc.connect(deployer.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const userReserveDataBefore = await helpersContract.getUserReserveData(
      usdc.address,
      borrower.address
    );

    const usdcReserveDataBefore = await helpersContract.getReserveData(usdc.address);
    const ethReserveDataBefore = await helpersContract.getReserveData(moobased_mimatic.address);

    const amountToLiquidate = new BigNumber(userReserveDataBefore.currentVariableDebt.toString())
      .multipliedBy(0.5)
      .toFixed(0);

    await pool
      .connect(deployer.signer)
      .liquidationCall(BASED_MIMATIC_LP.address, usdc.address, borrower.address, amountToLiquidate, true);

    const userReserveDataAfter = await helpersContract.getUserReserveData(
      usdc.address,
      borrower.address
    );

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    const usdcReserveDataAfter = await helpersContract.getReserveData(usdc.address);
    const ethReserveDataAfter = await helpersContract.getReserveData(moobased_mimatic.address);

    const collateralPrice = (await oracle.getAssetPrice(BASED_MIMATIC_LP.address)).toString();
    const principalPrice = (await oracle.getAssetPrice(usdc.address)).toString();

    const collateralDecimals = (
      await helpersContract.getReserveConfigurationData(moobased_mimatic.address)
    ).decimals.toString();
    const principalDecimals = (
      await helpersContract.getReserveConfigurationData(usdc.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice)
      .times(new BigNumber(amountToLiquidate).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(new BigNumber(collateralPrice).times(new BigNumber(10).pow(principalDecimals)))
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
    expect(usdcReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lte(
      usdcReserveDataBefore.liquidityRate.toString(),
      'Invalid liquidity APY'
    );

    expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(ethReserveDataBefore.availableLiquidity.toString()).toFixed(0),
      'Invalid collateral available liquidity'
    );
  });
});
