// /**
//  * @dev test for YearnRETHWstETHVault functions
//  */

// import { expect } from 'chai';
// import { makeSuite, TestEnv } from './helpers/make-suite';
// import { ethers } from 'ethers';
// import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
// import { printDivider } from './helpers/utils/helpers';
// import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
// import { APPROVAL_AMOUNT_LENDING_POOL, ZERO_ADDRESS } from '../../helpers/constants';

// const { parseEther } = ethers.utils;

// makeSuite('YearnRETHWstETHVault', (testEnv: TestEnv) => {
//   it('failed deposit for collateral without ether', async () => {
//     const { yearnRETHWstETHVault } = testEnv;

//     await expect(yearnRETHWstETHVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
//   });

//   it('deposit rETH-WstETH for collateral', async () => {
//     const { yearnRETHWstETHVault, deployer, yvreth_wsteth, aYVRETH_WSTETH, RETH_WSTETH_LP } =
//       testEnv;
//     const ethers = (DRE as any).ethers;

//     // Make some test RETH_WSTETH_LP for depositor
//     const amountRETHWstETHLPtoDeposit = await convertToCurrencyDecimals(
//       RETH_WSTETH_LP.address,
//       '1.1'
//     );
//     const rETHWstETHLPOwnerAddress = '0x427E51f03D287809ab684878AE2176BA347c8c25';
//     await impersonateAccountsHardhat([rETHWstETHLPOwnerAddress]);
//     let signer = await ethers.provider.getSigner(rETHWstETHLPOwnerAddress);
//     await RETH_WSTETH_LP.connect(signer).transfer(deployer.address, amountRETHWstETHLPtoDeposit);

//     await RETH_WSTETH_LP.connect(deployer.signer).approve(
//       yearnRETHWstETHVault.address,
//       amountRETHWstETHLPtoDeposit
//     );

//     await yearnRETHWstETHVault
//       .connect(deployer.signer)
//       .depositCollateral(RETH_WSTETH_LP.address, amountRETHWstETHLPtoDeposit);

//     expect(await yvreth_wsteth.balanceOf(yearnRETHWstETHVault.address)).to.be.equal(0);
//     expect(await aYVRETH_WSTETH.balanceOf(yearnRETHWstETHVault.address)).to.be.equal(0);
//     expect(await aYVRETH_WSTETH.balanceOf(deployer.address)).to.be.gte(
//       await convertToCurrencyDecimals(RETH_WSTETH_LP.address, '1.099')
//     );
//     expect(await RETH_WSTETH_LP.balanceOf(deployer.address)).to.be.equal(0);
//   });

//   it('transferring aYVRETH_WSTETH should be success after deposit ETH', async () => {
//     const { aYVRETH_WSTETH, users } = testEnv;
//     await expect(
//       aYVRETH_WSTETH.transfer(
//         users[0].address,
//         await convertToCurrencyDecimals(aYVRETH_WSTETH.address, '0.05')
//       )
//     ).to.not.be.reverted;
//   });

//   it('withdraw from collateral should be failed if user has not enough balance', async () => {
//     const { deployer, yearnRETHWstETHVault, RETH_WSTETH_LP } = testEnv;
//     const amountRETHWstETHLPtoDeposit = await convertToCurrencyDecimals(
//       RETH_WSTETH_LP.address,
//       '1.1'
//     );
//     await expect(
//       yearnRETHWstETHVault.withdrawCollateral(
//         RETH_WSTETH_LP.address,
//         amountRETHWstETHLPtoDeposit,
//         9900,
//         deployer.address
//       )
//     ).to.be.reverted;
//   });

//   it('withdraw from collateral', async () => {
//     const { deployer, yvreth_wsteth, yearnRETHWstETHVault, RETH_WSTETH_LP } = testEnv;
//     const rethwstethBalanceOfPool = await yvreth_wsteth.balanceOf(yearnRETHWstETHVault.address);
//     const rETHWstETHLPBeforeBalanceOfUser = await RETH_WSTETH_LP.balanceOf(deployer.address);
//     const rETHWstETHLPWithdrawAmount = await convertToCurrencyDecimals(
//       RETH_WSTETH_LP.address,
//       '1.0499'
//     );

//     await yearnRETHWstETHVault
//       .connect(deployer.signer)
//       .withdrawCollateral(RETH_WSTETH_LP.address, rETHWstETHLPWithdrawAmount, 9900, deployer.address);

//     const rETHWstETHLPCurrentBalanceOfUser = await RETH_WSTETH_LP.balanceOf(deployer.address);
//     expect(rethwstethBalanceOfPool).to.be.equal(0);
//     expect(rETHWstETHLPCurrentBalanceOfUser.sub(rETHWstETHLPBeforeBalanceOfUser)).to.be.gte(
//       await convertToCurrencyDecimals(RETH_WSTETH_LP.address, '1.049')
//     );
//     expect(await RETH_WSTETH_LP.balanceOf(yearnRETHWstETHVault.address)).to.be.equal(0);
//   });
// });

