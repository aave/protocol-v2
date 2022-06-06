// /**
//  * @dev test for ConvexSTETHVault functions
//  */

// import { expect } from 'chai';
// import { makeSuite, TestEnv, SignerWithAddress } from './helpers/make-suite';
// import { BigNumberish } from 'ethers';
// import {
//   DRE,
//   impersonateAccountsHardhat,
//   advanceBlock,
//   timeLatest,
// } from '../../helpers/misc-utils';
// import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
// import { APPROVAL_AMOUNT_LENDING_POOL, ZERO_ADDRESS } from '../../helpers/constants';

// // Constant to simulate convex yield, it indicates that time period.
// const CONVEX_YIELD_PERIOD = 100000;

// // Constants related to asset amount during test
// const DEPOSIT_AMOUNT = '700';
// const TRANSFER_ATOKEN_AMOUNT = '100';
// const WITHDRAW_AMOUNT = '600'; // = deposit - transfer

// const prepareCollateralForUser = async (
//   testEnv: TestEnv,
//   user: SignerWithAddress,
//   amount: BigNumberish
// ) => {
//   const { STECRV_LP } = testEnv;
//   const ethers = (DRE as any).ethers;

//   // block number: 14749000, balance: 737.243
//   const LPOwnerAddress = '0x43378368d84d4ba00d1c8e97ec2e6016a82fc062';
//   await impersonateAccountsHardhat([LPOwnerAddress]);
//   const signer = await ethers.provider.getSigner(LPOwnerAddress);

//   //transfer to borrower
//   await STECRV_LP.connect(signer).transfer(user.address, amount);
// };

// makeSuite('ConvexSTETHVault - Deposit & Withdraw', (testEnv: TestEnv) => {
//   it('should be reverted if try to use an invalid token as collateral', async () => {
//     const { convexSTETHVault } = testEnv;
//     await expect(convexSTETHVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.revertedWith('82');
//   });
//   it('should be reverted if try to use any of coin other than steCRV as collateral', async () => {
//     const { usdc, convexSTETHVault } = testEnv;
//     // TODO @bshevchenko: use Error const instead of 82
//     await expect(convexSTETHVault.depositCollateral(usdc.address, 1000)).to.be.revertedWith('82');
//   });
//   it('deposit steCRV for collateral', async () => {
//     const { convexSTETHVault, deployer, cvxstecrv, aCVXSTECRV, STECRV_LP } = testEnv;

//     // Prepare some STECRV_LP for depositor
//     const assetAmountToDeposit = await convertToCurrencyDecimals(STECRV_LP.address, DEPOSIT_AMOUNT);
//     await prepareCollateralForUser(testEnv, deployer, assetAmountToDeposit);

//     // allow token transfer to this vault
//     await STECRV_LP.connect(deployer.signer).approve(
//       convexSTETHVault.address,
//       assetAmountToDeposit
//     );

//     // deposit collateral
//     await convexSTETHVault
//       .connect(deployer.signer)
//       .depositCollateral(STECRV_LP.address, assetAmountToDeposit);

//     expect(await STECRV_LP.balanceOf(deployer.address)).to.be.equal(0);
//     expect(await cvxstecrv.balanceOf(convexSTETHVault.address)).to.be.equal(0);
//     expect(await aCVXSTECRV.balanceOf(convexSTETHVault.address)).to.be.equal(0);
//     expect(await aCVXSTECRV.balanceOf(deployer.address)).to.be.gte(assetAmountToDeposit);
//   });

//   it('transferring aCVXSTECRV should be success after deposit STECRV_LP', async () => {
//     const { aCVXSTECRV, users } = testEnv;
//     await expect(
//       aCVXSTECRV.transfer(
//         users[0].address,
//         await convertToCurrencyDecimals(aCVXSTECRV.address, TRANSFER_ATOKEN_AMOUNT)
//       )
//     ).to.not.be.reverted;
//   });

//   it('withdraw from collateral should be failed if user has not enough balance', async () => {
//     const { deployer, convexSTETHVault, STECRV_LP } = testEnv;

//     const amountAssetToWithdraw = await convertToCurrencyDecimals(
//       STECRV_LP.address,
//       DEPOSIT_AMOUNT
//     );
//     await expect(
//       convexSTETHVault.withdrawCollateral(
//         STECRV_LP.address,
//         amountAssetToWithdraw,
//         9900,
//         deployer.address
//       )
//     ).to.be.reverted;
//   });

//   it('withdraw from collateral', async () => {
//     const { deployer, cvxstecrv, convexSTETHVault, STECRV_LP } = testEnv;
//     const dola3crvBalanceOfPool = await cvxstecrv.balanceOf(convexSTETHVault.address);
//     const beforeBalanceOfUser = await STECRV_LP.balanceOf(deployer.address);
//     // withdraw
//     const amountAssetToWithdraw = await convertToCurrencyDecimals(
//       STECRV_LP.address,
//       WITHDRAW_AMOUNT
//     );
//     await convexSTETHVault
//       .connect(deployer.signer)
//       .withdrawCollateral(STECRV_LP.address, amountAssetToWithdraw, 9900, deployer.address);

//     const afterBalanceOfUser = await STECRV_LP.balanceOf(deployer.address);

//     expect(dola3crvBalanceOfPool).to.be.equal(0);
//     expect(afterBalanceOfUser.sub(beforeBalanceOfUser)).to.be.gte(
//       await convertToCurrencyDecimals(STECRV_LP.address, WITHDRAW_AMOUNT)
//     );
//     expect(await STECRV_LP.balanceOf(convexSTETHVault.address)).to.be.equal(0);
//   });
// });

// makeSuite('ConvexSTETHVault - Process Yield', (testEnv: TestEnv) => {
//   it('send yield to YieldManager', async () => {
//     const { convexSTETHVault, users, STECRV_LP, CRV, CVX, yieldManager } = testEnv;
//     const borrower = users[1];

//     // borrower provides DOLA3CRV
//     const assetAmountToDeposit = await convertToCurrencyDecimals(STECRV_LP.address, DEPOSIT_AMOUNT);
//     await prepareCollateralForUser(testEnv, borrower, assetAmountToDeposit);
//     await STECRV_LP.connect(borrower.signer).approve(
//       convexSTETHVault.address,
//       APPROVAL_AMOUNT_LENDING_POOL
//     );
//     await convexSTETHVault
//       .connect(borrower.signer)
//       .depositCollateral(STECRV_LP.address, assetAmountToDeposit);
//     expect(await convexSTETHVault.getYieldAmount()).to.be.equal(0);
//     const beforeBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
//     const beforeBalanceOfCVX = await CVX.balanceOf(yieldManager.address);

//     // Simulate yield
//     await advanceBlock((await timeLatest()).plus(CONVEX_YIELD_PERIOD).toNumber());

//     // process yield, so all yield should be sent to YieldManager
//     await convexSTETHVault.processYield();

//     const afterBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
//     const afterBalanceOfCVX = await CRV.balanceOf(yieldManager.address);
//     expect(afterBalanceOfCRV).to.be.gt(beforeBalanceOfCRV);
//     expect(afterBalanceOfCVX).to.be.gt(beforeBalanceOfCVX);
//   });
// });
