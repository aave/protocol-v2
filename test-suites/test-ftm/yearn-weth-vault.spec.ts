/**
 * @dev test for yearnWETHVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

const { parseEther } = ethers.utils;

let amountWETHtoDeposit = parseEther('1');

makeSuite('yearnWETHVault', (testEnv: TestEnv) => {
  it('failed deposit for collateral without WETH', async () => {
    const { yearnWETHVault } = testEnv;
    await expect(yearnWETHVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
  });

  it('deposit WETH for collateral', async () => {
    const { yearnWETHVault, deployer, yvweth, aYVWETH, WETH } = testEnv;
    const ethers = (DRE as any).ethers;

    // Make some test WETH for depositor
    const wethOwnerAddress = '0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe';
    await impersonateAccountsHardhat([wethOwnerAddress]);
    let signer = await ethers.provider.getSigner(wethOwnerAddress);
    await WETH.connect(signer).Swapin(
      '0x6af483697065dda1e50693750662adb39012699bbdb49d908d682a275a83c4cf', // TODO random tx hash
      deployer.address,
      amountWETHtoDeposit
    );
    expect(await WETH.balanceOf(deployer.address)).to.be.equal(amountWETHtoDeposit);
    await WETH.approve(yearnWETHVault.address, amountWETHtoDeposit);

    await yearnWETHVault.depositCollateral(WETH.address, amountWETHtoDeposit);

    expect(await yvweth.balanceOf(yearnWETHVault.address)).to.be.equal(0);
    expect(await aYVWETH.balanceOf(yearnWETHVault.address)).to.be.equal(0);
    expect(await aYVWETH.balanceOf(deployer.address)).to.be.gte(parseEther('0.999'));
    expect(await ethers.getDefaultProvider().getBalance(yearnWETHVault.address)).to.be.equal(0);
  });

  it('transferring aYVWETH should be success after deposit WETH', async () => {
    const { aYVWETH, users } = testEnv;
    await expect(aYVWETH.transfer(users[0].address, parseEther('0.09'))).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, yearnWETHVault, WETH } = testEnv;
    await expect(yearnWETHVault.withdrawCollateral(WETH.address, amountWETHtoDeposit, 9900, deployer.address))
      .to.be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, yvweth, yearnWETHVault, WETH } = testEnv;
    const yvwethBalanceOfPool = await yvweth.balanceOf(yearnWETHVault.address);
    const wethBeforeBalanceOfUser = await WETH.balanceOf(deployer.address);

    await yearnWETHVault.withdrawCollateral(WETH.address, parseEther('0.9'), 9900, deployer.address);

    const wethCurrentBalanceOfUser = await WETH.balanceOf(deployer.address);
    expect(yvwethBalanceOfPool).to.be.equal(0);
    expect(wethCurrentBalanceOfUser.sub(wethBeforeBalanceOfUser)).to.be.gte(
      parseEther('0.8999')
    );
    expect(await WETH.balanceOf(yearnWETHVault.address)).to.be.equal(0);
  });
});

makeSuite('yearnWETHVault - use other coin as collateral', (testEnv) => {
  it('Should revert to use any of coin other than WETH as collateral', async () => {
    const { usdc, yearnWETHVault } = testEnv;
    // TODO @bshevchenko: use Error const instead of 82
    await expect(yearnWETHVault.depositCollateral(usdc.address, 1000)).to.be.revertedWith('82');
  });
});

makeSuite('yearnWETHVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for single asset', async () => {
    const { pool, yearnWETHVault, usdc, users, WETH, yvweth, aYVWETH, aUsdc } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const ethers = (DRE as any).ethers;
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
    expect(await usdc.balanceOf(depositor.address)).to.equal(amountUSDCtoDeposit);

    // approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, amountUSDCtoDeposit);

    // Supplier deposits USDC
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    const wethOwnerAddress = '0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe';
    await impersonateAccountsHardhat([wethOwnerAddress]);
    signer = await ethers.provider.getSigner(wethOwnerAddress);
    await WETH.connect(signer).Swapin(
      '0x6af483697065dda1e50693750662adb39012699bbdb49d908d682a275a83c4cf', // TODO random tx hash
      borrower.address,
      amountWETHtoDeposit
    );
    expect(await WETH.balanceOf(borrower.address)).to.be.equal(amountWETHtoDeposit);

    // approve protocol to access borrower wallet
    await WETH.connect(borrower.signer).approve(yearnWETHVault.address, amountWETHtoDeposit);

    // deposit collateral to borrow
    await yearnWETHVault.connect(borrower.signer).depositCollateral(WETH.address, amountWETHtoDeposit);
    expect(await yearnWETHVault.getYieldAmount()).to.be.equal(0);

    // To simulate yield in lendingPool, deposit some yvweth to aYVWETH contract
    const yvwethOwnerAddress = '0x577eBC5De943e35cdf9ECb5BbE1f7D7CB6c7C647';
    const yieldyvwethAmount = parseEther('1');
    await impersonateAccountsHardhat([yvwethOwnerAddress]);
    signer = await ethers.provider.getSigner(yvwethOwnerAddress);
    await yvweth.connect(signer).transfer(aYVWETH.address, yieldyvwethAmount);

    expect(await yearnWETHVault.getYieldAmount()).to.be.gt(parseEther('0.999'));
    expect(await usdc.balanceOf(yearnWETHVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);

    // process yield, so all yield should be converted to usdc
    await yearnWETHVault.processYield();
    const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '8000');
    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(yieldUSDC);
  });
});

// TODO
