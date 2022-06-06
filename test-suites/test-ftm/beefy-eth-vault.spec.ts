/**
 * @dev test for beefyETHVault functions
 */

 import { expect } from 'chai';
 import { makeSuite, TestEnv } from './helpers/make-suite';
 import { ethers } from 'ethers';
 import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
 import { ZERO_ADDRESS } from '../../helpers/constants';
 import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
 
 const { parseEther } = ethers.utils;
 
 makeSuite('beefyETHVault', (testEnv: TestEnv) => {
   it('failed deposit for collateral without WETH', async () => {
     const { beefyETHVault } = testEnv;
     await expect(beefyETHVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
   });
 
   it('deposit WETH for collateral', async () => {
     const { beefyETHVault, deployer, mooweth, aMOOWETH, WETH } = testEnv;
     const ethers = (DRE as any).ethers;
 
     // Make some test WETH for depositor
     const amountWETHtoDeposit = await convertToCurrencyDecimals(WETH.address, '300');
     const wethOwnerAddress = '0xca436e14855323927d6e6264470ded36455fc8bd';
     await impersonateAccountsHardhat([wethOwnerAddress]);
     let signer = await ethers.provider.getSigner(wethOwnerAddress);
     await WETH.connect(signer).transfer(deployer.address, amountWETHtoDeposit);
     
     await WETH.approve(beefyETHVault.address, amountWETHtoDeposit);
 
     await beefyETHVault.depositCollateral(WETH.address, amountWETHtoDeposit);
 
     expect(await mooweth.balanceOf(beefyETHVault.address)).to.be.equal(0);
     expect(await aMOOWETH.balanceOf(beefyETHVault.address)).to.be.equal(0);
     expect(await aMOOWETH.balanceOf(deployer.address)).to.be.gte(await convertToCurrencyDecimals(WETH.address, '299.99'));
     expect(await WETH.balanceOf(deployer.address)).to.be.equal(0);
   });
 
   it('transferring aMOOWETH should be success after deposit WETH', async () => {
     const { aMOOWETH, users } = testEnv;
     await expect(aMOOWETH.transfer(users[0].address, await convertToCurrencyDecimals(aMOOWETH.address, '10'))).to.not.be.reverted;
   });
 
   it('withdraw from collateral should be failed if user has not enough balance', async () => {
     const { deployer, beefyETHVault, WETH } = testEnv;
     const amountWETHtoDeposit = await convertToCurrencyDecimals(WETH.address, '300');
     await expect(beefyETHVault.withdrawCollateral(WETH.address, amountWETHtoDeposit, 9900, deployer.address))
       .to.be.reverted;
   });
 
   it('withdraw from collateral', async () => {
     const { deployer, mooweth, beefyETHVault, WETH } = testEnv;
     const moowethBalanceOfPool = await mooweth.balanceOf(beefyETHVault.address);
     const wethBeforeBalanceOfUser = await WETH.balanceOf(deployer.address);
     const wethWithdrawAmount = await convertToCurrencyDecimals(WETH.address, '289');
 
     await beefyETHVault.withdrawCollateral(WETH.address, wethWithdrawAmount, 9900, deployer.address);
 
     const wethCurrentBalanceOfUser = await WETH.balanceOf(deployer.address);
     expect(moowethBalanceOfPool).to.be.equal(0);
     expect(wethCurrentBalanceOfUser.sub(wethBeforeBalanceOfUser)).to.be.gte(
       await convertToCurrencyDecimals(WETH.address, '288.9999')
     );
     expect(await WETH.balanceOf(beefyETHVault.address)).to.be.equal(0);
   });
 });
 
 makeSuite('beefyETHVault - use other coin as collateral', (testEnv) => {
   it('Should revert to use any of coin other than WETH as collateral', async () => {
     const { usdc, beefyETHVault, mooweth } = testEnv;
     // TODO @bshevchenko: use Error const instead of 82
     await expect(beefyETHVault.depositCollateral(mooweth.address, 1000)).to.be.revertedWith('82');
   });
 });
 
 makeSuite('beefyETHVault', (testEnv: TestEnv) => {
   it('distribute yield to supplier for single asset', async () => {
     const { pool, beefyETHVault, usdc, users, WETH, mooweth, aMOOWETH, aUsdc } = testEnv;
     const depositor = users[0];
     const borrower = users[1];
     const ethers = (DRE as any).ethers;
     const amountWETHtoDeposit = await convertToCurrencyDecimals(WETH.address, '30');
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
 
     const wethOwnerAddress = '0xca436e14855323927d6e6264470ded36455fc8bd';
     await impersonateAccountsHardhat([wethOwnerAddress]);
     signer = await ethers.provider.getSigner(wethOwnerAddress);
     await WETH.connect(signer).transfer(borrower.address, amountWETHtoDeposit);
     
     // approve protocol to access borrower wallet
     await WETH.connect(borrower.signer).approve(beefyETHVault.address, amountWETHtoDeposit);
 
     // deposit collateral to borrow
     await beefyETHVault.connect(borrower.signer).depositCollateral(WETH.address, amountWETHtoDeposit);
     expect(await beefyETHVault.getYieldAmount()).to.be.equal(0);
 
     // To simulate yield in lendingPool, deposit some mooweth to aMOOWETH contract
     const moowethOwnerAddress = '0x432b9eb820779d84ca2aff179bc06feb5736bfb0';
     const yieldmoowethAmount = await convertToCurrencyDecimals(WETH.address, '30');
     await impersonateAccountsHardhat([moowethOwnerAddress]);
     signer = await ethers.provider.getSigner(moowethOwnerAddress);
     await mooweth.connect(signer).transfer(aMOOWETH.address, yieldmoowethAmount);
 
     expect(await beefyETHVault.getYieldAmount()).to.be.gt(await convertToCurrencyDecimals(WETH.address, '29.9999'));
     expect(await usdc.balanceOf(beefyETHVault.address)).to.be.equal(0);
     expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
 
     // process yield, so all yield should be converted to usdc
     await beefyETHVault.processYield();
     expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(amountUSDCtoDeposit);
   });
 });
 
 makeSuite('beefyETHVault', (testEnv: TestEnv) => {
   it('distribute yield to supplier for multiple asset', async () => {
     const { pool, beefyETHVault, usdc, usdt, users, mooweth, aUsdc, aUsdt, aMOOWETH, WETH, dai, aDai } = testEnv;
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
 
     const wethOwnerAddress = '0xca436e14855323927d6e6264470ded36455fc8bd';
     const depositWETH = '30';
     const depositWETHAmount = await convertToCurrencyDecimals(WETH.address, depositWETH);
     //Make some test WETH for borrower
     await impersonateAccountsHardhat([wethOwnerAddress]);
     signer = await ethers.provider.getSigner(wethOwnerAddress);
 
     //transfer to borrower
     await WETH.connect(signer).transfer(borrower.address, depositWETHAmount);
 
     //approve protocol to access borrower wallet
     await WETH.connect(borrower.signer).approve(beefyETHVault.address, depositWETHAmount);
 
     // deposit collateral to borrow
     await beefyETHVault.connect(borrower.signer).depositCollateral(WETH.address, depositWETHAmount);
     expect(await beefyETHVault.getYieldAmount()).to.be.equal(0);
 
     //To simulate yield in lendingPool, deposit some yvWETH to aMOOWETH contract
     const moowethOwnerAddress = '0x432b9eb820779d84ca2aff179bc06feb5736bfb0';
     const yieldmooWETH = '30';
     const yieldmooWETHAmount = await convertToCurrencyDecimals(mooweth.address, yieldmooWETH);
     //Make some test yvWETH
     await impersonateAccountsHardhat([moowethOwnerAddress]);
     signer = await ethers.provider.getSigner(moowethOwnerAddress);
     await mooweth.connect(signer).transfer(aMOOWETH.address, yieldmooWETHAmount);
 
     expect((await beefyETHVault.getYieldAmount()).gt(parseEther('29.999'))).to.be.equal(true);
     expect(await usdc.balanceOf(beefyETHVault.address)).to.be.equal(0);
     expect(await dai.balanceOf(beefyETHVault.address)).to.be.equal(0);
     expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
     expect(await aDai.balanceOf(depositor1.address)).to.be.equal(amountDAItoDeposit);
     expect(await aUsdt.balanceOf(depositor2.address)).to.be.equal(amountUSDTtoDeposit);
 
     // process yield, so all yield should be converted to usdc and dai
     await beefyETHVault.processYield();
     expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(amountUSDCtoDeposit);
     expect(await aDai.balanceOf(depositor1.address)).to.be.gt(amountDAItoDeposit);
     expect(await aUsdt.balanceOf(depositor2.address)).to.be.gt(amountUSDTtoDeposit);
   });
 });