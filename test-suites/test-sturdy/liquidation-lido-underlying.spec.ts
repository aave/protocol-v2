import BigNumber from 'bignumber.js';

import { DRE, impersonateAccountsHardhat, increaseTime } from '../../helpers/misc-utils';
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from '../../helpers/constants';
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
import { getLendingPoolConfiguratorProxy } from '../../helpers/contracts-getters';

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

  // it("It's not possible to liquidate on a non-active collateral or a non active principal", async () => {
  //   const { configurator, lido, pool, users, dai, deployer } = testEnv;
  //   const user = users[1];
  //   await configurator.connect(deployer.signer).deactivateReserve(lido.address);

  //   await expect(
  //     pool.liquidationCall(lido.address, dai.address, user.address, parseEther('7000'), false)
  //   ).to.be.revertedWith('2');

  //   await configurator.connect(deployer.signer).activateReserve(lido.address);

  //   await configurator.connect(deployer.signer).deactivateReserve(dai.address);

  //   await expect(
  //     pool.liquidationCall(lido.address, dai.address, user.address, parseEther('7000'), false)
  //   ).to.be.revertedWith('2');

  //   await configurator.connect(deployer.signer).activateReserve(dai.address);
  // });

  it('Deposits stETH, borrows DAI', async () => {
    const { dai, lido, users, pool, oracle, lidoVault, deployer } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const ethers = (DRE as any).ethers;

    //user 1 deposits 3500 DAI
    const daiOwnerAddress = '0xC2c7D100d234D23cd7233066a5FEE97f56DB171C';

    await impersonateAccountsHardhat([daiOwnerAddress]);
    let signer = await ethers.provider.getSigner(daiOwnerAddress);
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '3500');
    await dai.connect(signer).transfer(depositor.address, amountDAItoDeposit);

    //approve protocol to access depositor wallet
    await dai.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool
      .connect(depositor.signer)
      .deposit(dai.address, amountDAItoDeposit, depositor.address, '0');
    //user 2 deposits 1 ETH
    const amountETHtoDeposit = await convertToCurrencyDecimals(lido.address, '1');
    const stETHOwnerAddress = '0x06920C9fC643De77B99cB7670A944AD31eaAA260';
    await impersonateAccountsHardhat([stETHOwnerAddress]);
    signer = await ethers.provider.getSigner(stETHOwnerAddress);

    await lido.connect(signer).transfer(borrower.address, amountETHtoDeposit);

    //approve protocol to access the borrower wallet
    await lido.connect(borrower.signer).approve(lidoVault.address, APPROVAL_AMOUNT_LENDING_POOL);

    await lidoVault.connect(borrower.signer).depositCollateral(lido.address, amountETHtoDeposit);

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
    const { dai, lido, users, pool, oracle, deployer } = testEnv;
    const borrower = users[1];

    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.configureReserveAsCollateral(lido.address, '4000', '4500', '10500');

    const userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
      oneEther.toFixed(0),
      INVALID_HF
    );
  });

  it('Liquidates the borrow', async () => {
    const { dai, lido, users, pool, oracle, helpersContract, deployer } = testEnv;
    const liquidator = users[3];
    const borrower = users[1];

    const ethers = (DRE as any).ethers;

    //user 1 deposits 3500 DAI
    const daiOwnerAddress = '0xC2c7D100d234D23cd7233066a5FEE97f56DB171C';

    await impersonateAccountsHardhat([daiOwnerAddress]);
    let signer = await ethers.provider.getSigner(daiOwnerAddress);
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '3500');
    await dai.connect(signer).transfer(liquidator.address, amountDAItoDeposit);

    //approve protocol to access the liquidator wallet
    await dai.connect(liquidator.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const daiReserveDataBefore = await getReserveData(helpersContract, dai.address);
    const ethReserveDataBefore = await helpersContract.getReserveData(lido.address);

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
      .liquidationCall(lido.address, dai.address, borrower.address, amountToLiquidate, false);

    const userReserveDataAfter = await getUserData(
      pool,
      helpersContract,
      dai.address,
      borrower.address
    );

    const daiReserveDataAfter = await helpersContract.getReserveData(dai.address);
    const ethReserveDataAfter = await helpersContract.getReserveData(lido.address);

    const collateralPrice = await oracle.getAssetPrice(lido.address);
    const principalPrice = await oracle.getAssetPrice(dai.address);

    const collateralDecimals = (
      await helpersContract.getReserveConfigurationData(lido.address)
    ).decimals.toString();
    const principalDecimals = (
      await helpersContract.getReserveConfigurationData(dai.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
      .times(new BigNumber(amountToLiquidate))
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
      ethers.utils.parseEther('0.012'),
      'Invalid collateral available liquidity'
    );
  });

  it('User 3 deposits 7000 USDC, user 4 1 stETH, user 4 borrows - drops HF, liquidates the borrow', async () => {
    const { usdc, users, pool, oracle, lido, helpersContract, lidoVault, deployer } = testEnv;

    const depositor = users[3];
    const borrower = users[4];
    const liquidator = users[5];

    const ethers = (DRE as any).ethers;
    const usdcOwnerAddress = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503';
    await impersonateAccountsHardhat([usdcOwnerAddress]);
    let signer = await ethers.provider.getSigner(usdcOwnerAddress);
    await usdc
      .connect(signer)
      .transfer(depositor.address, await convertToCurrencyDecimals(usdc.address, '7000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //depositor deposits 7000 USDC
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '7000');

    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    //borrower deposits 1 ETH
    const amountETHtoDeposit = await convertToCurrencyDecimals(lido.address, '1');
    const stETHOwnerAddress = '0x06920C9fC643De77B99cB7670A944AD31eaAA260';
    await impersonateAccountsHardhat([stETHOwnerAddress]);
    signer = await ethers.provider.getSigner(stETHOwnerAddress);
    await lido.connect(signer).transfer(borrower.address, amountETHtoDeposit);

    //approve protocol to access the borrower wallet
    await lido.connect(borrower.signer).approve(lidoVault.address, APPROVAL_AMOUNT_LENDING_POOL);

    await lidoVault.connect(borrower.signer).depositCollateral(lido.address, amountETHtoDeposit);

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

    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.configureReserveAsCollateral(lido.address, '2000', '2500', '10500');

    //mints usdc to the liquidator
    await impersonateAccountsHardhat([usdcOwnerAddress]);
    signer = await ethers.provider.getSigner(usdcOwnerAddress);
    await usdc
      .connect(signer)
      .transfer(liquidator.address, await convertToCurrencyDecimals(usdc.address, '7000'));

    //approve protocol to access depositor wallet
    await usdc.connect(liquidator.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const userReserveDataBefore = await helpersContract.getUserReserveData(
      usdc.address,
      borrower.address
    );

    const usdcReserveDataBefore = await helpersContract.getReserveData(usdc.address);
    const ethReserveDataBefore = await helpersContract.getReserveData(lido.address);

    const amountToLiquidate = ethers.BigNumber.from(
      userReserveDataBefore.currentVariableDebt.toString()
    )
      .div(2)
      .toString();

    await pool
      .connect(liquidator.signer)
      .liquidationCall(lido.address, usdc.address, borrower.address, amountToLiquidate, false);

    const userReserveDataAfter = await helpersContract.getUserReserveData(
      usdc.address,
      borrower.address
    );

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    const usdcReserveDataAfter = await helpersContract.getReserveData(usdc.address);
    const ethReserveDataAfter = await helpersContract.getReserveData(lido.address);

    const collateralPrice = await oracle.getAssetPrice(lido.address);
    const principalPrice = await oracle.getAssetPrice(usdc.address);

    const collateralDecimals = (
      await helpersContract.getReserveConfigurationData(lido.address)
    ).decimals.toString();
    const principalDecimals = (
      await helpersContract.getReserveConfigurationData(usdc.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
      .times(new BigNumber(amountToLiquidate))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(
        new BigNumber(collateralPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
      )
      .div(100)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    expect(userGlobalDataAfter.healthFactor.toString()).to.be.bignumber.gt(
      oneEther.toFixed(0),
      'Invalid health factor'
    );

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
      ethers.utils.parseEther('0.001'),
      'Invalid collateral available liquidity'
    );
  });
});
