/**
 * @dev test for TombMiMaticBeefyVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

const { parseEther } = ethers.utils;

makeSuite('TombMiMaticBeefyVault', (testEnv: TestEnv) => {
  it('failed deposit for collateral without TOMB_MIMATIC_LP', async () => {
    const { TombMiMaticBeefyVault } = testEnv;
    await expect(TombMiMaticBeefyVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
  });

  it('deposit TOMB_MIMATIC_LP for collateral', async () => {
    const { TombMiMaticBeefyVault, deployer, mootomb_mimatic, aMooTOMB_MIMATIC, TOMB_MIMATIC_LP } = testEnv;
    const ethers = (DRE as any).ethers;

    // Make some test TOMB_MIMATIC_LP for depositor
    const amountTombMiMaticLPtoDeposit = await convertToCurrencyDecimals(TOMB_MIMATIC_LP.address, '2500');
    const tombMiMaticLPOwnerAddress = '0xB339ac13d9dAe79Ab6caD15Ec8903131099ceEA5';
    await impersonateAccountsHardhat([tombMiMaticLPOwnerAddress]);
    let signer = await ethers.provider.getSigner(tombMiMaticLPOwnerAddress);
    await TOMB_MIMATIC_LP.connect(signer).transfer(deployer.address, amountTombMiMaticLPtoDeposit);
    
    await TOMB_MIMATIC_LP.connect(deployer.signer).approve(TombMiMaticBeefyVault.address, amountTombMiMaticLPtoDeposit);

    await TombMiMaticBeefyVault.connect(deployer.signer).depositCollateral(TOMB_MIMATIC_LP.address, amountTombMiMaticLPtoDeposit);

    expect(await mootomb_mimatic.balanceOf(TombMiMaticBeefyVault.address)).to.be.equal(0);
    expect(await aMooTOMB_MIMATIC.balanceOf(TombMiMaticBeefyVault.address)).to.be.equal(0);
    expect(await aMooTOMB_MIMATIC.balanceOf(deployer.address)).to.be.gte(await convertToCurrencyDecimals(TOMB_MIMATIC_LP.address, '2499.99'));
    expect(await TOMB_MIMATIC_LP.balanceOf(deployer.address)).to.be.equal(0);
  });

  it('transferring aMooTOMB_MIMATIC should be success after deposit TOMB_MIMATIC_LP', async () => {
    const { aMooTOMB_MIMATIC, users, deployer } = testEnv;
    await expect(aMooTOMB_MIMATIC.connect(deployer.signer).transfer(users[0].address, await convertToCurrencyDecimals(aMooTOMB_MIMATIC.address, '50'))).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, TombMiMaticBeefyVault, TOMB_MIMATIC_LP } = testEnv;
    const amountTombMiMaticLPtoDeposit = await convertToCurrencyDecimals(TOMB_MIMATIC_LP.address, '2500');
    await expect(TombMiMaticBeefyVault.connect(deployer.address).withdrawCollateral(TOMB_MIMATIC_LP.address, amountTombMiMaticLPtoDeposit, 9900, deployer.address))
      .to.be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, mootomb_mimatic, TombMiMaticBeefyVault, TOMB_MIMATIC_LP } = testEnv;
    const mootombmimaticBalanceOfPool = await mootomb_mimatic.balanceOf(TombMiMaticBeefyVault.address);
    const tombMiMaticLPBeforeBalanceOfUser = await TOMB_MIMATIC_LP.balanceOf(deployer.address);
    const tombMiMaticLPWithdrawAmount = await convertToCurrencyDecimals(TOMB_MIMATIC_LP.address, '2449');

    await TombMiMaticBeefyVault.connect(deployer.signer).withdrawCollateral(TOMB_MIMATIC_LP.address, tombMiMaticLPWithdrawAmount, 9900, deployer.address);

    const tombMiMaticLPCurrentBalanceOfUser = await TOMB_MIMATIC_LP.balanceOf(deployer.address);
    expect(mootombmimaticBalanceOfPool).to.be.equal(0);
    expect(tombMiMaticLPCurrentBalanceOfUser.sub(tombMiMaticLPBeforeBalanceOfUser)).to.be.gte(
      await convertToCurrencyDecimals(TOMB_MIMATIC_LP.address, '2447.5')
    );
    expect(await TOMB_MIMATIC_LP.balanceOf(TombMiMaticBeefyVault.address)).to.be.equal(0);
  });
});

makeSuite('TombMiMaticBeefyVault - use other coin as collateral', (testEnv) => {
  it('Should revert to use any of coin other than TOMB_MIMATIC_LP as collateral', async () => {
    const { usdc, TombMiMaticBeefyVault, mootomb_mimatic } = testEnv;
    // TODO @bshevchenko: use Error const instead of 82
    await expect(TombMiMaticBeefyVault.depositCollateral(mootomb_mimatic.address, 1000)).to.be.revertedWith('82');
  });
});

makeSuite('TombMiMaticBeefyVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for single asset', async () => {
    const { pool, TombMiMaticBeefyVault, usdc, users, TOMB_MIMATIC_LP, mootomb_mimatic, aMooTOMB_MIMATIC, aUsdc, deployer } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const ethers = (DRE as any).ethers;
    const amountTombMiMaticLPtoDeposit = await convertToCurrencyDecimals(TOMB_MIMATIC_LP.address, '2500');
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

    const tombMiMaticLPOwnerAddress = '0xB339ac13d9dAe79Ab6caD15Ec8903131099ceEA5';
    await impersonateAccountsHardhat([tombMiMaticLPOwnerAddress]);
    signer = await ethers.provider.getSigner(tombMiMaticLPOwnerAddress);
    await TOMB_MIMATIC_LP.connect(signer).transfer(borrower.address, amountTombMiMaticLPtoDeposit);
    
    // approve protocol to access borrower wallet
    await TOMB_MIMATIC_LP.connect(borrower.signer).approve(TombMiMaticBeefyVault.address, amountTombMiMaticLPtoDeposit);

    // deposit collateral to borrow
    await TombMiMaticBeefyVault.connect(borrower.signer).depositCollateral(TOMB_MIMATIC_LP.address, amountTombMiMaticLPtoDeposit);
    expect(await TombMiMaticBeefyVault.getYieldAmount()).to.be.equal(0);

    // To simulate yield in lendingPool, deposit some mootomb_mimatic to aMooTOMB_MIMATIC contract
    const mootombmimaticOwnerAddress = '0x482445ba429B7Bfd7B640ada3d68b8Bb1876cf78';
    const yieldmootombmimaticAmount = await convertToCurrencyDecimals(TOMB_MIMATIC_LP.address, '2500');
    await impersonateAccountsHardhat([mootombmimaticOwnerAddress]);
    signer = await ethers.provider.getSigner(mootombmimaticOwnerAddress);
    await mootomb_mimatic.connect(signer).transfer(aMooTOMB_MIMATIC.address, yieldmootombmimaticAmount);

    expect(await TombMiMaticBeefyVault.getYieldAmount()).to.be.gt(await convertToCurrencyDecimals(TOMB_MIMATIC_LP.address, '1499.999'));
    expect(await usdc.balanceOf(TombMiMaticBeefyVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);

    // process yield, so all yield should be converted to usdc
    await TombMiMaticBeefyVault.connect(deployer.signer).processYield();
    const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '11700');
    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(yieldUSDC);
  });
});

makeSuite('TombMiMaticBeefyVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for multiple asset', async () => {
    const { pool, TombMiMaticBeefyVault, usdc, usdt, users, mootomb_mimatic, aUsdc, aUsdt, aMooTOMB_MIMATIC, TOMB_MIMATIC_LP, dai, aDai, deployer } = testEnv;
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

    const tombMiMaticLPOwnerAddress = '0xB339ac13d9dAe79Ab6caD15Ec8903131099ceEA5';
    const depositTombMiMaticLP = '2500';
    const depositTombMiMaticLPAmount = await convertToCurrencyDecimals(TOMB_MIMATIC_LP.address, depositTombMiMaticLP);
    //Make some test TOMB_MIMATIC_LP for borrower
    await impersonateAccountsHardhat([tombMiMaticLPOwnerAddress]);
    signer = await ethers.provider.getSigner(tombMiMaticLPOwnerAddress);

    //transfer to borrower
    await TOMB_MIMATIC_LP.connect(signer).transfer(borrower.address, depositTombMiMaticLPAmount);

    //approve protocol to access borrower wallet
    await TOMB_MIMATIC_LP.connect(borrower.signer).approve(TombMiMaticBeefyVault.address, depositTombMiMaticLPAmount);

    // deposit collateral to borrow
    await TombMiMaticBeefyVault.connect(borrower.signer).depositCollateral(TOMB_MIMATIC_LP.address, depositTombMiMaticLPAmount);
    expect(await TombMiMaticBeefyVault.getYieldAmount()).to.be.equal(0);

    //To simulate yield in lendingPool, deposit some mootomb_mimatic to aMooTOMB_MIMATIC contract
    const mootombmimaticOwnerAddress = '0x482445ba429B7Bfd7B640ada3d68b8Bb1876cf78';
    const yieldmootombmimatic = '2500';
    const yieldmootombmimaticAmount = await convertToCurrencyDecimals(mootomb_mimatic.address, yieldmootombmimatic);
    //Make some test mootomb_mimatic
    await impersonateAccountsHardhat([mootombmimaticOwnerAddress]);
    signer = await ethers.provider.getSigner(mootombmimaticOwnerAddress);
    await mootomb_mimatic.connect(signer).transfer(aMooTOMB_MIMATIC.address, yieldmootombmimaticAmount);

    expect((await TombMiMaticBeefyVault.getYieldAmount()).gt(parseEther('2499.99'))).to.be.equal(true);
    expect(await usdc.balanceOf(TombMiMaticBeefyVault.address)).to.be.equal(0);
    expect(await dai.balanceOf(TombMiMaticBeefyVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
    expect(await aDai.balanceOf(depositor1.address)).to.be.equal(amountDAItoDeposit);
    expect(await aUsdt.balanceOf(depositor2.address)).to.be.equal(amountUSDTtoDeposit);

    // process yield, so all yield should be converted to usdc and dai
    await TombMiMaticBeefyVault.connect(deployer.signer).processYield();
    const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '8800');
    const yieldDAI = await convertToCurrencyDecimals(dai.address, '8800');
    const yieldUSDT = await convertToCurrencyDecimals(usdt.address, '4300');
    expect((await aUsdc.balanceOf(depositor.address)).gt(yieldUSDC)).to.be.equal(true);
    expect((await aDai.balanceOf(depositor1.address)).gt(yieldDAI)).to.be.equal(true);
    expect((await aUsdt.balanceOf(depositor2.address)).gt(yieldUSDT)).to.be.equal(true);
  });
});