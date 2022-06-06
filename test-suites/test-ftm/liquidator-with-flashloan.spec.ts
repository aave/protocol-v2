/**
 * @dev test for liquidation with flashloan contract
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { convertToCurrencyDecimals, getEthersSigners } from '../../helpers/contracts-helpers';
import { getLendingPoolConfiguratorProxy } from '../../helpers/contracts-getters';
import BigNumber from 'bignumber.js';
import { RateMode } from '../../helpers/types';

const { parseEther } = ethers.utils;

// // should pass on block number 34239888 on forked ftm without deploy case
// makeSuite('Liquidator', (testEnv: TestEnv) => {
//   it('call liquidator for WFTM', async () => {
//     const { liquidator, deployer, usdc, WFTM, yvwftm } = testEnv;
//     const ethers = (DRE as any).ethers;
//     const abiEncoder = new ethers.utils.AbiCoder();
//     const encodedData = abiEncoder.encode(
//       ["address", "address"],
//       [WFTM.address, deployer.address]
//     );
//     // set liquidation threshold 35%
//     await impersonateAccountsHardhat(['0x154D73802a6B3324c017481AC818050afE4a0b0A']);
//     let signer = await ethers.provider.getSigner('0x154D73802a6B3324c017481AC818050afE4a0b0A');
//     const configurator = await getLendingPoolConfiguratorProxy();
//     await configurator.connect(signer).configureReserveAsCollateral(yvwftm.address, '3000', '3500', '10500');

//     // process liquidation by using flashloan contract
//     await liquidator.liquidation(usdc.address, await convertToCurrencyDecimals(usdc.address, '100'), encodedData);
    
//     // withdraw remained usdc from flashloan contract
//     const beforeUsdcBalance = await usdc.balanceOf(deployer.address);
//     await liquidator.connect(deployer.signer).withdraw(usdc.address);
//     const usdcBalance = await usdc.balanceOf(deployer.address);
//     expect(usdcBalance.sub(beforeUsdcBalance).gt(await convertToCurrencyDecimals(usdc.address, '0.03'))).to.eq(true);
//   });
// });

// // should pass on block number 35228321 on forked ftm without deploy case
// makeSuite('Liquidator', (testEnv: TestEnv) => {
//   it('call liquidator for fBEETS', async () => {
//     const { liquidator, deployer, usdc, fBEETS, yearnFBEETSVault, pool, oracle, yvfbeets } = testEnv;
//     const ethers = (DRE as any).ethers;
//     const borrower = (await getEthersSigners())[0];
//     const borrowerAddress = await borrower.getAddress();
//     const abiEncoder = new ethers.utils.AbiCoder();
//     const encodedData = abiEncoder.encode(
//       ["address", "address"],
//       [fBEETS.address, borrowerAddress]
//     );

//     // Make some test fBEETS for depositor
//     const amountfBEETStoDeposit = await convertToCurrencyDecimals(fBEETS.address, '100');
//     const fBEETSOwnerAddress = '0xe97178f627268f4cead069237db9f50f66d17d97';
//     await impersonateAccountsHardhat([fBEETSOwnerAddress]);
//     let signer = await ethers.provider.getSigner(fBEETSOwnerAddress);
//     await fBEETS.connect(signer).transfer(borrowerAddress, amountfBEETStoDeposit);
    
//     await fBEETS.connect(borrower).approve(yearnFBEETSVault.address, amountfBEETStoDeposit);

//     await yearnFBEETSVault.connect(borrower).depositCollateral(fBEETS.address, amountfBEETStoDeposit);

//     // borrow
//     const userGlobalData = await pool.getUserAccountData(borrowerAddress);
//     const usdcPrice = await oracle.getAssetPrice(usdc.address);

//     const amountUSDCToBorrow = await convertToCurrencyDecimals(
//       usdc.address,
//       new BigNumber(userGlobalData.availableBorrowsETH.toString())
//         .div(usdcPrice.toString())
//         .multipliedBy(0.95)
//         .toFixed(0)
//     );

//     await pool
//       .connect(borrower)
//       .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrowerAddress);

//     // set liquidation threshold 35%
//     await impersonateAccountsHardhat(['0x154D73802a6B3324c017481AC818050afE4a0b0A']);
//     signer = await ethers.provider.getSigner('0x154D73802a6B3324c017481AC818050afE4a0b0A');
//     const configurator = await getLendingPoolConfiguratorProxy();
//     await configurator.connect(signer).configureReserveAsCollateral(yvfbeets.address, '3000', '3500', '10500');

//     // process liquidation by using flashloan contract
//     await liquidator.liquidation(usdc.address, await convertToCurrencyDecimals(usdc.address, '100'), encodedData);
    
//     // withdraw remained usdc from flashloan contract
//     const beforeUsdcBalance = await usdc.balanceOf(deployer.address);
//     await liquidator.connect(deployer.signer).withdraw(usdc.address);
//     const usdcBalance = await usdc.balanceOf(deployer.address);
//     expect(usdcBalance.sub(beforeUsdcBalance).gt(await convertToCurrencyDecimals(usdc.address, '0.03'))).to.eq(true);
//   });
// });

// // should pass on block number 35228321 on forked ftm without deploy case
// makeSuite('Liquidator', (testEnv: TestEnv) => {
//   it('call liquidator for LINK', async () => {
//     const { liquidator, deployer, usdc, LINK, yearnLINKVault, pool, oracle, yvlink } = testEnv;
//     const ethers = (DRE as any).ethers;
//     const borrower = (await getEthersSigners())[0];
//     const borrowerAddress = await borrower.getAddress();
//     const abiEncoder = new ethers.utils.AbiCoder();
//     const encodedData = abiEncoder.encode(
//       ["address", "address"],
//       [LINK.address, borrowerAddress]
//     );

//     // Make some test LINK for depositor
//     const amountLINKtoDeposit = await convertToCurrencyDecimals(LINK.address, '100');
//     const linkOwnerAddress = '0xa75ede99f376dd47f3993bc77037f61b5737c6ea';
//     await impersonateAccountsHardhat([linkOwnerAddress]);
//     let signer = await ethers.provider.getSigner(linkOwnerAddress);
//     await LINK.connect(signer).transfer(borrowerAddress, amountLINKtoDeposit);
    
//     await LINK.connect(borrower).approve(yearnLINKVault.address, amountLINKtoDeposit);

//     await yearnLINKVault.connect(borrower).depositCollateral(LINK.address, amountLINKtoDeposit);

//     // borrow
//     const userGlobalData = await pool.getUserAccountData(borrowerAddress);
//     const usdcPrice = await oracle.getAssetPrice(usdc.address);

//     const amountUSDCToBorrow = await convertToCurrencyDecimals(
//       usdc.address,
//       new BigNumber(userGlobalData.availableBorrowsETH.toString())
//         .div(usdcPrice.toString())
//         .multipliedBy(0.95)
//         .toFixed(0)
//     );

//     await pool
//       .connect(borrower)
//       .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrowerAddress);

//     // set liquidation threshold 35%
//     await impersonateAccountsHardhat(['0x154D73802a6B3324c017481AC818050afE4a0b0A']);
//     signer = await ethers.provider.getSigner('0x154D73802a6B3324c017481AC818050afE4a0b0A');
//     const configurator = await getLendingPoolConfiguratorProxy();
//     await configurator.connect(signer).configureReserveAsCollateral(yvlink.address, '3000', '3500', '10500');

//     // process liquidation by using flashloan contract
//     await liquidator.liquidation(usdc.address, await convertToCurrencyDecimals(usdc.address, '100'), encodedData);
    
//     // withdraw remained usdc from flashloan contract
//     const beforeUsdcBalance = await usdc.balanceOf(deployer.address);
//     await liquidator.connect(deployer.signer).withdraw(usdc.address);
//     const usdcBalance = await usdc.balanceOf(deployer.address);
//     expect(usdcBalance.sub(beforeUsdcBalance).gt(await convertToCurrencyDecimals(usdc.address, '0.03'))).to.eq(true);
//   });
// });

// // should pass on block number 35486157 on forked ftm without deploy case
// makeSuite('Liquidator', (testEnv: TestEnv) => {
//   it('call liquidator for SPELL', async () => {
//     const { liquidator, deployer, usdc, SPELL, yearnSPELLVault, pool, oracle, yvspell } = testEnv;
//     const ethers = (DRE as any).ethers;
//     const borrower = (await getEthersSigners())[0];
//     const borrowerAddress = await borrower.getAddress();
//     const abiEncoder = new ethers.utils.AbiCoder();
//     const encodedData = abiEncoder.encode(
//       ["address", "address"],
//       [SPELL.address, borrowerAddress]
//     );

//     // Make some test SPELL for depositor
//     const amountSPELLtoDeposit = await convertToCurrencyDecimals(SPELL.address, '20000');
//     const spellOwnerAddress = '0x0249fbbd411944249a2625dfc0fdee6bd1c41b36';
//     await impersonateAccountsHardhat([spellOwnerAddress]);
//     let signer = await ethers.provider.getSigner(spellOwnerAddress);
//     await SPELL.connect(signer).transfer(borrowerAddress, amountSPELLtoDeposit);
    
//     await SPELL.connect(borrower).approve(yearnSPELLVault.address, amountSPELLtoDeposit);

//     await yearnSPELLVault.connect(borrower).depositCollateral(SPELL.address, amountSPELLtoDeposit);

//     // borrow
//     const userGlobalData = await pool.getUserAccountData(borrowerAddress);
//     const usdcPrice = await oracle.getAssetPrice(usdc.address);

//     const amountUSDCToBorrow = await convertToCurrencyDecimals(
//       usdc.address,
//       new BigNumber(userGlobalData.availableBorrowsETH.toString())
//         .div(usdcPrice.toString())
//         .multipliedBy(0.95)
//         .toFixed(0)
//     );

//     await pool
//       .connect(borrower)
//       .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrowerAddress);

//     // set liquidation threshold 35%
//     await impersonateAccountsHardhat(['0x154D73802a6B3324c017481AC818050afE4a0b0A']);
//     signer = await ethers.provider.getSigner('0x154D73802a6B3324c017481AC818050afE4a0b0A');
//     const configurator = await getLendingPoolConfiguratorProxy();
//     await configurator.connect(signer).configureReserveAsCollateral(yvspell.address, '3000', '3500', '10500');

//     // process liquidation by using flashloan contract
//     await liquidator.liquidation(usdc.address, await convertToCurrencyDecimals(usdc.address, '600'), encodedData);
    
//     // withdraw remained usdc from flashloan contract
//     const beforeUsdcBalance = await usdc.balanceOf(deployer.address);
//     await liquidator.connect(deployer.signer).withdraw(usdc.address);
//     const usdcBalance = await usdc.balanceOf(deployer.address);
//     expect(usdcBalance.sub(beforeUsdcBalance).gt(await convertToCurrencyDecimals(usdc.address, '0.03'))).to.eq(true);
//   });
// });

// // should pass on block number 35816195 on forked ftm without deploy case
// makeSuite('Liquidator', (testEnv: TestEnv) => {
//   it('call liquidator for CRV', async () => {
//     const { liquidator, deployer, usdc, CRV, yearnCRVVault, pool, oracle, yvcrv } = testEnv;
//     const ethers = (DRE as any).ethers;
//     const borrower = (await getEthersSigners())[0];
//     const borrowerAddress = await borrower.getAddress();
//     const abiEncoder = new ethers.utils.AbiCoder();
//     const encodedData = abiEncoder.encode(
//       ["address", "address"],
//       [CRV.address, borrowerAddress]
//     );

//     // Make some test CRV for depositor
//     const amountCRVtoDeposit = await convertToCurrencyDecimals(CRV.address, '100');
//     const crvOwnerAddress = '0xf39C7F98121cc31840942D374Ca9969CB3B1Bf3b';
//     await impersonateAccountsHardhat([crvOwnerAddress]);
//     let signer = await ethers.provider.getSigner(crvOwnerAddress);
//     await CRV.connect(signer).transfer(borrowerAddress, amountCRVtoDeposit);
    
//     await CRV.connect(borrower).approve(yearnCRVVault.address, amountCRVtoDeposit);

//     await yearnCRVVault.connect(borrower).depositCollateral(CRV.address, amountCRVtoDeposit);

//     // borrow
//     const userGlobalData = await pool.getUserAccountData(borrowerAddress);
//     const usdcPrice = await oracle.getAssetPrice(usdc.address);

//     const amountUSDCToBorrow = await convertToCurrencyDecimals(
//       usdc.address,
//       new BigNumber(userGlobalData.availableBorrowsETH.toString())
//         .div(usdcPrice.toString())
//         .multipliedBy(0.95)
//         .toFixed(0)
//     );

//     await pool
//       .connect(borrower)
//       .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrowerAddress);

//     // set liquidation threshold 35%
//     await impersonateAccountsHardhat(['0x154D73802a6B3324c017481AC818050afE4a0b0A']);
//     signer = await ethers.provider.getSigner('0x154D73802a6B3324c017481AC818050afE4a0b0A');
//     const configurator = await getLendingPoolConfiguratorProxy();
//     await configurator.connect(signer).configureReserveAsCollateral(yvcrv.address, '3000', '3500', '10500');

//     // process liquidation by using flashloan contract
//     await liquidator.liquidation(usdc.address, await convertToCurrencyDecimals(usdc.address, '100'), encodedData);
    
//     // withdraw remained usdc from flashloan contract
//     const beforeUsdcBalance = await usdc.balanceOf(deployer.address);
//     await liquidator.connect(deployer.signer).withdraw(usdc.address);
//     const usdcBalance = await usdc.balanceOf(deployer.address);
//     expect(usdcBalance.sub(beforeUsdcBalance).gt(await convertToCurrencyDecimals(usdc.address, '0.03'))).to.eq(true);
//   });
// });

// makeSuite('Liquidator', (testEnv: TestEnv) => {
//   it('call liquidator for WFTM', async () => {
//     const { liquidator, deployer, usdc, WFTM, yvwftm } = testEnv;
//     const ethers = (DRE as any).ethers;
//     const abiEncoder = new ethers.utils.AbiCoder();
//     const encodedData = abiEncoder.encode(
//       ["address", "address"],
//       [WFTM.address, deployer.address]
//     );
//     // set liquidation threshold 35%
//     await impersonateAccountsHardhat(['0x154D73802a6B3324c017481AC818050afE4a0b0A']);
//     let signer = await ethers.provider.getSigner('0x154D73802a6B3324c017481AC818050afE4a0b0A');
//     const configurator = await getLendingPoolConfiguratorProxy();
//     await configurator.connect(signer).configureReserveAsCollateral(yvwftm.address, '3000', '3500', '10500');

//     // process liquidation by using flashloan contract
//     await liquidator.liquidation(usdc.address, await convertToCurrencyDecimals(usdc.address, '100'), encodedData);
    
//     // withdraw remained usdc from flashloan contract
//     const beforeUsdcBalance = await usdc.balanceOf(deployer.address);
//     await liquidator.connect(deployer.signer).withdraw(usdc.address);
//     const usdcBalance = await usdc.balanceOf(deployer.address);
//     expect(usdcBalance.sub(beforeUsdcBalance).gt(await convertToCurrencyDecimals(usdc.address, '0.03'))).to.eq(true);

//     // retry liquidation should be failed
//     await expect(liquidator.liquidation(usdc.address, await convertToCurrencyDecimals(usdc.address, '100'), encodedData)).to.be.reverted;
//   });
// });