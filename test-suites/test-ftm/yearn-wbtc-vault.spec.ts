/**
 * @dev test for yearnWBTCVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

const { parseEther } = ethers.utils;

makeSuite('yearnWBTCVault', (testEnv: TestEnv) => {
  it('failed deposit for collateral without WBTC', async () => {
    const { yearnWBTCVault } = testEnv;
    await expect(yearnWBTCVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
  });

  it('deposit WBTC for collateral', async () => {
    const { yearnWBTCVault, deployer, yvwbtc, aYVWBTC, WBTC } = testEnv;
    const ethers = (DRE as any).ethers;

    // Make some test WBTC for depositor
    const amountWBTCtoDeposit = await convertToCurrencyDecimals(WBTC.address, '0.1');
    const wbtcOwnerAddress = '0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe';
    await impersonateAccountsHardhat([wbtcOwnerAddress]);
    let signer = await ethers.provider.getSigner(wbtcOwnerAddress);
    await WBTC.connect(signer).Swapin(
      '0x6af483697065dda1e50693750662adb39012699bbdb49d908d682a275a83c4cf', // TODO random tx hash
      deployer.address,
      amountWBTCtoDeposit
    );
    expect(await WBTC.balanceOf(deployer.address)).to.be.equal(amountWBTCtoDeposit);
    await WBTC.approve(yearnWBTCVault.address, amountWBTCtoDeposit);

    await yearnWBTCVault.depositCollateral(WBTC.address, amountWBTCtoDeposit);

    expect(await yvwbtc.balanceOf(yearnWBTCVault.address)).to.be.equal(0);
    expect(await aYVWBTC.balanceOf(yearnWBTCVault.address)).to.be.equal(0);
    expect(await aYVWBTC.balanceOf(deployer.address)).to.be.gte(await convertToCurrencyDecimals(WBTC.address, '0.099'));
    expect(await ethers.getDefaultProvider().getBalance(yearnWBTCVault.address)).to.be.equal(0);
  });

  it('transferring aYVWBTC should be success after deposit WBTC', async () => {
    const { aYVWBTC, users } = testEnv;
    await expect(aYVWBTC.transfer(users[0].address, await convertToCurrencyDecimals(aYVWBTC.address, '0.0009'))).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, yearnWBTCVault, WBTC } = testEnv;
    const amountWBTCtoDeposit = await convertToCurrencyDecimals(WBTC.address, '0.1');
    await expect(yearnWBTCVault.withdrawCollateral(WBTC.address, amountWBTCtoDeposit, 9900, deployer.address))
      .to.be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, yvwbtc, yearnWBTCVault, WBTC } = testEnv;
    const yvwbtcBalanceOfPool = await yvwbtc.balanceOf(yearnWBTCVault.address);
    const wbtcBeforeBalanceOfUser = await WBTC.balanceOf(deployer.address);
    const wbtcWithdrawAmount = await convertToCurrencyDecimals(WBTC.address, '0.099');

    await yearnWBTCVault.withdrawCollateral(WBTC.address, wbtcWithdrawAmount, 9900, deployer.address);

    const wbtcCurrentBalanceOfUser = await WBTC.balanceOf(deployer.address);
    expect(yvwbtcBalanceOfPool).to.be.equal(0);
    expect(wbtcCurrentBalanceOfUser.sub(wbtcBeforeBalanceOfUser)).to.be.gte(
      await convertToCurrencyDecimals(WBTC.address, '0.09899')
    );
    expect(await WBTC.balanceOf(yearnWBTCVault.address)).to.be.equal(0);
  });
});

makeSuite('yearnWBTCVault - use other coin as collateral', (testEnv) => {
  it('Should revert to use any of coin other than WBTC as collateral', async () => {
    const { usdc, yearnWBTCVault } = testEnv;
    // TODO @bshevchenko: use Error const instead of 82
    await expect(yearnWBTCVault.depositCollateral(usdc.address, 1000)).to.be.revertedWith('82');
  });
});

makeSuite('yearnWBTCVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for single asset', async () => {
    const { pool, yearnWBTCVault, usdc, users, WBTC, yvwbtc, aYVWBTC, aUsdc } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const ethers = (DRE as any).ethers;
    const amountWBTCtoDeposit = await convertToCurrencyDecimals(WBTC.address, '0.1');
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

    const wbtcOwnerAddress = '0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe';
    await impersonateAccountsHardhat([wbtcOwnerAddress]);
    signer = await ethers.provider.getSigner(wbtcOwnerAddress);
    await WBTC.connect(signer).Swapin(
      '0x6af483697065dda1e50693750662adb39012699bbdb49d908d682a275a83c4cf', // TODO random tx hash
      borrower.address,
      amountWBTCtoDeposit
    );
    expect(await WBTC.balanceOf(borrower.address)).to.be.equal(amountWBTCtoDeposit);

    // approve protocol to access borrower wallet
    await WBTC.connect(borrower.signer).approve(yearnWBTCVault.address, amountWBTCtoDeposit);

    // deposit collateral to borrow
    await yearnWBTCVault.connect(borrower.signer).depositCollateral(WBTC.address, amountWBTCtoDeposit);
    expect(await yearnWBTCVault.getYieldAmount()).to.be.equal(0);

    // To simulate yield in lendingPool, deposit some yvwbtc to aYVWBTC contract
    const yvwbtcOwnerAddress = '0xee439Ee079AC05D9d33a6926A16e0c820fB2713A';
    const yieldyvwbtcAmount = await convertToCurrencyDecimals(WBTC.address, '0.1');
    await impersonateAccountsHardhat([yvwbtcOwnerAddress]);
    signer = await ethers.provider.getSigner(yvwbtcOwnerAddress);
    await yvwbtc.connect(signer).transfer(aYVWBTC.address, yieldyvwbtcAmount);

    expect(await yearnWBTCVault.getYieldAmount()).to.be.gt(await convertToCurrencyDecimals(WBTC.address, '0.0999'));
    expect(await usdc.balanceOf(yearnWBTCVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);

    // process yield, so all yield should be converted to usdc
    await yearnWBTCVault.processYield();
    const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '10500');
    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(yieldUSDC);
  });
});

// TODO
