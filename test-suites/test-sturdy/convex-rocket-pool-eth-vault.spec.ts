// /**
//  * @dev test for ConvexRocketPoolETHVault functions
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
// const DEPOSIT_AMOUNT = '50';
// const TRANSFER_ATOKEN_AMOUNT = '10';
// const WITHDRAW_AMOUNT = '40'; // = deposit - transfer

// const prepareCollateralForUser = async (
//   testEnv: TestEnv,
//   user: SignerWithAddress,
//   amount: BigNumberish
// ) => {
//   const { RETH_WSTETH_LP } = testEnv;
//   const ethers = (DRE as any).ethers;

//   const LPOwnerAddress = '0x28ac885d3d8b30bd5733151c732c5f01e18847aa';
//   await impersonateAccountsHardhat([LPOwnerAddress]);
//   const signer = await ethers.provider.getSigner(LPOwnerAddress);

//   //transfer to borrower
//   await RETH_WSTETH_LP.connect(signer).transfer(user.address, amount);
// };

// makeSuite('ConvexRocketPoolETHVault - Deposit & Withdraw', (testEnv: TestEnv) => {
//   it('should be reverted if try to use an invalid token as collateral', async () => {
//     const { convexRocketPoolETHVault } = testEnv;
//     await expect(convexRocketPoolETHVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.revertedWith(
//       '82'
//     );
//   });
//   it('should be reverted if try to use any of coin other than rETHwstETH-f as collateral', async () => {
//     const { usdc, convexRocketPoolETHVault } = testEnv;
//     // TODO @bshevchenko: use Error const instead of 82
//     await expect(convexRocketPoolETHVault.depositCollateral(usdc.address, 1000)).to.be.revertedWith(
//       '82'
//     );
//   });
//   it('deposit rETH-WstETH for collateral', async () => {
//     const { convexRocketPoolETHVault, deployer, cvxreth_wsteth, aCVXRETH_WSTETH, RETH_WSTETH_LP } =
//       testEnv;

//     // Prepare some RETH_WSTETH_LP for depositor
//     const assetAmountToDeposit = await convertToCurrencyDecimals(
//       RETH_WSTETH_LP.address,
//       DEPOSIT_AMOUNT
//     );
//     await prepareCollateralForUser(testEnv, deployer, assetAmountToDeposit);

//     // allow token transfer to this vault
//     await RETH_WSTETH_LP.connect(deployer.signer).approve(
//       convexRocketPoolETHVault.address,
//       assetAmountToDeposit
//     );

//     // deposit collateral
//     await convexRocketPoolETHVault
//       .connect(deployer.signer)
//       .depositCollateral(RETH_WSTETH_LP.address, assetAmountToDeposit);

//     expect(await RETH_WSTETH_LP.balanceOf(deployer.address)).to.be.equal(0);
//     expect(await cvxreth_wsteth.balanceOf(convexRocketPoolETHVault.address)).to.be.equal(0);
//     expect(await aCVXRETH_WSTETH.balanceOf(convexRocketPoolETHVault.address)).to.be.equal(0);
//     expect(await aCVXRETH_WSTETH.balanceOf(deployer.address)).to.be.gte(assetAmountToDeposit);
//   });

//   it('transferring aCVXRETH_WSTETH should be success after deposit RETH_WSTETH_LP', async () => {
//     const { aCVXRETH_WSTETH, users } = testEnv;
//     await expect(
//       aCVXRETH_WSTETH.transfer(
//         users[0].address,
//         await convertToCurrencyDecimals(aCVXRETH_WSTETH.address, TRANSFER_ATOKEN_AMOUNT)
//       )
//     ).to.not.be.reverted;
//   });

//   it('withdraw from collateral should be failed if user has not enough balance', async () => {
//     const { deployer, convexRocketPoolETHVault, RETH_WSTETH_LP } = testEnv;

//     const amountAssetToWithdraw = await convertToCurrencyDecimals(
//       RETH_WSTETH_LP.address,
//       DEPOSIT_AMOUNT
//     );
//     await expect(
//       convexRocketPoolETHVault.withdrawCollateral(
//         RETH_WSTETH_LP.address,
//         amountAssetToWithdraw,
//         9900,
//         deployer.address
//       )
//     ).to.be.reverted;
//   });

//   it('withdraw from collateral', async () => {
//     const { deployer, cvxreth_wsteth, convexRocketPoolETHVault, RETH_WSTETH_LP } = testEnv;
//     const dola3crvBalanceOfPool = await cvxreth_wsteth.balanceOf(convexRocketPoolETHVault.address);
//     const beforeBalanceOfUser = await RETH_WSTETH_LP.balanceOf(deployer.address);
//     // withdraw
//     const amountAssetToWithdraw = await convertToCurrencyDecimals(
//       RETH_WSTETH_LP.address,
//       WITHDRAW_AMOUNT
//     );
//     await convexRocketPoolETHVault
//       .connect(deployer.signer)
//       .withdrawCollateral(RETH_WSTETH_LP.address, amountAssetToWithdraw, 9900, deployer.address);

//     const afterBalanceOfUser = await RETH_WSTETH_LP.balanceOf(deployer.address);

//     expect(dola3crvBalanceOfPool).to.be.equal(0);
//     expect(afterBalanceOfUser.sub(beforeBalanceOfUser)).to.be.gte(
//       await convertToCurrencyDecimals(RETH_WSTETH_LP.address, WITHDRAW_AMOUNT)
//     );
//     expect(await RETH_WSTETH_LP.balanceOf(convexRocketPoolETHVault.address)).to.be.equal(0);
//   });
// });

// makeSuite('ConvexRocketPoolETHVault - Process Yield', (testEnv: TestEnv) => {
//   it('send yield to YieldManager', async () => {
//     const { convexRocketPoolETHVault, users, RETH_WSTETH_LP, CRV, CVX, yieldManager } = testEnv;
//     const borrower = users[1];

//     // borrower provides DOLA3CRV
//     const assetAmountToDeposit = await convertToCurrencyDecimals(
//       RETH_WSTETH_LP.address,
//       DEPOSIT_AMOUNT
//     );
//     await prepareCollateralForUser(testEnv, borrower, assetAmountToDeposit);
//     await RETH_WSTETH_LP.connect(borrower.signer).approve(
//       convexRocketPoolETHVault.address,
//       APPROVAL_AMOUNT_LENDING_POOL
//     );
//     await convexRocketPoolETHVault
//       .connect(borrower.signer)
//       .depositCollateral(RETH_WSTETH_LP.address, assetAmountToDeposit);
//     expect(await convexRocketPoolETHVault.getYieldAmount()).to.be.equal(0);
//     const beforeBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
//     const beforeBalanceOfCVX = await CVX.balanceOf(yieldManager.address);

//     // Simulate yield
//     await advanceBlock((await timeLatest()).plus(CONVEX_YIELD_PERIOD).toNumber());

//     // process yield, so all yield should be sent to YieldManager
//     await convexRocketPoolETHVault.processYield();

//     const afterBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
//     const afterBalanceOfCVX = await CRV.balanceOf(yieldManager.address);
//     expect(afterBalanceOfCRV).to.be.gt(beforeBalanceOfCRV);
//     expect(afterBalanceOfCVX).to.be.gt(beforeBalanceOfCVX);
//   });
// });
