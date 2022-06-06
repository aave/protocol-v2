/**
 * @dev test for yearnSPELLVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

const { parseEther } = ethers.utils;

makeSuite('yearnSPELLVault', (testEnv: TestEnv) => {
  it('failed deposit for collateral without SPELL', async () => {
    const { yearnSPELLVault } = testEnv;
    await expect(yearnSPELLVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
  });

  it('deposit SPELL for collateral', async () => {
    const { yearnSPELLVault, deployer, yvspell, aYVSPELL, SPELL } = testEnv;
    const ethers = (DRE as any).ethers;

    // Make some test SPELL for depositor
    const amountSPELLtoDeposit = await convertToCurrencyDecimals(SPELL.address, '300');
    const spellOwnerAddress = '0x0249fbbd411944249a2625dfc0fdee6bd1c41b36';
    await impersonateAccountsHardhat([spellOwnerAddress]);
    let signer = await ethers.provider.getSigner(spellOwnerAddress);
    await SPELL.connect(signer).transfer(deployer.address, amountSPELLtoDeposit);
    
    await SPELL.approve(yearnSPELLVault.address, amountSPELLtoDeposit);

    await yearnSPELLVault.depositCollateral(SPELL.address, amountSPELLtoDeposit);

    expect(await yvspell.balanceOf(yearnSPELLVault.address)).to.be.equal(0);
    expect(await aYVSPELL.balanceOf(yearnSPELLVault.address)).to.be.equal(0);
    expect(await aYVSPELL.balanceOf(deployer.address)).to.be.gte(await convertToCurrencyDecimals(SPELL.address, '299.99'));
    expect(await SPELL.balanceOf(deployer.address)).to.be.equal(0);
  });

  it('transferring aYVSPELL should be success after deposit SPELL', async () => {
    const { aYVSPELL, users } = testEnv;
    await expect(aYVSPELL.transfer(users[0].address, await convertToCurrencyDecimals(aYVSPELL.address, '10'))).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, yearnSPELLVault, SPELL } = testEnv;
    const amountSPELLtoDeposit = await convertToCurrencyDecimals(SPELL.address, '300');
    await expect(yearnSPELLVault.withdrawCollateral(SPELL.address, amountSPELLtoDeposit, 9900, deployer.address))
      .to.be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, yvspell, yearnSPELLVault, SPELL } = testEnv;
    const yvspellBalanceOfPool = await yvspell.balanceOf(yearnSPELLVault.address);
    const spellBeforeBalanceOfUser = await SPELL.balanceOf(deployer.address);
    const spellWithdrawAmount = await convertToCurrencyDecimals(SPELL.address, '289');

    await yearnSPELLVault.withdrawCollateral(SPELL.address, spellWithdrawAmount, 9900, deployer.address);

    const spellCurrentBalanceOfUser = await SPELL.balanceOf(deployer.address);
    expect(yvspellBalanceOfPool).to.be.equal(0);
    expect(spellCurrentBalanceOfUser.sub(spellBeforeBalanceOfUser)).to.be.gte(
      await convertToCurrencyDecimals(SPELL.address, '288.9999')
    );
    expect(await SPELL.balanceOf(yearnSPELLVault.address)).to.be.equal(0);
  });
});

makeSuite('yearnSPELLVault - use other coin as collateral', (testEnv) => {
  it('Should revert to use any of coin other than SPELL as collateral', async () => {
    const { usdc, yearnSPELLVault, yvspell } = testEnv;
    // TODO @bshevchenko: use Error const instead of 82
    await expect(yearnSPELLVault.depositCollateral(yvspell.address, 1000)).to.be.revertedWith('82');
  });
});

makeSuite('yearnSPELLVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for single asset', async () => {
    const { pool, yearnSPELLVault, usdc, users, SPELL, yvspell, aYVSPELL, aUsdc } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const ethers = (DRE as any).ethers;
    const amountSPELLtoDeposit = await convertToCurrencyDecimals(SPELL.address, '300');
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

    const spellOwnerAddress = '0x0249fbbd411944249a2625dfc0fdee6bd1c41b36';
    await impersonateAccountsHardhat([spellOwnerAddress]);
    signer = await ethers.provider.getSigner(spellOwnerAddress);
    await SPELL.connect(signer).transfer(borrower.address, amountSPELLtoDeposit);
    
    // approve protocol to access borrower wallet
    await SPELL.connect(borrower.signer).approve(yearnSPELLVault.address, amountSPELLtoDeposit);

    // deposit collateral to borrow
    await yearnSPELLVault.connect(borrower.signer).depositCollateral(SPELL.address, amountSPELLtoDeposit);
    expect(await yearnSPELLVault.getYieldAmount()).to.be.equal(0);

    // To simulate yield in lendingPool, deposit some yvspell to aYVSPELL contract
    const yvspellOwnerAddress = '0x260d02e0dac4711c1e796cfa0324b227ea06eda6';
    const yieldyvspellAmount = await convertToCurrencyDecimals(SPELL.address, '300');
    await impersonateAccountsHardhat([yvspellOwnerAddress]);
    signer = await ethers.provider.getSigner(yvspellOwnerAddress);
    await yvspell.connect(signer).transfer(aYVSPELL.address, yieldyvspellAmount);

    expect(await yearnSPELLVault.getYieldAmount()).to.be.gt(await convertToCurrencyDecimals(SPELL.address, '299.999'));
    expect(await usdc.balanceOf(yearnSPELLVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);

    // process yield, so all yield should be converted to usdc
    await yearnSPELLVault.processYield();
    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(amountUSDCtoDeposit);
  });
});

makeSuite('yearnSPELLVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for multiple asset', async () => {
    const { pool, yearnSPELLVault, usdc, usdt, users, yvspell, aUsdc, aUsdt, aYVSPELL, SPELL, dai, aDai } = testEnv;
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

    const spellOwnerAddress = '0x0249fbbd411944249a2625dfc0fdee6bd1c41b36';
    const depositSPELL = '300';
    const depositSPELLAmount = await convertToCurrencyDecimals(SPELL.address, depositSPELL);
    //Make some test SPELL for borrower
    await impersonateAccountsHardhat([spellOwnerAddress]);
    signer = await ethers.provider.getSigner(spellOwnerAddress);

    //transfer to borrower
    await SPELL.connect(signer).transfer(borrower.address, depositSPELLAmount);

    //approve protocol to access borrower wallet
    await SPELL.connect(borrower.signer).approve(yearnSPELLVault.address, depositSPELLAmount);

    // deposit collateral to borrow
    await yearnSPELLVault.connect(borrower.signer).depositCollateral(SPELL.address, depositSPELLAmount);
    expect(await yearnSPELLVault.getYieldAmount()).to.be.equal(0);

    //To simulate yield in lendingPool, deposit some yvSPELL to aYVSPELL contract
    const yvspellOwnerAddress = '0x260d02e0dac4711c1e796cfa0324b227ea06eda6';
    const yieldyvSPELL = '300';
    const yieldyvSPELLAmount = await convertToCurrencyDecimals(yvspell.address, yieldyvSPELL);
    //Make some test yvSPELL
    await impersonateAccountsHardhat([yvspellOwnerAddress]);
    signer = await ethers.provider.getSigner(yvspellOwnerAddress);
    await yvspell.connect(signer).transfer(aYVSPELL.address, yieldyvSPELLAmount);

    expect((await yearnSPELLVault.getYieldAmount()).gt(parseEther('299.99'))).to.be.equal(true);
    expect(await usdc.balanceOf(yearnSPELLVault.address)).to.be.equal(0);
    expect(await dai.balanceOf(yearnSPELLVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
    expect(await aDai.balanceOf(depositor1.address)).to.be.equal(amountDAItoDeposit);
    expect(await aUsdt.balanceOf(depositor2.address)).to.be.equal(amountUSDTtoDeposit);

    // process yield, so all yield should be converted to usdc and dai
    await yearnSPELLVault.processYield();
    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(amountUSDCtoDeposit);
    expect(await aDai.balanceOf(depositor1.address)).to.be.gt(amountDAItoDeposit);
    expect(await aUsdt.balanceOf(depositor2.address)).to.be.gt(amountUSDTtoDeposit);
  });
});