// makeSuite('yearnRETHWstETHVault - use other coin as collateral', (testEnv) => {
//   it('Should revert to use any of coin other than TOMB_MIMATIC_LP as collateral', async () => {
//     const { usdc, yearnRETHWstETHVault, yvreth_wsteth } = testEnv;
//     // TODO @bshevchenko: use Error const instead of 82
//     await expect(
//       yearnRETHWstETHVault.depositCollateral(yvreth_wsteth.address, 1000)
//     ).to.be.revertedWith('82');
//   });
// });

// makeSuite('yearnRETHWstETHVault', (testEnv: TestEnv) => {
//   it('distribute yield to supplier for single asset', async () => {
//     const {
//       pool,
//       yearnRETHWstETHVault,
//       usdc,
//       users,
//       yvreth_wsteth,
//       aUsdc,
//       aYVRETH_WSTETH,
//       RETH_WSTETH_LP,
//     } = testEnv;
//     const depositor = users[0];
//     const borrower = users[1];
//     const ethers = (DRE as any).ethers;
//     const usdcOwnerAddress = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503';
//     const depositUSDC = '7000';
//     //Make some test USDC for depositor
//     await impersonateAccountsHardhat([usdcOwnerAddress]);
//     let signer = await ethers.provider.getSigner(usdcOwnerAddress);
//     const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
//     await usdc.connect(signer).transfer(depositor.address, amountUSDCtoDeposit);

//     //approve protocol to access depositor wallet
//     await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

//     //Supplier  deposits 7000 USDC
//     await pool
//       .connect(depositor.signer)
//       .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

//     const rETHWstETHLPOwnerAddress = '0x427E51f03D287809ab684878AE2176BA347c8c25';
//     const depositRETHWstETH = '10';
//     const depositRETHWstETHAmount = await convertToCurrencyDecimals(
//       RETH_WSTETH_LP.address,
//       depositRETHWstETH
//     );
//     //Make some test stETH for borrower
//     await impersonateAccountsHardhat([rETHWstETHLPOwnerAddress]);
//     signer = await ethers.provider.getSigner(rETHWstETHLPOwnerAddress);

//     //transfer to borrower
//     await RETH_WSTETH_LP.connect(signer).transfer(borrower.address, depositRETHWstETHAmount);

//     //approve protocol to access borrower wallet
//     await RETH_WSTETH_LP.connect(borrower.signer).approve(
//       yearnRETHWstETHVault.address,
//       APPROVAL_AMOUNT_LENDING_POOL
//     );

//     // deposit collateral to borrow
//     await yearnRETHWstETHVault
//       .connect(borrower.signer)
//       .depositCollateral(RETH_WSTETH_LP.address, depositRETHWstETHAmount);
//     expect(await yearnRETHWstETHVault.getYieldAmount()).to.be.equal(0);

//     //To simulate yield in lendingPool, deposit some yvRETHWstETH to aYVRETH_WSTETH contract
//     const yvRETHWstETHOwnerAddress = '0x409411817B3c5C752a84C777eBe1c19d9D4Aa209';
//     const yieldyvRETHWstETH = '10';
//     const yieldyvRETHWstETHAmount = await convertToCurrencyDecimals(
//       yvreth_wsteth.address,
//       yieldyvRETHWstETH
//     );
//     //Make some test yvRETHWstETH
//     await impersonateAccountsHardhat([yvRETHWstETHOwnerAddress]);
//     signer = await ethers.provider.getSigner(yvRETHWstETHOwnerAddress);
//     await yvreth_wsteth.connect(signer).transfer(aYVRETH_WSTETH.address, yieldyvRETHWstETHAmount);

//     expect(
//       (await yearnRETHWstETHVault.getYieldAmount()).gt(
//         await convertToCurrencyDecimals(RETH_WSTETH_LP.address, '9.999')
//       )
//     ).to.be.equal(true);
//     expect(await usdc.balanceOf(yearnRETHWstETHVault.address)).to.be.equal(0);
//     expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);

//     // process yield, so all yield should be converted to usdc
//     await yearnRETHWstETHVault.processYield();
//     const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '33000');
//     expect((await aUsdc.balanceOf(depositor.address)).gt(yieldUSDC)).to.be.equal(true);
//   });
// });

