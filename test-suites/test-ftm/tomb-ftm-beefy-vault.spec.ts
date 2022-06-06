/**
 * @dev test for TombFtmBeefyVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

const { parseEther } = ethers.utils;

makeSuite('TombFtmBeefyVault', (testEnv: TestEnv) => {
  it('failed deposit for collateral without TOMB_FTM_LP', async () => {
    const { TombFtmBeefyVault } = testEnv;
    await expect(TombFtmBeefyVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
  });

  it('deposit TOMB_FTM_LP for collateral', async () => {
    const { TombFtmBeefyVault, deployer, mootomb_ftm, aMooTOMB_FTM, TOMB_FTM_LP } = testEnv;
    const ethers = (DRE as any).ethers;

    // Make some test TOMB_FTM_LP for depositor
    const amountTombFtmLPtoDeposit = await convertToCurrencyDecimals(TOMB_FTM_LP.address, '1500');
    const tombFtmLPOwnerAddress = '0xbF26ea0DFA032aFeFD43A6C91C50FA6cbe4bA9c6';
    await impersonateAccountsHardhat([tombFtmLPOwnerAddress]);
    let signer = await ethers.provider.getSigner(tombFtmLPOwnerAddress);
    await TOMB_FTM_LP.connect(signer).transfer(deployer.address, amountTombFtmLPtoDeposit);
    
    await TOMB_FTM_LP.approve(TombFtmBeefyVault.address, amountTombFtmLPtoDeposit);

    await TombFtmBeefyVault.depositCollateral(TOMB_FTM_LP.address, amountTombFtmLPtoDeposit);

    expect(await mootomb_ftm.balanceOf(TombFtmBeefyVault.address)).to.be.equal(0);
    expect(await aMooTOMB_FTM.balanceOf(TombFtmBeefyVault.address)).to.be.equal(0);
    expect(await aMooTOMB_FTM.balanceOf(deployer.address)).to.be.gte(await convertToCurrencyDecimals(TOMB_FTM_LP.address, '1499.99'));
    expect(await TOMB_FTM_LP.balanceOf(deployer.address)).to.be.equal(0);
  });

  it('transferring aMooTOMB_FTM should be success after deposit TOMB_FTM_LP', async () => {
    const { aMooTOMB_FTM, users } = testEnv;
    await expect(aMooTOMB_FTM.transfer(users[0].address, await convertToCurrencyDecimals(aMooTOMB_FTM.address, '50'))).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, TombFtmBeefyVault, TOMB_FTM_LP } = testEnv;
    const amountTombFtmLPtoDeposit = await convertToCurrencyDecimals(TOMB_FTM_LP.address, '1500');
    await expect(TombFtmBeefyVault.withdrawCollateral(TOMB_FTM_LP.address, amountTombFtmLPtoDeposit, 9900, deployer.address))
      .to.be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, mootomb_ftm, TombFtmBeefyVault, TOMB_FTM_LP } = testEnv;
    const mootombftmBalanceOfPool = await mootomb_ftm.balanceOf(TombFtmBeefyVault.address);
    const tombFtmLPBeforeBalanceOfUser = await TOMB_FTM_LP.balanceOf(deployer.address);
    const tombFtmLPWithdrawAmount = await convertToCurrencyDecimals(TOMB_FTM_LP.address, '1449');

    await TombFtmBeefyVault.withdrawCollateral(TOMB_FTM_LP.address, tombFtmLPWithdrawAmount, 9900, deployer.address);

    const tombFtmLPCurrentBalanceOfUser = await TOMB_FTM_LP.balanceOf(deployer.address);
    expect(mootombftmBalanceOfPool).to.be.equal(0);
    expect(tombFtmLPCurrentBalanceOfUser.sub(tombFtmLPBeforeBalanceOfUser)).to.be.gte(
      await convertToCurrencyDecimals(TOMB_FTM_LP.address, '1447.5')
    );
    expect(await TOMB_FTM_LP.balanceOf(TombFtmBeefyVault.address)).to.be.equal(0);
  });
});

makeSuite('TombFtmBeefyVault - use other coin as collateral', (testEnv) => {
  it('Should revert to use any of coin other than TOMB_FTM_LP as collateral', async () => {
    const { usdc, TombFtmBeefyVault, mootomb_ftm } = testEnv;
    // TODO @bshevchenko: use Error const instead of 82
    await expect(TombFtmBeefyVault.depositCollateral(mootomb_ftm.address, 1000)).to.be.revertedWith('82');
  });
});

makeSuite('TombFtmBeefyVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for single asset', async () => {
    const { pool, TombFtmBeefyVault, usdc, users, TOMB_FTM_LP, mootomb_ftm, aMooTOMB_FTM, aUsdc } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const ethers = (DRE as any).ethers;
    const amountTombFtmLPtoDeposit = await convertToCurrencyDecimals(TOMB_FTM_LP.address, '1500');
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

    const tombFtmLPOwnerAddress = '0xbF26ea0DFA032aFeFD43A6C91C50FA6cbe4bA9c6';
    await impersonateAccountsHardhat([tombFtmLPOwnerAddress]);
    signer = await ethers.provider.getSigner(tombFtmLPOwnerAddress);
    await TOMB_FTM_LP.connect(signer).transfer(borrower.address, amountTombFtmLPtoDeposit);
    
    // approve protocol to access borrower wallet
    await TOMB_FTM_LP.connect(borrower.signer).approve(TombFtmBeefyVault.address, amountTombFtmLPtoDeposit);

    // deposit collateral to borrow
    await TombFtmBeefyVault.connect(borrower.signer).depositCollateral(TOMB_FTM_LP.address, amountTombFtmLPtoDeposit);
    expect(await TombFtmBeefyVault.getYieldAmount()).to.be.equal(0);

    // To simulate yield in lendingPool, deposit some mootomb_ftm to aMooTOMB_FTM contract
    const mootombftmOwnerAddress = '0xb8AF79BaCeDD2dCB86E77545143343d0E879EcF5';
    const yieldmootombftmAmount = await convertToCurrencyDecimals(TOMB_FTM_LP.address, '1500');
    await impersonateAccountsHardhat([mootombftmOwnerAddress]);
    signer = await ethers.provider.getSigner(mootombftmOwnerAddress);
    await mootomb_ftm.connect(signer).transfer(aMooTOMB_FTM.address, yieldmootombftmAmount);

    expect(await TombFtmBeefyVault.getYieldAmount()).to.be.gt(await convertToCurrencyDecimals(TOMB_FTM_LP.address, '1499.999'));
    expect(await usdc.balanceOf(TombFtmBeefyVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);

    // process yield, so all yield should be converted to usdc
    await TombFtmBeefyVault.processYield();
    const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '12400');
    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(yieldUSDC);
  });
});

makeSuite('TombFtmBeefyVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for multiple asset', async () => {
    const { pool, TombFtmBeefyVault, usdc, usdt, users, mootomb_ftm, aUsdc, aUsdt, aMooTOMB_FTM, TOMB_FTM_LP, dai, aDai } = testEnv;
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

    const daiOwnerAddress = '0x4188663a85C92EEa35b5AD3AA5cA7CeB237C6fe9';
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

    const tombFtmLPOwnerAddress = '0xbF26ea0DFA032aFeFD43A6C91C50FA6cbe4bA9c6';
    const depositTombFtmLP = '1500';
    const depositTombFtmLPAmount = await convertToCurrencyDecimals(TOMB_FTM_LP.address, depositTombFtmLP);
    //Make some test TOMB_FTM_LP for borrower
    await impersonateAccountsHardhat([tombFtmLPOwnerAddress]);
    signer = await ethers.provider.getSigner(tombFtmLPOwnerAddress);

    //transfer to borrower
    await TOMB_FTM_LP.connect(signer).transfer(borrower.address, depositTombFtmLPAmount);

    //approve protocol to access borrower wallet
    await TOMB_FTM_LP.connect(borrower.signer).approve(TombFtmBeefyVault.address, depositTombFtmLPAmount);

    // deposit collateral to borrow
    await TombFtmBeefyVault.connect(borrower.signer).depositCollateral(TOMB_FTM_LP.address, depositTombFtmLPAmount);
    expect(await TombFtmBeefyVault.getYieldAmount()).to.be.equal(0);

    //To simulate yield in lendingPool, deposit some mootomb_ftm to aMooTOMB_FTM contract
    const mootombftmOwnerAddress = '0xb8AF79BaCeDD2dCB86E77545143343d0E879EcF5';
    const yieldmootombftm = '1500';
    const yieldmootombftmAmount = await convertToCurrencyDecimals(mootomb_ftm.address, yieldmootombftm);
    //Make some test mootomb_ftm
    await impersonateAccountsHardhat([mootombftmOwnerAddress]);
    signer = await ethers.provider.getSigner(mootombftmOwnerAddress);
    await mootomb_ftm.connect(signer).transfer(aMooTOMB_FTM.address, yieldmootombftmAmount);

    expect((await TombFtmBeefyVault.getYieldAmount()).gt(parseEther('1499.99'))).to.be.equal(true);
    expect(await usdc.balanceOf(TombFtmBeefyVault.address)).to.be.equal(0);
    expect(await dai.balanceOf(TombFtmBeefyVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
    expect(await aDai.balanceOf(depositor1.address)).to.be.equal(amountDAItoDeposit);
    expect(await aUsdt.balanceOf(depositor2.address)).to.be.equal(amountUSDTtoDeposit);

    // process yield, so all yield should be converted to usdc and dai
    await TombFtmBeefyVault.processYield();
    const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '9150');
    const yieldDAI = await convertToCurrencyDecimals(dai.address, '9150');
    const yieldUSDT = await convertToCurrencyDecimals(usdt.address, '4580');
    expect((await aUsdc.balanceOf(depositor.address)).gt(yieldUSDC)).to.be.equal(true);
    expect((await aDai.balanceOf(depositor1.address)).gt(yieldDAI)).to.be.equal(true);
    expect((await aUsdt.balanceOf(depositor2.address)).gt(yieldUSDT)).to.be.equal(true);
  });
});