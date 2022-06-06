/**
 * @dev test for ConvexFRAX3CRVVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv, SignerWithAddress } from './helpers/make-suite';
import { BigNumberish } from 'ethers';
import {
  DRE,
  impersonateAccountsHardhat,
  advanceBlock,
  timeLatest,
} from '../../helpers/misc-utils';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { APPROVAL_AMOUNT_LENDING_POOL, ZERO_ADDRESS } from '../../helpers/constants';

// Constant to simulate convex yield, it indicates that time period.
const CONVEX_YIELD_PERIOD = 100000;

// Constants related to asset amount during test
const DEPOSIT_AMOUNT = '3000';
const TRANSFER_ATOKEN_AMOUNT = '1000';
const WITHDRAW_AMOUNT = '2000'; // = deposit - transfer

const prepareCollateralForUser = async (
  testEnv: TestEnv,
  user: SignerWithAddress,
  amount: BigNumberish
) => {
  const { FRAX_3CRV_LP } = testEnv;
  const ethers = (DRE as any).ethers;

  const LPOwnerAddress = '0xccf6c29d87eb2c0bafede74f5df35f84541f4549';
  await impersonateAccountsHardhat([LPOwnerAddress]);
  const signer = await ethers.provider.getSigner(LPOwnerAddress);

  //transfer to borrower
  await FRAX_3CRV_LP.connect(signer).transfer(user.address, amount);
};

makeSuite('ConvexFRAX3CRVVault - Deposit & Withdraw', (testEnv: TestEnv) => {
  it('should be reverted if try to use an invalid token as collateral', async () => {
    const { convexFRAX3CRVVault } = testEnv;
    await expect(convexFRAX3CRVVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.revertedWith('82');
  });
  it('should be reverted if try to use any of coin other than FRAX3CRV-f as collateral', async () => {
    const { usdc, convexFRAX3CRVVault } = testEnv;
    // TODO @bshevchenko: use Error const instead of 82
    await expect(convexFRAX3CRVVault.depositCollateral(usdc.address, 1000)).to.be.revertedWith(
      '82'
    );
  });
  it('deposit FRAX-3CRV for collateral', async () => {
    const { convexFRAX3CRVVault, deployer, cvxfrax_3crv, aCVXFRAX_3CRV, FRAX_3CRV_LP } = testEnv;

    // Prepare some FRAX_3CRV_LP for depositor
    const assetAmountToDeposit = await convertToCurrencyDecimals(
      FRAX_3CRV_LP.address,
      DEPOSIT_AMOUNT
    );
    await prepareCollateralForUser(testEnv, deployer, assetAmountToDeposit);

    // allow token transfer to this vault
    await FRAX_3CRV_LP.connect(deployer.signer).approve(
      convexFRAX3CRVVault.address,
      assetAmountToDeposit
    );

    // deposit collateral
    await convexFRAX3CRVVault
      .connect(deployer.signer)
      .depositCollateral(FRAX_3CRV_LP.address, assetAmountToDeposit);

    expect(await FRAX_3CRV_LP.balanceOf(deployer.address)).to.be.equal(0);
    expect(await cvxfrax_3crv.balanceOf(convexFRAX3CRVVault.address)).to.be.equal(0);
    expect(await aCVXFRAX_3CRV.balanceOf(convexFRAX3CRVVault.address)).to.be.equal(0);
    expect(await aCVXFRAX_3CRV.balanceOf(deployer.address)).to.be.gte(assetAmountToDeposit);
  });

  it('transferring aCVXFRAX_3CRV should be success after deposit FRAX_3CRV_LP', async () => {
    const { aCVXFRAX_3CRV, users } = testEnv;
    await expect(
      aCVXFRAX_3CRV.transfer(
        users[0].address,
        await convertToCurrencyDecimals(aCVXFRAX_3CRV.address, TRANSFER_ATOKEN_AMOUNT)
      )
    ).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, convexFRAX3CRVVault, FRAX_3CRV_LP } = testEnv;

    const amountAssetToWithdraw = await convertToCurrencyDecimals(
      FRAX_3CRV_LP.address,
      DEPOSIT_AMOUNT
    );
    await expect(
      convexFRAX3CRVVault.withdrawCollateral(
        FRAX_3CRV_LP.address,
        amountAssetToWithdraw,
        9900,
        deployer.address
      )
    ).to.be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, cvxfrax_3crv, convexFRAX3CRVVault, FRAX_3CRV_LP } = testEnv;
    const dola3crvBalanceOfPool = await cvxfrax_3crv.balanceOf(convexFRAX3CRVVault.address);
    const beforeBalanceOfUser = await FRAX_3CRV_LP.balanceOf(deployer.address);
    // withdraw
    const amountAssetToWithdraw = await convertToCurrencyDecimals(
      FRAX_3CRV_LP.address,
      WITHDRAW_AMOUNT
    );
    await convexFRAX3CRVVault
      .connect(deployer.signer)
      .withdrawCollateral(FRAX_3CRV_LP.address, amountAssetToWithdraw, 9900, deployer.address);

    const afterBalanceOfUser = await FRAX_3CRV_LP.balanceOf(deployer.address);

    expect(dola3crvBalanceOfPool).to.be.equal(0);
    expect(afterBalanceOfUser.sub(beforeBalanceOfUser)).to.be.gte(
      await convertToCurrencyDecimals(FRAX_3CRV_LP.address, WITHDRAW_AMOUNT)
    );
    expect(await FRAX_3CRV_LP.balanceOf(convexFRAX3CRVVault.address)).to.be.equal(0);
  });
});

makeSuite('ConvexFRAX3CRVVault - Process Yield', (testEnv: TestEnv) => {
  it('send yield to YieldManager', async () => {
    const { convexFRAX3CRVVault, users, FRAX_3CRV_LP, CRV, CVX, yieldManager } = testEnv;
    const borrower = users[1];

    // borrower provides DOLA3CRV
    const assetAmountToDeposit = await convertToCurrencyDecimals(
      FRAX_3CRV_LP.address,
      DEPOSIT_AMOUNT
    );
    await prepareCollateralForUser(testEnv, borrower, assetAmountToDeposit);
    await FRAX_3CRV_LP.connect(borrower.signer).approve(
      convexFRAX3CRVVault.address,
      APPROVAL_AMOUNT_LENDING_POOL
    );
    await convexFRAX3CRVVault
      .connect(borrower.signer)
      .depositCollateral(FRAX_3CRV_LP.address, assetAmountToDeposit);
    expect(await convexFRAX3CRVVault.getYieldAmount()).to.be.equal(0);
    const beforeBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
    const beforeBalanceOfCVX = await CVX.balanceOf(yieldManager.address);

    // Simulate yield
    await advanceBlock((await timeLatest()).plus(CONVEX_YIELD_PERIOD).toNumber());

    // process yield, so all yield should be sent to YieldManager
    await convexFRAX3CRVVault.processYield();

    const afterBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
    const afterBalanceOfCVX = await CRV.balanceOf(yieldManager.address);
    expect(afterBalanceOfCRV).to.be.gt(beforeBalanceOfCRV);
    expect(afterBalanceOfCVX).to.be.gt(beforeBalanceOfCVX);
  });
});
