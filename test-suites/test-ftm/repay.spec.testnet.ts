import BigNumber from 'bignumber.js';

import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { APPROVAL_AMOUNT_LENDING_POOL, ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { makeSuite } from './helpers/make-suite';
import { RateMode } from '../../helpers/types';
import { printUserAccountData, ETHfromWei, printDivider } from './helpers/utils/helpers';

const chai = require('chai');
const { expect } = chai;

makeSuite('Deposit FTM as collateral and other as for pool liquidity supplier ', (testEnv) => {
  it('User1 deposits USDC, User2 deposits FTM as collateral and borrows USDC', async () => {
    const { usdc, users, pool, yearnVault, oracle, deployer } = testEnv;
    const ethers = (DRE as any).ethers;
    const depositor = users[0];
    const borrower = users[1];
    printDivider();
    const depositUSDC = '7000';
    //Make some test USDC for depositor
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
    await usdc.connect(deployer.signer).transfer(depositor.address, amountUSDCtoDeposit);

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //Supplier  deposits 7000 USDC
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    const supplierGlobalData = await pool.getUserAccountData(depositor.address);
    printUserAccountData({
      user: `Supplier ${depositor.address}`,
      action: 'deposited',
      amount: depositUSDC,
      coin: 'USDC',
      ...supplierGlobalData,
    });

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
        .toFixed(3)
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
      ...userGlobalDataAfter,
    });

    expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
      '7500',
      'Invalid liquidation threshold'
    );

    //approve protocol to access borrower wallet
    await usdc.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await expect(
      pool
        .connect(borrower.signer)
        .repay(usdc.address, amountUSDCToBorrow, RateMode.Variable, borrower.address)
    ).to.not.be.reverted;
  });
});

makeSuite('Deposit WFTM as collateral and other as for pool liquidity supplier ', (testEnv) => {
  it('User1 deposits USDC, User2 deposits WFTM as collateral and borrows USDC', async () => {
    const { usdc, users, pool, yearnVault, WFTM, oracle, deployer } = testEnv;
    const ethers = (DRE as any).ethers;
    const depositor = users[0];
    const borrower = users[1];
    printDivider();
    const depositUSDC = '7000';
    //Make some test USDC for depositor
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
    await usdc.connect(deployer.signer).transfer(depositor.address, amountUSDCtoDeposit);

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //Supplier  deposits 7000 USDC
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    const supplierGlobalData = await pool.getUserAccountData(depositor.address);
    printUserAccountData({
      user: `Supplier ${depositor.address}`,
      action: 'deposited',
      amount: depositUSDC,
      coin: 'USDC',
      ...supplierGlobalData,
    });

    //user 2 deposits 1000 WFTM
    const WFTMOwnerAddress = '0xde080FdB13F273dbE1183deB59025B2BC4250a23';
    const depositWFTM = '1000';
    const amountWFTMtoDeposit = await convertToCurrencyDecimals(WFTM.address, depositWFTM);
    //Make some test stETH for borrower
    await impersonateAccountsHardhat([WFTMOwnerAddress]);
    const signer = await ethers.provider.getSigner(WFTMOwnerAddress);
    await WFTM.connect(signer).transfer(borrower.address, amountWFTMtoDeposit);
    //approve protocol to access depositor wallet
    await WFTM.connect(borrower.signer).approve(yearnVault.address, APPROVAL_AMOUNT_LENDING_POOL);

    await yearnVault.connect(borrower.signer).depositCollateral(WFTM.address, amountWFTMtoDeposit);
    {
      const supplierGlobalData = await pool.getUserAccountData(borrower.address);
      printUserAccountData({
        user: `Borrower ${borrower.address}`,
        action: 'deposited',
        amount: amountWFTMtoDeposit,
        coin: 'WFTM',
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
        .toFixed(3)
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
      ...userGlobalDataAfter,
    });

    expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
      '7500',
      'Invalid liquidation threshold'
    );

    //approve protocol to access borrower wallet
    await usdc.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await expect(
      pool
        .connect(borrower.signer)
        .repay(usdc.address, amountUSDCToBorrow, RateMode.Variable, borrower.address)
    ).to.not.be.reverted;
  });
});
