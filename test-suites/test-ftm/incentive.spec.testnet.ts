import BigNumber from 'bignumber.js';
import { APPROVAL_AMOUNT_LENDING_POOL, ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { makeSuite } from './helpers/make-suite';
import { RateMode } from '../../helpers/types';
import { printUserAccountData, ETHfromWei, printDivider } from './helpers/utils/helpers';
import {
  advanceBlock,
  DRE,
  impersonateAccountsHardhat,
  timeLatest,
  waitForTx,
} from '../../helpers/misc-utils';

const chai = require('chai');
const { expect } = chai;
const DISTRIBUTION_DURATION = 86400; //1day

makeSuite('Check incentive token growing ', (testEnv) => {
  it('User1 deposits USDC, User deposits FTM as collatoral and borrows USDC', async () => {
    const {
      usdc,
      aUsdc,
      users,
      pool,
      incentiveController,
      brick,
      yearnVault,
      oracle,
      deployer,
      helpersContract,
    } = testEnv;
    const ethers = (DRE as any).ethers;
    const depositor = users[0];
    const borrower = users[1];
    printDivider();

    const usdcDebtTokenAddress = (await helpersContract.getReserveTokensAddresses(usdc.address))
      .variableDebtTokenAddress;
    await incentiveController.connect(deployer.signer).setDistributionEnd(
      (await timeLatest()).plus(DISTRIBUTION_DURATION).toString()
    );
    await advanceBlock((await timeLatest()).plus(100).toNumber());

    let unclaimedDepositorRewardsBefore = await incentiveController.getRewardsBalance(
      [aUsdc.address],
      depositor.address
    );
    let depositorBrickBefore = await brick.balanceOf(depositor.address);
    let unclaimedBorrowerRewardsBefore = await incentiveController.getRewardsBalance(
      [usdcDebtTokenAddress],
      borrower.address
    );
    let borrowerBrickBefore = await brick.balanceOf(borrower.address);
    expect(unclaimedDepositorRewardsBefore.toString()).to.be.bignumber.equal('0');
    expect(depositorBrickBefore.toString()).to.be.bignumber.equal('0');
    expect(unclaimedBorrowerRewardsBefore.toString()).to.be.bignumber.equal('0');
    expect(borrowerBrickBefore.toString()).to.be.bignumber.equal('0');

    const depositUSDC = '500000';
    //Make some test USDC for depositor
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
    await usdc.connect(deployer.signer).transfer(depositor.address, amountUSDCtoDeposit);

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //Supplier  deposits 500,000 USDC
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    const supplierGlobalData = await pool.getUserAccountData(depositor.address);
    printUserAccountData({
      user: `Supplier ${depositor.address}`,
      action: 'deposited',
      amount: depositUSDC,
      coin: 'USDC',
      unit: 'USD',
      ...supplierGlobalData,
    });

    await advanceBlock((await timeLatest()).plus(100).toNumber());
    unclaimedDepositorRewardsBefore = await incentiveController.getRewardsBalance(
      [aUsdc.address],
      depositor.address
    );
    depositorBrickBefore = await brick.balanceOf(depositor.address);
    unclaimedBorrowerRewardsBefore = await incentiveController.getRewardsBalance(
      [usdcDebtTokenAddress],
      borrower.address
    );
    borrowerBrickBefore = await brick.balanceOf(borrower.address);
    // Testing is on Forked Network, so aUsdc's total_supply is different from 7000
    // expect(unclaimedDepositorRewardsBefore.toString()).to.be.bignumber.equal('999');
    expect(unclaimedDepositorRewardsBefore.toString()).to.be.bignumber.equal('235');
    expect(depositorBrickBefore.toString()).to.be.bignumber.equal('0');
    expect(unclaimedBorrowerRewardsBefore.toString()).to.be.bignumber.equal('0');
    expect(borrowerBrickBefore.toString()).to.be.bignumber.equal('0');

    //claim rewards of depositor
    await incentiveController
      .connect(depositor.signer)
      .claimRewards([aUsdc.address], 100, depositor.address);

    let unclaimedDepositorRewardsAfter = await incentiveController.getRewardsBalance(
      [aUsdc.address],
      depositor.address
    );
    let depositorBrickAfter = await brick.balanceOf(depositor.address);
    // expect(unclaimedDepositorRewardsAfter.toString()).to.be.bignumber.equal('909');
    expect(unclaimedDepositorRewardsAfter.toString()).to.be.bignumber.equal('137');
    expect(depositorBrickAfter.toString()).to.be.bignumber.equal('100');

    //user 2 deposits 1000 FTM
    const amountFTMtoDeposit = ethers.utils.parseEther('1000');
    await yearnVault
      .connect(borrower.signer)
      .depositCollateral(ZERO_ADDRESS, amountFTMtoDeposit, { value: amountFTMtoDeposit });
    {
      const supplierGlobalData = await pool.getUserAccountData(borrower.address);
      printUserAccountData({
        user: `Borrower ${borrower.address}`,
        action: 'deposited',
        amount: ETHfromWei(amountFTMtoDeposit),
        coin: 'FTM',
        unit: 'USD',
        ...supplierGlobalData,
      });
    }

    //user 2 borrows
    const userGlobalData = await pool.getUserAccountData(borrower.address);
    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);
    printUserAccountData({
      user: `Borrower ${borrower.address}`,
      action: 'borrowed',
      amount: amountUSDCToBorrow,
      coin: 'USDC',
      unit: 'USD',
      ...userGlobalDataAfter,
    });

    await advanceBlock((await timeLatest()).plus(100).toNumber());
    unclaimedDepositorRewardsBefore = await incentiveController.getRewardsBalance(
      [aUsdc.address],
      depositor.address
    );
    depositorBrickBefore = await brick.balanceOf(depositor.address);
    unclaimedBorrowerRewardsBefore = await incentiveController.getRewardsBalance(
      [usdcDebtTokenAddress],
      borrower.address
    );
    borrowerBrickBefore = await brick.balanceOf(borrower.address);
    expect(unclaimedDepositorRewardsBefore.gte('377')).to.be.equal(true);
    expect(depositorBrickBefore.toString()).to.be.bignumber.equal('100');
    expect(unclaimedBorrowerRewardsBefore.toString()).to.be.bignumber.equal('398');
    expect(borrowerBrickBefore.toString()).to.be.bignumber.equal('0');

    //claim rewards of borrower
    await incentiveController
      .connect(borrower.signer)
      .claimRewards([usdcDebtTokenAddress], 100, borrower.address);

    let unclaimedBorrowerRewardsAfter = await incentiveController.getRewardsBalance(
      [usdcDebtTokenAddress],
      borrower.address
    );
    let borrowerBrickAfter = await brick.balanceOf(borrower.address);
    expect(unclaimedBorrowerRewardsAfter.gte('302')).to.be.equal(true);
    expect(borrowerBrickAfter.toString()).to.be.bignumber.equal('100');

    expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
      '7500',
      'Invalid liquidation threshold'
    );
  });
});
