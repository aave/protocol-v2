/**
 * @dev test for yearnFBEETSVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

const { parseEther } = ethers.utils;

makeSuite('yearnFBEETSVault', (testEnv: TestEnv) => {
  it('failed deposit for collateral without fBEETS', async () => {
    const { yearnFBEETSVault } = testEnv;
    await expect(yearnFBEETSVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
  });

  it('deposit fBEETS for collateral', async () => {
    const { yearnFBEETSVault, deployer, yvfbeets, aYVFBEETS, fBEETS } = testEnv;
    const ethers = (DRE as any).ethers;

    // Make some test fBEETS for depositor
    const amountfBEETStoDeposit = await convertToCurrencyDecimals(fBEETS.address, '300');
    const fBEETSOwnerAddress = '0xe97178f627268f4cead069237db9f50f66d17d97';
    await impersonateAccountsHardhat([fBEETSOwnerAddress]);
    let signer = await ethers.provider.getSigner(fBEETSOwnerAddress);
    await fBEETS.connect(signer).transfer(deployer.address, amountfBEETStoDeposit);
    
    await fBEETS.approve(yearnFBEETSVault.address, amountfBEETStoDeposit);

    await yearnFBEETSVault.depositCollateral(fBEETS.address, amountfBEETStoDeposit);

    expect(await yvfbeets.balanceOf(yearnFBEETSVault.address)).to.be.equal(0);
    expect(await aYVFBEETS.balanceOf(yearnFBEETSVault.address)).to.be.equal(0);
    expect(await aYVFBEETS.balanceOf(deployer.address)).to.be.gte(await convertToCurrencyDecimals(fBEETS.address, '299.99'));
    expect(await fBEETS.balanceOf(deployer.address)).to.be.equal(0);
  });

  it('transferring aYVFBEETS should be success after deposit fBEETS', async () => {
    const { aYVFBEETS, users } = testEnv;
    await expect(aYVFBEETS.transfer(users[0].address, await convertToCurrencyDecimals(aYVFBEETS.address, '10'))).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, yearnFBEETSVault, fBEETS } = testEnv;
    const amountfBEETStoDeposit = await convertToCurrencyDecimals(fBEETS.address, '300');
    await expect(yearnFBEETSVault.withdrawCollateral(fBEETS.address, amountfBEETStoDeposit, 9900, deployer.address))
      .to.be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, yvfbeets, yearnFBEETSVault, fBEETS } = testEnv;
    const yvfbeetsBalanceOfPool = await yvfbeets.balanceOf(yearnFBEETSVault.address);
    const fBEETSBeforeBalanceOfUser = await fBEETS.balanceOf(deployer.address);
    const fBEETSWithdrawAmount = await convertToCurrencyDecimals(fBEETS.address, '289');

    await yearnFBEETSVault.withdrawCollateral(fBEETS.address, fBEETSWithdrawAmount, 9900, deployer.address);

    const fbeetsCurrentBalanceOfUser = await fBEETS.balanceOf(deployer.address);
    expect(yvfbeetsBalanceOfPool).to.be.equal(0);
    expect(fbeetsCurrentBalanceOfUser.sub(fBEETSBeforeBalanceOfUser)).to.be.gte(
      await convertToCurrencyDecimals(fBEETS.address, '288.9999')
    );
    expect(await fBEETS.balanceOf(yearnFBEETSVault.address)).to.be.equal(0);
  });
});

makeSuite('yearnFBEETSVault - use other coin as collateral', (testEnv) => {
  it('Should revert to use any of coin other than fBEETS as collateral', async () => {
    const { usdc, yearnFBEETSVault, yvfbeets } = testEnv;
    // TODO @bshevchenko: use Error const instead of 82
    await expect(yearnFBEETSVault.depositCollateral(yvfbeets.address, 1000)).to.be.revertedWith('82');
  });
});

makeSuite('yearnFBEETSVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for single asset', async () => {
    const { pool, yearnFBEETSVault, usdc, users, fBEETS, yvfbeets, aYVFBEETS, aUsdc } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const ethers = (DRE as any).ethers;
    const amountfBEETStoDeposit = await convertToCurrencyDecimals(fBEETS.address, '300');
    const usdcOwnerAddress = '0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe';
    const depositUSDC = '7000';

    // Make some test USDC for depositor
    await impersonateAccountsHardhat([usdcOwnerAddress]);
    let signer = await ethers.provider.getSigner(usdcOwnerAddress);
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
    await usdc.connect(signer).Swapin(
      '0x6af483697065dda1e50693750662adb39012699bbdb49d908d682a275a83c4cf', // TODO random tx hash
      depositor.address,
      amountUSDCtoDeposit
    );

    // approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, amountUSDCtoDeposit);

    // Supplier deposits USDC
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    const fBEETSOwnerAddress = '0xe97178f627268f4cead069237db9f50f66d17d97';
    await impersonateAccountsHardhat([fBEETSOwnerAddress]);
    signer = await ethers.provider.getSigner(fBEETSOwnerAddress);
    await fBEETS.connect(signer).transfer(borrower.address, amountfBEETStoDeposit);
    
    // approve protocol to access borrower wallet
    await fBEETS.connect(borrower.signer).approve(yearnFBEETSVault.address, amountfBEETStoDeposit);

    // deposit collateral to borrow
    await yearnFBEETSVault.connect(borrower.signer).depositCollateral(fBEETS.address, amountfBEETStoDeposit);
    expect(await yearnFBEETSVault.getYieldAmount()).to.be.equal(0);

    // To simulate yield in lendingPool, deposit some yvfbeets to aYVFBEETS contract
    const yvfbeetsOwnerAddress = '0x1f93b58fb2cf33cfb68e73e94ad6dd7829b1586d';
    const yieldyvfbeetsAmount = await convertToCurrencyDecimals(yvfbeets.address, '300');
    await impersonateAccountsHardhat([yvfbeetsOwnerAddress]);
    signer = await ethers.provider.getSigner(yvfbeetsOwnerAddress);
    await yvfbeets.connect(signer).transfer(aYVFBEETS.address, yieldyvfbeetsAmount);

    expect(await yearnFBEETSVault.getYieldAmount()).to.be.gt(await convertToCurrencyDecimals(fBEETS.address, '299.999'));
    expect(await usdc.balanceOf(yearnFBEETSVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);

    // process yield, so all yield should be converted to usdc
    await yearnFBEETSVault.processYield();
    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(amountUSDCtoDeposit);
  });
});

makeSuite('yearnFBEETSVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for multiple asset', async () => {
    const { pool, yearnFBEETSVault, usdc, usdt, users, yvfbeets, aUsdc, aUsdt, aYVFBEETS, fBEETS, dai, aDai } = testEnv;
    const depositor = users[0];
    const depositor1 = users[1];
    const depositor2 = users[2];
    const borrower = users[3];
    const ethers = (DRE as any).ethers;
    const usdcOwnerAddress = '0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe';
    const depositUSDC = '7000';
    //Make some test USDC for depositor
    await impersonateAccountsHardhat([usdcOwnerAddress]);
    let signer = await ethers.provider.getSigner(usdcOwnerAddress);
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
    await usdc.connect(signer).Swapin(
      '0x6af483697065dda1e50693750662adb39012699bbdb49d908d682a275a83c4cf', // TODO random tx hash
      depositor.address,
      amountUSDCtoDeposit
    );

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, amountUSDCtoDeposit);

    //Supplier  deposits 7000 USDC
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    const daiOwnerAddress = '0x7182a1b9cf88e87b83e936d3553c91f9e7bebdd7';
    const depositDAI = '7000';
    //Make some test DAI for depositor
    await impersonateAccountsHardhat([daiOwnerAddress]);
    signer = await ethers.provider.getSigner(daiOwnerAddress);
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, depositDAI);
    await dai.connect(signer).transfer(depositor1.address, amountDAItoDeposit);

    //approve protocol to access depositor wallet
    await dai.connect(depositor1.signer).approve(pool.address, amountDAItoDeposit);

    //Supplier deposits 7000 DAI
    await pool
      .connect(depositor1.signer)
      .deposit(dai.address, amountDAItoDeposit, depositor1.address, '0');

    const usdtOwnerAddress = '0x93C08a3168fC469F3fC165cd3A471D19a37ca19e';
    const depositUSDT = '3500';
    //Make some test USDT for depositor
    await impersonateAccountsHardhat([usdtOwnerAddress]);
    signer = await ethers.provider.getSigner(usdtOwnerAddress);
    const amountUSDTtoDeposit = await convertToCurrencyDecimals(usdt.address, depositUSDT);
    await usdt.connect(signer).transfer(depositor2.address, amountUSDTtoDeposit);

    //approve protocol to access depositor wallet
    await usdt.connect(depositor2.signer).approve(pool.address, amountUSDTtoDeposit);

    //Supplier  deposits 3500 USDT
    await pool
      .connect(depositor2.signer)
      .deposit(usdt.address, amountUSDTtoDeposit, depositor2.address, '0');

    const fBEETSOwnerAddress = '0xe97178f627268f4cead069237db9f50f66d17d97';
    const depositfBEETS = '300';
    const depositfBEETSAmount = await convertToCurrencyDecimals(fBEETS.address, depositfBEETS);
    //Make some test fBEETS for borrower
    await impersonateAccountsHardhat([fBEETSOwnerAddress]);
    signer = await ethers.provider.getSigner(fBEETSOwnerAddress);

    //transfer to borrower
    await fBEETS.connect(signer).transfer(borrower.address, depositfBEETSAmount);

    //approve protocol to access borrower wallet
    await fBEETS.connect(borrower.signer).approve(yearnFBEETSVault.address, depositfBEETSAmount);

    // deposit collateral to borrow
    await yearnFBEETSVault.connect(borrower.signer).depositCollateral(fBEETS.address, depositfBEETSAmount);
    expect(await yearnFBEETSVault.getYieldAmount()).to.be.equal(0);

    //To simulate yield in lendingPool, deposit some yvfBEETS to aYVFBEETS contract
    const yvfbeetsOwnerAddress = '0x1f93b58fb2cf33cfb68e73e94ad6dd7829b1586d';
    const yieldyvfBEETS = '300';
    const yieldyvfBEETSAmount = await convertToCurrencyDecimals(yvfbeets.address, yieldyvfBEETS);
    //Make some test yvfBEETS
    await impersonateAccountsHardhat([yvfbeetsOwnerAddress]);
    signer = await ethers.provider.getSigner(yvfbeetsOwnerAddress);
    await yvfbeets.connect(signer).transfer(aYVFBEETS.address, yieldyvfBEETSAmount);

    expect((await yearnFBEETSVault.getYieldAmount()).gt(parseEther('299.99'))).to.be.equal(true);
    expect(await usdc.balanceOf(yearnFBEETSVault.address)).to.be.equal(0);
    expect(await dai.balanceOf(yearnFBEETSVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
    expect(await aDai.balanceOf(depositor1.address)).to.be.equal(amountDAItoDeposit);
    expect(await aUsdt.balanceOf(depositor2.address)).to.be.equal(amountUSDTtoDeposit);

    // process yield, so all yield should be converted to usdc and dai
    await yearnFBEETSVault.processYield();

    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(amountUSDCtoDeposit);
    expect(await aDai.balanceOf(depositor1.address)).to.be.gt(amountDAItoDeposit);
    expect(await aUsdt.balanceOf(depositor2.address)).to.be.gt(amountUSDTtoDeposit);
  });
});