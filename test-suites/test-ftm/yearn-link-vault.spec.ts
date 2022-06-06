/**
 * @dev test for yearnLINKVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

const { parseEther } = ethers.utils;

makeSuite('yearnLINKVault', (testEnv: TestEnv) => {
  it('failed deposit for collateral without LINK', async () => {
    const { yearnLINKVault } = testEnv;
    await expect(yearnLINKVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
  });

  it('deposit LINK for collateral', async () => {
    const { yearnLINKVault, deployer, yvlink, aYVLINK, LINK } = testEnv;
    const ethers = (DRE as any).ethers;

    // Make some test LINK for depositor
    const amountLINKtoDeposit = await convertToCurrencyDecimals(LINK.address, '300');
    const linkOwnerAddress = '0xa75ede99f376dd47f3993bc77037f61b5737c6ea';
    await impersonateAccountsHardhat([linkOwnerAddress]);
    let signer = await ethers.provider.getSigner(linkOwnerAddress);
    await LINK.connect(signer).transfer(deployer.address, amountLINKtoDeposit);
    
    await LINK.approve(yearnLINKVault.address, amountLINKtoDeposit);

    await yearnLINKVault.depositCollateral(LINK.address, amountLINKtoDeposit);

    expect(await yvlink.balanceOf(yearnLINKVault.address)).to.be.equal(0);
    expect(await aYVLINK.balanceOf(yearnLINKVault.address)).to.be.equal(0);
    expect(await aYVLINK.balanceOf(deployer.address)).to.be.gte(await convertToCurrencyDecimals(LINK.address, '299.99'));
    expect(await LINK.balanceOf(deployer.address)).to.be.equal(0);
  });

  it('transferring aYVLINK should be success after deposit LINK', async () => {
    const { aYVLINK, users } = testEnv;
    await expect(aYVLINK.transfer(users[0].address, await convertToCurrencyDecimals(aYVLINK.address, '10'))).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, yearnLINKVault, LINK } = testEnv;
    const amountLINKtoDeposit = await convertToCurrencyDecimals(LINK.address, '300');
    await expect(yearnLINKVault.withdrawCollateral(LINK.address, amountLINKtoDeposit, 9900, deployer.address))
      .to.be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, yvlink, yearnLINKVault, LINK } = testEnv;
    const yvlinkBalanceOfPool = await yvlink.balanceOf(yearnLINKVault.address);
    const linkBeforeBalanceOfUser = await LINK.balanceOf(deployer.address);
    const linkWithdrawAmount = await convertToCurrencyDecimals(LINK.address, '289');

    await yearnLINKVault.withdrawCollateral(LINK.address, linkWithdrawAmount, 9900, deployer.address);

    const linkCurrentBalanceOfUser = await LINK.balanceOf(deployer.address);
    expect(yvlinkBalanceOfPool).to.be.equal(0);
    expect(linkCurrentBalanceOfUser.sub(linkBeforeBalanceOfUser)).to.be.gte(
      await convertToCurrencyDecimals(LINK.address, '288.9999')
    );
    expect(await LINK.balanceOf(yearnLINKVault.address)).to.be.equal(0);
  });
});

makeSuite('yearnLINKVault - use other coin as collateral', (testEnv) => {
  it('Should revert to use any of coin other than LINK as collateral', async () => {
    const { usdc, yearnLINKVault, yvlink } = testEnv;
    // TODO @bshevchenko: use Error const instead of 82
    await expect(yearnLINKVault.depositCollateral(yvlink.address, 1000)).to.be.revertedWith('82');
  });
});

makeSuite('yearnLINKVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for single asset', async () => {
    const { pool, yearnLINKVault, usdc, users, LINK, yvlink, aYVLINK, aUsdc } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const ethers = (DRE as any).ethers;
    const amountLINKtoDeposit = await convertToCurrencyDecimals(LINK.address, '300');
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

    const linkOwnerAddress = '0xa75ede99f376dd47f3993bc77037f61b5737c6ea';
    await impersonateAccountsHardhat([linkOwnerAddress]);
    signer = await ethers.provider.getSigner(linkOwnerAddress);
    await LINK.connect(signer).transfer(borrower.address, amountLINKtoDeposit);
    
    // approve protocol to access borrower wallet
    await LINK.connect(borrower.signer).approve(yearnLINKVault.address, amountLINKtoDeposit);

    // deposit collateral to borrow
    await yearnLINKVault.connect(borrower.signer).depositCollateral(LINK.address, amountLINKtoDeposit);
    expect(await yearnLINKVault.getYieldAmount()).to.be.equal(0);

    // To simulate yield in lendingPool, deposit some yvlink to aYVLINK contract
    const yvlinkOwnerAddress = '0xdbfb0785366262f4736bcb5757cb20f0065c4dd1';
    const yieldyvlinkAmount = await convertToCurrencyDecimals(LINK.address, '300');
    await impersonateAccountsHardhat([yvlinkOwnerAddress]);
    signer = await ethers.provider.getSigner(yvlinkOwnerAddress);
    await yvlink.connect(signer).transfer(aYVLINK.address, yieldyvlinkAmount);

    expect(await yearnLINKVault.getYieldAmount()).to.be.gt(await convertToCurrencyDecimals(LINK.address, '299.999'));
    expect(await usdc.balanceOf(yearnLINKVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);

    // process yield, so all yield should be converted to usdc
    await yearnLINKVault.processYield();
    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(amountUSDCtoDeposit);
  });
});

makeSuite('yearnLINKVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for multiple asset', async () => {
    const { pool, yearnLINKVault, usdc, usdt, users, yvlink, aUsdc, aUsdt, aYVLINK, LINK, dai, aDai } = testEnv;
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

    const linkOwnerAddress = '0xa75ede99f376dd47f3993bc77037f61b5737c6ea';
    const depositLINK = '300';
    const depositLINKAmount = await convertToCurrencyDecimals(LINK.address, depositLINK);
    //Make some test LINK for borrower
    await impersonateAccountsHardhat([linkOwnerAddress]);
    signer = await ethers.provider.getSigner(linkOwnerAddress);

    //transfer to borrower
    await LINK.connect(signer).transfer(borrower.address, depositLINKAmount);

    //approve protocol to access borrower wallet
    await LINK.connect(borrower.signer).approve(yearnLINKVault.address, depositLINKAmount);

    // deposit collateral to borrow
    await yearnLINKVault.connect(borrower.signer).depositCollateral(LINK.address, depositLINKAmount);
    expect(await yearnLINKVault.getYieldAmount()).to.be.equal(0);

    //To simulate yield in lendingPool, deposit some yvLINK to aYVLINK contract
    const yvlinkOwnerAddress = '0xdbfb0785366262f4736bcb5757cb20f0065c4dd1';
    const yieldyvLINK = '300';
    const yieldyvLINKAmount = await convertToCurrencyDecimals(yvlink.address, yieldyvLINK);
    //Make some test yvLINK
    await impersonateAccountsHardhat([yvlinkOwnerAddress]);
    signer = await ethers.provider.getSigner(yvlinkOwnerAddress);
    await yvlink.connect(signer).transfer(aYVLINK.address, yieldyvLINKAmount);

    expect((await yearnLINKVault.getYieldAmount()).gt(parseEther('299.99'))).to.be.equal(true);
    expect(await usdc.balanceOf(yearnLINKVault.address)).to.be.equal(0);
    expect(await dai.balanceOf(yearnLINKVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
    expect(await aDai.balanceOf(depositor1.address)).to.be.equal(amountDAItoDeposit);
    expect(await aUsdt.balanceOf(depositor2.address)).to.be.equal(amountUSDTtoDeposit);

    // process yield, so all yield should be converted to usdc and dai
    await yearnLINKVault.processYield();
    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(amountUSDCtoDeposit);
    expect(await aDai.balanceOf(depositor1.address)).to.be.gt(amountDAItoDeposit);
    expect(await aUsdt.balanceOf(depositor2.address)).to.be.gt(amountUSDTtoDeposit);
  });
});