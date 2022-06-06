/**
 * @dev test for yearnBOOVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

const { parseEther } = ethers.utils;

makeSuite('yearnBOOVault', (testEnv: TestEnv) => {
  it('failed deposit for collateral without BOO', async () => {
    const { yearnBOOVault, deployer } = testEnv;
    await expect(yearnBOOVault.connect(deployer.signer).depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
  });

  it('deposit BOO for collateral', async () => {
    const { yearnBOOVault, deployer, yvboo, aYVBOO, BOO } = testEnv;
    const ethers = (DRE as any).ethers;

    // Make some test BOO for depositor
    const amountBOOtoDeposit = await convertToCurrencyDecimals(BOO.address, '300');
    await BOO.connect(deployer.signer).approve(yearnBOOVault.address, amountBOOtoDeposit);

    await yearnBOOVault.connect(deployer.signer).depositCollateral(BOO.address, amountBOOtoDeposit);

    expect(await yvboo.balanceOf(yearnBOOVault.address)).to.be.equal(0);
    expect(await aYVBOO.balanceOf(yearnBOOVault.address)).to.be.equal(0);
    expect(await aYVBOO.balanceOf(deployer.address)).to.be.gte(await convertToCurrencyDecimals(BOO.address, '299.99'));
  });

  it('transferring aYVBOO should be success after deposit BOO', async () => {
    const { aYVBOO, users, deployer } = testEnv;
    await expect(aYVBOO.connect(deployer.signer).transfer(users[0].address, await convertToCurrencyDecimals(aYVBOO.address, '10'))).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, yearnBOOVault, BOO } = testEnv;
    const amountBOOtoDeposit = await convertToCurrencyDecimals(BOO.address, '300');
    await expect(yearnBOOVault.connect(deployer.signer).withdrawCollateral(BOO.address, amountBOOtoDeposit, 9900, deployer.address))
      .to.be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, yvboo, yearnBOOVault, BOO } = testEnv;
    const yvbooBalanceOfPool = await yvboo.balanceOf(yearnBOOVault.address);
    const booBeforeBalanceOfUser = await BOO.balanceOf(deployer.address);
    const booWithdrawAmount = await convertToCurrencyDecimals(BOO.address, '289');

    await yearnBOOVault.connect(deployer.signer).withdrawCollateral(BOO.address, booWithdrawAmount, 9900, deployer.address);

    const booCurrentBalanceOfUser = await BOO.balanceOf(deployer.address);
    expect(yvbooBalanceOfPool).to.be.equal(0);
    expect(booCurrentBalanceOfUser.sub(booBeforeBalanceOfUser)).to.be.gte(
      await convertToCurrencyDecimals(BOO.address, '288.9999')
    );
    expect(await BOO.balanceOf(yearnBOOVault.address)).to.be.equal(0);
  });
});

makeSuite('yearnBOOVault - use other coin as collateral', (testEnv) => {
  it('Should revert to use any of coin other than BOO as collateral', async () => {
    const { usdc, yearnBOOVault, deployer } = testEnv;
    // TODO @bshevchenko: use Error const instead of 82
    await expect(yearnBOOVault.connect(deployer.signer).depositCollateral(usdc.address, 1000)).to.be.revertedWith('82');
  });
});

// makeSuite('yearnBOOVault', (testEnv: TestEnv) => {
//   it('distribute yield to supplier for single asset', async () => {
//     const { pool, yearnBOOVault, usdc, users, BOO, yvboo, aYVBOO, aUsdc } = testEnv;
//     const depositor = users[0];
//     const borrower = users[1];
//     const ethers = (DRE as any).ethers;
//     const amountBOOtoDeposit = await convertToCurrencyDecimals(BOO.address, '300');
//     const usdcOwnerAddress = '0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe';
//     const depositUSDC = '7000';

//     // Make some test USDC for depositor
//     await impersonateAccountsHardhat([usdcOwnerAddress]);
//     let signer = await ethers.provider.getSigner(usdcOwnerAddress);
//     const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
//     await usdc.connect(signer).Swapin(
//       '0x6af483697065dda1e50693750662adb39012699bbdb49d908d682a275a83c4cf', // TODO random tx hash
//       depositor.address,
//       amountUSDCtoDeposit
//     );

//     // approve protocol to access depositor wallet
//     await usdc.connect(depositor.signer).approve(pool.address, amountUSDCtoDeposit);

//     // Supplier deposits USDC
//     await pool
//       .connect(depositor.signer)
//       .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

//     const booOwnerAddress = '0xE0c15e9Fe90d56472D8a43da5D3eF34ae955583C';
//     await impersonateAccountsHardhat([booOwnerAddress]);
//     signer = await ethers.provider.getSigner(booOwnerAddress);
//     await BOO.connect(signer).transfer(borrower.address, amountBOOtoDeposit);
    
//     // approve protocol to access borrower wallet
//     await BOO.connect(borrower.signer).approve(yearnBOOVault.address, amountBOOtoDeposit);

//     // deposit collateral to borrow
//     await yearnBOOVault.connect(borrower.signer).depositCollateral(BOO.address, amountBOOtoDeposit);
//     expect(await yearnBOOVault.getYieldAmount()).to.be.equal(0);

//     // To simulate yield in lendingPool, deposit some yvboo to aYVBOO contract
//     const yvbooOwnerAddress = '0x69258d1ed30A0e5971992921cb5787b9c7a2909D';
//     const yieldyvbooAmount = await convertToCurrencyDecimals(BOO.address, '300');
//     await impersonateAccountsHardhat([yvbooOwnerAddress]);
//     signer = await ethers.provider.getSigner(yvbooOwnerAddress);
//     await yvboo.connect(signer).transfer(aYVBOO.address, yieldyvbooAmount);

//     expect(await yearnBOOVault.getYieldAmount()).to.be.gt(await convertToCurrencyDecimals(BOO.address, '299.999'));
//     expect(await usdc.balanceOf(yearnBOOVault.address)).to.be.equal(0);
//     expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);

//     // process yield, so all yield should be converted to usdc
//     await yearnBOOVault.processYield();
//     const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '12400');
//     expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(yieldUSDC);
//   });
// });

// makeSuite('yearnBOOVault', (testEnv: TestEnv) => {
//   it('distribute yield to supplier for multiple asset', async () => {
//     const { pool, yearnBOOVault, usdc, usdt, users, yvboo, aUsdc, aUsdt, aYVBOO, BOO, dai, aDai } = testEnv;
//     const depositor = users[0];
//     const depositor1 = users[1];
//     const depositor2 = users[2];
//     const borrower = users[3];
//     const ethers = (DRE as any).ethers;
//     const usdcOwnerAddress = '0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe';
//     const depositUSDC = '7000';
//     //Make some test USDC for depositor
//     await impersonateAccountsHardhat([usdcOwnerAddress]);
//     let signer = await ethers.provider.getSigner(usdcOwnerAddress);
//     const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
//     await usdc.connect(signer).Swapin(
//       '0x6af483697065dda1e50693750662adb39012699bbdb49d908d682a275a83c4cf', // TODO random tx hash
//       depositor.address,
//       amountUSDCtoDeposit
//     );

//     //approve protocol to access depositor wallet
//     await usdc.connect(depositor.signer).approve(pool.address, amountUSDCtoDeposit);

//     //Supplier  deposits 7000 USDC
//     await pool
//       .connect(depositor.signer)
//       .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

//     const daiOwnerAddress = '0x93C08a3168fC469F3fC165cd3A471D19a37ca19e';
//     const depositDAI = '7000';
//     //Make some test DAI for depositor
//     await impersonateAccountsHardhat([daiOwnerAddress]);
//     signer = await ethers.provider.getSigner(daiOwnerAddress);
//     const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, depositDAI);
//     await dai.connect(signer).transfer(depositor1.address, amountDAItoDeposit);

//     //approve protocol to access depositor wallet
//     await dai.connect(depositor1.signer).approve(pool.address, amountDAItoDeposit);

//     //Supplier deposits 7000 DAI
//     await pool
//       .connect(depositor1.signer)
//       .deposit(dai.address, amountDAItoDeposit, depositor1.address, '0');

//     const usdtOwnerAddress = '0x93C08a3168fC469F3fC165cd3A471D19a37ca19e';
//     const depositUSDT = '3500';
//     //Make some test USDT for depositor
//     await impersonateAccountsHardhat([usdtOwnerAddress]);
//     signer = await ethers.provider.getSigner(usdtOwnerAddress);
//     const amountUSDTtoDeposit = await convertToCurrencyDecimals(usdt.address, depositUSDT);
//     await usdt.connect(signer).transfer(depositor2.address, amountUSDTtoDeposit);

//     //approve protocol to access depositor wallet
//     await usdt.connect(depositor2.signer).approve(pool.address, amountUSDTtoDeposit);

//     //Supplier  deposits 3500 USDT
//     await pool
//       .connect(depositor2.signer)
//       .deposit(usdt.address, amountUSDTtoDeposit, depositor2.address, '0');

//     const booOwnerAddress = '0xE0c15e9Fe90d56472D8a43da5D3eF34ae955583C';
//     const depositBOO = '300';
//     const depositBOOAmount = await convertToCurrencyDecimals(BOO.address, depositBOO);
//     //Make some test WFTM for borrower
//     await impersonateAccountsHardhat([booOwnerAddress]);
//     signer = await ethers.provider.getSigner(booOwnerAddress);

//     //transfer to borrower
//     await BOO.connect(signer).transfer(borrower.address, depositBOOAmount);

//     //approve protocol to access borrower wallet
//     await BOO.connect(borrower.signer).approve(yearnBOOVault.address, depositBOOAmount);

//     // deposit collateral to borrow
//     await yearnBOOVault.connect(borrower.signer).depositCollateral(BOO.address, depositBOOAmount);
//     expect(await yearnBOOVault.getYieldAmount()).to.be.equal(0);

//     //To simulate yield in lendingPool, deposit some yvBOO to aYVBOO contract
//     const yvbooOwnerAddress = '0x69258d1ed30A0e5971992921cb5787b9c7a2909D';
//     const yieldyvBOO = '300';
//     const yieldyvBOOAmount = await convertToCurrencyDecimals(yvboo.address, yieldyvBOO);
//     //Make some test yvBOO
//     await impersonateAccountsHardhat([yvbooOwnerAddress]);
//     signer = await ethers.provider.getSigner(yvbooOwnerAddress);
//     await yvboo.connect(signer).transfer(aYVBOO.address, yieldyvBOOAmount);

//     expect((await yearnBOOVault.getYieldAmount()).gt(parseEther('299.99'))).to.be.equal(true);
//     expect(await usdc.balanceOf(yearnBOOVault.address)).to.be.equal(0);
//     expect(await dai.balanceOf(yearnBOOVault.address)).to.be.equal(0);
//     expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
//     expect(await aDai.balanceOf(depositor1.address)).to.be.equal(amountDAItoDeposit);
//     expect(await aUsdt.balanceOf(depositor2.address)).to.be.equal(amountUSDTtoDeposit);

//     // process yield, so all yield should be converted to usdc and dai
//     await yearnBOOVault.processYield();
//     const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '9150');
//     const yieldDAI = await convertToCurrencyDecimals(dai.address, '9150');
//     const yieldUSDT = await convertToCurrencyDecimals(usdt.address, '4580');
//     expect((await aUsdc.balanceOf(depositor.address)).gt(yieldUSDC)).to.be.equal(true);
//     expect((await aDai.balanceOf(depositor1.address)).gt(yieldDAI)).to.be.equal(true);
//     expect((await aUsdt.balanceOf(depositor2.address)).gt(yieldUSDT)).to.be.equal(true);
//   });
// });