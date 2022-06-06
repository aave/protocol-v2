// /**
//  * @dev test for ConvexDOLA3CRVVault functions
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
// const DEPOSIT_AMOUNT = '3000';
// const TRANSFER_ATOKEN_AMOUNT = '1000';
// const WITHDRAW_AMOUNT = '2000'; // = deposit - transfer

// const prepareCollateralForUser = async (
//   testEnv: TestEnv,
//   user: SignerWithAddress,
//   amount: BigNumberish
// ) => {
//   const { DOLA_3CRV_LP } = testEnv;
//   const ethers = (DRE as any).ethers;

//   const LPOwnerAddress = '0xa83f6bec55a100ca3402245fc1d46127889354ec';
//   await impersonateAccountsHardhat([LPOwnerAddress]);
//   const signer = await ethers.provider.getSigner(LPOwnerAddress);

//   //transfer to borrower
//   await DOLA_3CRV_LP.connect(signer).transfer(user.address, amount);
// };

// makeSuite('ConvexDOLA3CRVVault - Deposit & Withdraw', (testEnv: TestEnv) => {
//   it('should be reverted if try to use an invalid token as collateral', async () => {
//     const { convexDOLA3CRVVault } = testEnv;
//     await expect(convexDOLA3CRVVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.revertedWith('82');
//   });
//   it('should be reverted if try to use any of coin other than DOLA3CRV-f as collateral', async () => {
//     const { usdc, convexDOLA3CRVVault } = testEnv;
//     // TODO @bshevchenko: use Error const instead of 82
//     await expect(convexDOLA3CRVVault.depositCollateral(usdc.address, 1000)).to.be.revertedWith(
//       '82'
//     );
//   });
//   it('deposit DOLA-3CRV for collateral', async () => {
//     const { convexDOLA3CRVVault, deployer, cvxdola_3crv, aCVXDOLA_3CRV, DOLA_3CRV_LP } = testEnv;

//     // Prepare some DOLA_3CRV_LP for depositor
//     const assetAmountToDeposit = await convertToCurrencyDecimals(
//       DOLA_3CRV_LP.address,
//       DEPOSIT_AMOUNT
//     );
//     await prepareCollateralForUser(testEnv, deployer, assetAmountToDeposit);

//     // allow token transfer to this vault
//     await DOLA_3CRV_LP.connect(deployer.signer).approve(
//       convexDOLA3CRVVault.address,
//       assetAmountToDeposit
//     );

//     // deposit collateral
//     await convexDOLA3CRVVault
//       .connect(deployer.signer)
//       .depositCollateral(DOLA_3CRV_LP.address, assetAmountToDeposit);

//     expect(await DOLA_3CRV_LP.balanceOf(deployer.address)).to.be.equal(0);
//     expect(await cvxdola_3crv.balanceOf(convexDOLA3CRVVault.address)).to.be.equal(0);
//     expect(await aCVXDOLA_3CRV.balanceOf(convexDOLA3CRVVault.address)).to.be.equal(0);
//     expect(await aCVXDOLA_3CRV.balanceOf(deployer.address)).to.be.gte(assetAmountToDeposit);
//   });

//   it('transferring aCVXDOLA_3CRV should be success after deposit DOLA_3CRV_LP', async () => {
//     const { aCVXDOLA_3CRV, users } = testEnv;
//     await expect(
//       aCVXDOLA_3CRV.transfer(
//         users[0].address,
//         await convertToCurrencyDecimals(aCVXDOLA_3CRV.address, TRANSFER_ATOKEN_AMOUNT)
//       )
//     ).to.not.be.reverted;
//   });

//   it('withdraw from collateral should be failed if user has not enough balance', async () => {
//     const { deployer, convexDOLA3CRVVault, DOLA_3CRV_LP } = testEnv;

//     const amountAssetToWithdraw = await convertToCurrencyDecimals(
//       DOLA_3CRV_LP.address,
//       DEPOSIT_AMOUNT
//     );
//     await expect(
//       convexDOLA3CRVVault.withdrawCollateral(
//         DOLA_3CRV_LP.address,
//         amountAssetToWithdraw,
//         9900,
//         deployer.address
//       )
//     ).to.be.reverted;
//   });

//   it('withdraw from collateral', async () => {
//     const { deployer, cvxdola_3crv, convexDOLA3CRVVault, DOLA_3CRV_LP } = testEnv;
//     const dola3crvBalanceOfPool = await cvxdola_3crv.balanceOf(convexDOLA3CRVVault.address);
//     const beforeBalanceOfUser = await DOLA_3CRV_LP.balanceOf(deployer.address);
//     // withdraw
//     const amountAssetToWithdraw = await convertToCurrencyDecimals(
//       DOLA_3CRV_LP.address,
//       WITHDRAW_AMOUNT
//     );
//     await convexDOLA3CRVVault
//       .connect(deployer.signer)
//       .withdrawCollateral(DOLA_3CRV_LP.address, amountAssetToWithdraw, 9900, deployer.address);

//     const afterBalanceOfUser = await DOLA_3CRV_LP.balanceOf(deployer.address);

//     expect(dola3crvBalanceOfPool).to.be.equal(0);
//     expect(afterBalanceOfUser.sub(beforeBalanceOfUser)).to.be.gte(
//       await convertToCurrencyDecimals(DOLA_3CRV_LP.address, WITHDRAW_AMOUNT)
//     );
//     expect(await DOLA_3CRV_LP.balanceOf(convexDOLA3CRVVault.address)).to.be.equal(0);
//   });
// });

// makeSuite('ConvexDOLA3CRVVault - Process Yield', (testEnv: TestEnv) => {
//   it('send yield to YieldManager', async () => {
//     const { convexDOLA3CRVVault, users, DOLA_3CRV_LP, CRV, CVX, yieldManager } = testEnv;
//     const borrower = users[1];

//     // borrower provides DOLA3CRV
//     const assetAmountToDeposit = await convertToCurrencyDecimals(
//       DOLA_3CRV_LP.address,
//       DEPOSIT_AMOUNT
//     );
//     await prepareCollateralForUser(testEnv, borrower, assetAmountToDeposit);
//     await DOLA_3CRV_LP.connect(borrower.signer).approve(
//       convexDOLA3CRVVault.address,
//       APPROVAL_AMOUNT_LENDING_POOL
//     );
//     await convexDOLA3CRVVault
//       .connect(borrower.signer)
//       .depositCollateral(DOLA_3CRV_LP.address, assetAmountToDeposit);
//     expect(await convexDOLA3CRVVault.getYieldAmount()).to.be.equal(0);
//     const beforeBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
//     const beforeBalanceOfCVX = await CVX.balanceOf(yieldManager.address);

//     // Simulate yield
//     await advanceBlock((await timeLatest()).plus(CONVEX_YIELD_PERIOD).toNumber());

//     // process yield, so all yield should be sent to YieldManager
//     await convexDOLA3CRVVault.processYield();

//     const afterBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
//     const afterBalanceOfCVX = await CRV.balanceOf(yieldManager.address);
//     expect(afterBalanceOfCRV).to.be.gt(beforeBalanceOfCRV);
//     expect(afterBalanceOfCVX).to.be.gt(beforeBalanceOfCVX);
//   });
// });