// makeSuite('yearnRETHWstETHVault', (testEnv: TestEnv) => {
//   it('distribute yield to supplier for multiple asset', async () => {
//     const {
//       pool,
//       yearnRETHWstETHVault,
//       usdc,
//       users,
//       yvreth_wsteth,
//       aUsdc,
//       aYVRETH_WSTETH,
//       dai,
//       aDai,
//       RETH_WSTETH_LP,
//     } = testEnv;
//     const depositor = users[0];
//     const other_depositor = users[1];
//     const borrower = users[2];
//     const ethers = (DRE as any).ethers;
//     const usdcOwnerAddress = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503';
//     const depositUSDC = '7000';
//     //Make some test USDC for depositor
//     await impersonateAccountsHardhat([usdcOwnerAddress]);
//     let signer = await ethers.provider.getSigner(usdcOwnerAddress);
//     const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
//     await usdc.connect(signer).transfer(depositor.address, amountUSDCtoDeposit);

//     //approve protocol to access depositor wallet
//     await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

//     //Supplier  deposits 7000 USDC
//     await pool
//       .connect(depositor.signer)
//       .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

//     const daiOwnerAddress = '0x4967ec98748efb98490663a65b16698069a1eb35';
//     const depositDAI = '3500';
//     //Make some test DAI for depositor
//     await impersonateAccountsHardhat([daiOwnerAddress]);
//     signer = await ethers.provider.getSigner(daiOwnerAddress);
//     const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, depositDAI);
//     await dai.connect(signer).transfer(other_depositor.address, amountDAItoDeposit);

//     //approve protocol to access depositor wallet
//     await dai.connect(other_depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

//     //Supplier  deposits 3500 DAI
//     await pool
//       .connect(other_depositor.signer)
//       .deposit(dai.address, amountDAItoDeposit, other_depositor.address, '0');

//     const rETHWstETHLPOwnerAddress = '0x427E51f03D287809ab684878AE2176BA347c8c25';
//     const depositRETHWstETH = '10';
//     const depositRETHWstETHAmount = await convertToCurrencyDecimals(
//       RETH_WSTETH_LP.address,
//       depositRETHWstETH
//     );
//     //Make some test stETH for borrower
//     await impersonateAccountsHardhat([rETHWstETHLPOwnerAddress]);
//     signer = await ethers.provider.getSigner(rETHWstETHLPOwnerAddress);

//     //transfer to borrower
//     await RETH_WSTETH_LP.connect(signer).transfer(borrower.address, depositRETHWstETHAmount);

//     //approve protocol to access borrower wallet
//     await RETH_WSTETH_LP.connect(borrower.signer).approve(
//       yearnRETHWstETHVault.address,
//       APPROVAL_AMOUNT_LENDING_POOL
//     );

//     // deposit collateral to borrow
//     await yearnRETHWstETHVault
//       .connect(borrower.signer)
//       .depositCollateral(RETH_WSTETH_LP.address, depositRETHWstETHAmount);
//     expect(await yearnRETHWstETHVault.getYieldAmount()).to.be.equal(0);

//     //To simulate yield in lendingPool, deposit some yvRETHWstETH to aYVRETH_WSTETH contract
//     const yvRETHWstETHOwnerAddress = '0x409411817B3c5C752a84C777eBe1c19d9D4Aa209';
//     const yieldyvRETHWstETH = '10';
//     const yieldyvRETHWstETHAmount = await convertToCurrencyDecimals(
//       yvreth_wsteth.address,
//       yieldyvRETHWstETH
//     );
//     //Make some test yvRETHWstETH
//     await impersonateAccountsHardhat([yvRETHWstETHOwnerAddress]);
//     signer = await ethers.provider.getSigner(yvRETHWstETHOwnerAddress);
//     await yvreth_wsteth.connect(signer).transfer(aYVRETH_WSTETH.address, yieldyvRETHWstETHAmount);

//     expect(
//       (await yearnRETHWstETHVault.getYieldAmount()).gt(
//         await convertToCurrencyDecimals(yvreth_wsteth.address, '9.999')
//       )
//     ).to.be.equal(true);
//     expect(await usdc.balanceOf(yearnRETHWstETHVault.address)).to.be.equal(0);
//     expect(await dai.balanceOf(yearnRETHWstETHVault.address)).to.be.equal(0);
//     expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
//     expect(await aDai.balanceOf(other_depositor.address)).to.be.equal(amountDAItoDeposit);

//     // process yield, so all yield should be converted to usdc and dai
//     await yearnRETHWstETHVault.processYield();
//     const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '24000');
//     const yieldDAI = await convertToCurrencyDecimals(dai.address, '11500');
//     expect((await aUsdc.balanceOf(depositor.address)).gt(yieldUSDC)).to.be.equal(true);
//     expect((await aDai.balanceOf(other_depositor.address)).gt(yieldDAI)).to.be.equal(true);
//   });
// });
