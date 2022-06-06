/**
 * @dev test for yearnCRVVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

const { parseEther } = ethers.utils;

makeSuite('yearnCRVVault', (testEnv: TestEnv) => {
  it('failed deposit for collateral without CRV', async () => {
    const { yearnCRVVault } = testEnv;
    await expect(yearnCRVVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
  });

  it('deposit CRV for collateral', async () => {
    const { yearnCRVVault, deployer, yvcrv, aYVCRV, CRV } = testEnv;
    const ethers = (DRE as any).ethers;

    // Make some test CRV for depositor
    const amountCRVtoDeposit = await convertToCurrencyDecimals(CRV.address, '300');
    const crvOwnerAddress = '0xf39c7f98121cc31840942d374ca9969cb3b1bf3b';
    await impersonateAccountsHardhat([crvOwnerAddress]);
    let signer = await ethers.provider.getSigner(crvOwnerAddress);
    await CRV.connect(signer).transfer(deployer.address, amountCRVtoDeposit);
    
    await CRV.approve(yearnCRVVault.address, amountCRVtoDeposit);

    await yearnCRVVault.depositCollateral(CRV.address, amountCRVtoDeposit);

    expect(await yvcrv.balanceOf(yearnCRVVault.address)).to.be.equal(0);
    expect(await aYVCRV.balanceOf(yearnCRVVault.address)).to.be.equal(0);
    expect(await aYVCRV.balanceOf(deployer.address)).to.be.gte(await convertToCurrencyDecimals(CRV.address, '299.99'));
    expect(await CRV.balanceOf(deployer.address)).to.be.equal(0);
  });

  it('transferring aYVCRV should be success after deposit CRV', async () => {
    const { aYVCRV, users } = testEnv;
    await expect(aYVCRV.transfer(users[0].address, await convertToCurrencyDecimals(aYVCRV.address, '10'))).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, yearnCRVVault, CRV } = testEnv;
    const amountCRVtoDeposit = await convertToCurrencyDecimals(CRV.address, '300');
    await expect(yearnCRVVault.withdrawCollateral(CRV.address, amountCRVtoDeposit, 9900, deployer.address))
      .to.be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, yvcrv, yearnCRVVault, CRV } = testEnv;
    const yvcrvBalanceOfPool = await yvcrv.balanceOf(yearnCRVVault.address);
    const crvBeforeBalanceOfUser = await CRV.balanceOf(deployer.address);
    const crvWithdrawAmount = await convertToCurrencyDecimals(CRV.address, '289');

    await yearnCRVVault.withdrawCollateral(CRV.address, crvWithdrawAmount, 9900, deployer.address);

    const crvCurrentBalanceOfUser = await CRV.balanceOf(deployer.address);
    expect(yvcrvBalanceOfPool).to.be.equal(0);
    expect(crvCurrentBalanceOfUser.sub(crvBeforeBalanceOfUser)).to.be.gte(
      await convertToCurrencyDecimals(CRV.address, '288.9999')
    );
    expect(await CRV.balanceOf(yearnCRVVault.address)).to.be.equal(0);
  });
});

makeSuite('yearnCRVVault - use other coin as collateral', (testEnv) => {
  it('Should revert to use any of coin other than CRV as collateral', async () => {
    const { usdc, yearnCRVVault, yvcrv } = testEnv;
    // TODO @bshevchenko: use Error const instead of 82
    await expect(yearnCRVVault.depositCollateral(yvcrv.address, 1000)).to.be.revertedWith('82');
  });
});

makeSuite('yearnCRVVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for single asset', async () => {
    const { pool, yearnCRVVault, usdc, users, CRV, yvcrv, aYVCRV, aUsdc } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const ethers = (DRE as any).ethers;
    const amountCRVtoDeposit = await convertToCurrencyDecimals(CRV.address, '300');
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

    const crvOwnerAddress = '0xf39c7f98121cc31840942d374ca9969cb3b1bf3b';
    await impersonateAccountsHardhat([crvOwnerAddress]);
    signer = await ethers.provider.getSigner(crvOwnerAddress);
    await CRV.connect(signer).transfer(borrower.address, amountCRVtoDeposit);
    
    // approve protocol to access borrower wallet
    await CRV.connect(borrower.signer).approve(yearnCRVVault.address, amountCRVtoDeposit);

    // deposit collateral to borrow
    await yearnCRVVault.connect(borrower.signer).depositCollateral(CRV.address, amountCRVtoDeposit);
    expect(await yearnCRVVault.getYieldAmount()).to.be.equal(0);

    // To simulate yield in lendingPool, deposit some yvcrv to aYVCRV contract
    const yvcrvOwnerAddress = '0xb825bdea4751e2be520b6df5f694f9242ca7f234';
    const yieldyvcrvAmount = await convertToCurrencyDecimals(CRV.address, '300');
    await impersonateAccountsHardhat([yvcrvOwnerAddress]);
    signer = await ethers.provider.getSigner(yvcrvOwnerAddress);
    await yvcrv.connect(signer).transfer(aYVCRV.address, yieldyvcrvAmount);

    expect(await yearnCRVVault.getYieldAmount()).to.be.gt(await convertToCurrencyDecimals(CRV.address, '299.999'));
    expect(await usdc.balanceOf(yearnCRVVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);

    // process yield, so all yield should be converted to usdc
    await yearnCRVVault.processYield();
    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(amountUSDCtoDeposit);
  });
});

makeSuite('yearnCRVVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for multiple asset', async () => {
    const { pool, yearnCRVVault, usdc, usdt, users, yvcrv, aUsdc, aUsdt, aYVCRV, CRV, dai, aDai } = testEnv;
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

    const crvOwnerAddress = '0xf39c7f98121cc31840942d374ca9969cb3b1bf3b';
    const depositCRV = '300';
    const depositCRVAmount = await convertToCurrencyDecimals(CRV.address, depositCRV);
    //Make some test CRV for borrower
    await impersonateAccountsHardhat([crvOwnerAddress]);
    signer = await ethers.provider.getSigner(crvOwnerAddress);

    //transfer to borrower
    await CRV.connect(signer).transfer(borrower.address, depositCRVAmount);

    //approve protocol to access borrower wallet
    await CRV.connect(borrower.signer).approve(yearnCRVVault.address, depositCRVAmount);

    // deposit collateral to borrow
    await yearnCRVVault.connect(borrower.signer).depositCollateral(CRV.address, depositCRVAmount);
    expect(await yearnCRVVault.getYieldAmount()).to.be.equal(0);

    //To simulate yield in lendingPool, deposit some yvCRV to aYVCRV contract
    const yvcrvOwnerAddress = '0xb825bdea4751e2be520b6df5f694f9242ca7f234';
    const yieldyvCRV = '300';
    const yieldyvCRVAmount = await convertToCurrencyDecimals(yvcrv.address, yieldyvCRV);
    //Make some test yvCRV
    await impersonateAccountsHardhat([yvcrvOwnerAddress]);
    signer = await ethers.provider.getSigner(yvcrvOwnerAddress);
    await yvcrv.connect(signer).transfer(aYVCRV.address, yieldyvCRVAmount);

    expect((await yearnCRVVault.getYieldAmount()).gt(parseEther('299.99'))).to.be.equal(true);
    expect(await usdc.balanceOf(yearnCRVVault.address)).to.be.equal(0);
    expect(await dai.balanceOf(yearnCRVVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
    expect(await aDai.balanceOf(depositor1.address)).to.be.equal(amountDAItoDeposit);
    expect(await aUsdt.balanceOf(depositor2.address)).to.be.equal(amountUSDTtoDeposit);

    // process yield, so all yield should be converted to usdc and dai
    await yearnCRVVault.processYield();
    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(amountUSDCtoDeposit);
    expect(await aDai.balanceOf(depositor1.address)).to.be.gt(amountDAItoDeposit);
    expect(await aUsdt.balanceOf(depositor2.address)).to.be.gt(amountUSDTtoDeposit);
  });
});