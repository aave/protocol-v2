import BigNumber from 'bignumber.js';

import { advanceBlock, DRE, impersonateAccountsHardhat, timeLatest } from '../../helpers/misc-utils';
import { APPROVAL_AMOUNT_LENDING_POOL, oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { makeSuite } from './helpers/make-suite';
import { RateMode } from '../../helpers/types';
import { printUserAccountData, ETHfromWei, printDivider } from './helpers/utils/helpers';
import { getLendingPoolAddressesProvider, getLendingPoolConfiguratorProxy } from '../../helpers/contracts-getters';
import { deployDefaultReserveInterestRateStrategy } from '../../helpers/contracts-deployments';

const chai = require('chai');
const { expect } = chai;

makeSuite('Deposit FTM as collatoral and other as for pool liquidity supplier ', (testEnv) => {
  it('User1 deposits USDC, User deposits FTM as collatoral and borrows USDC', async () => {
    const { usdc, users, pool, yearnVault, oracle } = testEnv;
    const ethers = (DRE as any).ethers;
    const usdcOwnerAddress = '0x93C08a3168fC469F3fC165cd3A471D19a37ca19e';
    const depositor = users[0];
    const borrower = users[1];
    printDivider();
    const depositUSDC = '7000';
    //Make some test USDC for depositor
    await impersonateAccountsHardhat([usdcOwnerAddress]);
    const signer = await ethers.provider.getSigner(usdcOwnerAddress);
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
    await usdc.connect(signer).transfer(depositor.address, amountUSDCtoDeposit);

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
      unit: 'USD',
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

makeSuite('Deposit WFTM as collatoral and other as for pool liquidity supplier ', (testEnv) => {
  it('User1 deposits USDC, User deposits WFTM as collatoral and borrows USDC', async () => {
    const { usdc, users, pool, yearnVault, WFTM, oracle } = testEnv;
    const ethers = (DRE as any).ethers;
    const usdcOwnerAddress = '0x93C08a3168fC469F3fC165cd3A471D19a37ca19e';
    const depositor = users[0];
    const borrower = users[1];
    printDivider();
    const depositUSDC = '7000';
    //Make some test USDC for depositor
    await impersonateAccountsHardhat([usdcOwnerAddress]);
    let signer = await ethers.provider.getSigner(usdcOwnerAddress);
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
    await usdc.connect(signer).transfer(depositor.address, amountUSDCtoDeposit);

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
      unit: 'USD',
      ...supplierGlobalData,
    });

    // user 2 deposits 1000 FTM
    const WFTMOwnerAddress = '0x4901C740607E415685b4d09E4Aa960329cd183Ca';
    const depositWFTM = '1000';
    const depositWFTMAmount = await convertToCurrencyDecimals(WFTM.address, depositWFTM);
    //Make some test WFTM for borrower
    await impersonateAccountsHardhat([WFTMOwnerAddress]);
    signer = await ethers.provider.getSigner(WFTMOwnerAddress);

    //transfer to borrower
    await WFTM.connect(signer).transfer(borrower.address, depositWFTMAmount);

    //approve protocol to access borrower wallet
    await WFTM.connect(borrower.signer).approve(yearnVault.address, APPROVAL_AMOUNT_LENDING_POOL);

    // deposit collateral to borrow
    await yearnVault.connect(borrower.signer).depositCollateral(WFTM.address, depositWFTMAmount);
    {
      const supplierGlobalData = await pool.getUserAccountData(borrower.address);
      printUserAccountData({
        user: `Borrower ${borrower.address}`,
        action: 'deposited',
        amount: ETHfromWei(depositWFTMAmount),
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

// // checked on block number 36543713 with baseVariableBorrowRate
// makeSuite('Deposit FTM as collatoral and other as for pool liquidity supplier ', (testEnv) => {
//   it('User1 deposits USDC, User deposits FTM as collatoral and borrows USDC', async () => {
//     const { usdc, users, pool, yearnVault, oracle } = testEnv;
//     const ethers = (DRE as any).ethers;
//     const usdcOwnerAddress = '0xc5ed2333f8a2c351fca35e5ebadb2a82f5d254c3';
//     const depositor = users[0];
//     const borrower = users[1];
//     printDivider();

  
//     const addressProvider = await getLendingPoolAddressesProvider();
//     const rates = await deployDefaultReserveInterestRateStrategy(
//       [
//         addressProvider.address,
//         new BigNumber(0.9).multipliedBy(oneRay).toFixed(),
//         new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
//         '0',
//         '0',
//         '0',
//         '0',
//       ],
//       false
//     );

//     await impersonateAccountsHardhat(['0x154D73802a6B3324c017481AC818050afE4a0b0A']);
//     let signer = await ethers.provider.getSigner('0x154D73802a6B3324c017481AC818050afE4a0b0A');
//     const configurator = await getLendingPoolConfiguratorProxy();
//     await configurator.connect(signer).setReserveInterestRateStrategyAddress(usdc.address, rates.address);


//     const depositUSDC = '7000';
//     //Make some test USDC for depositor
//     await impersonateAccountsHardhat([usdcOwnerAddress]);
//     signer = await ethers.provider.getSigner(usdcOwnerAddress);
//     const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
//     await usdc.connect(signer).transfer(depositor.address, amountUSDCtoDeposit);

//     //approve protocol to access depositor wallet
//     await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

//     //Supplier  deposits 7000 USDC
//     await pool
//       .connect(depositor.signer)
//       .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

//     const supplierGlobalData = await pool.getUserAccountData(depositor.address);
//     printUserAccountData({
//       user: `Supplier ${depositor.address}`,
//       action: 'deposited',
//       amount: depositUSDC,
//       coin: 'USDC',
//       unit: 'USD',
//       ...supplierGlobalData,
//     });

//     //user 2 deposits 1000 FTM
//     const amountFTMtoDeposit = ethers.utils.parseEther('1000');
//     await yearnVault
//       .connect(borrower.signer)
//       .depositCollateral(ZERO_ADDRESS, amountFTMtoDeposit, { value: amountFTMtoDeposit });
//     {
//       const supplierGlobalData = await pool.getUserAccountData(borrower.address);
//       printUserAccountData({
//         user: `Borrower ${borrower.address}`,
//         action: 'deposited',
//         amount: ETHfromWei(amountFTMtoDeposit),
//         coin: 'FTM',
//         unit: 'USD',
//         ...supplierGlobalData,
//       });
//     }

//     //user 2 borrows
//     const userGlobalData = await pool.getUserAccountData(borrower.address);
//     const usdcPrice = await oracle.getAssetPrice(usdc.address);

//     const amountUSDCToBorrow = await convertToCurrencyDecimals(
//       usdc.address,
//       new BigNumber(userGlobalData.availableBorrowsETH.toString())
//         .div(usdcPrice.toString())
//         .multipliedBy(0.95)
//         .toFixed(0)
//     );

//     await pool
//       .connect(borrower.signer)
//       .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

//     const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);
//     printUserAccountData({
//       user: `Borrower ${borrower.address}`,
//       action: 'borrowed',
//       amount: amountUSDCToBorrow,
//       coin: 'USDC',
//       unit: 'USD',
//       ...userGlobalDataAfter,
//     });

//     expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
//       '7500',
//       'Invalid liquidation threshold'
//     );

//     await advanceBlock((await timeLatest()).plus(3600 * 120).toNumber());

//     //approve protocol to access borrower wallet
//     await usdc.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

//     await expect(
//       pool
//         .connect(borrower.signer)
//         .repay(usdc.address, amountUSDCToBorrow, RateMode.Variable, borrower.address)
//     ).to.not.be.reverted;

//     printUserAccountData({
//       user: `Borrower ${borrower.address}`,
//       action: 'borrowed',
//       amount: amountUSDCToBorrow,
//       coin: 'USDC',
//       unit: 'USD',
//       ...(await pool.getUserAccountData(borrower.address)),
//     });
//   });
// });

// // checked on block number 36543713 with variableRateSlope2
// makeSuite('Deposit FTM as collatoral and other as for pool liquidity supplier ', (testEnv) => {
//   it('User1 deposits USDC, User deposits FTM as collatoral and borrows USDC', async () => {
//     const { usdc, users, pool, yearnVault, oracle } = testEnv;
//     const ethers = (DRE as any).ethers;
//     const usdcOwnerAddress = '0xc5ed2333f8a2c351fca35e5ebadb2a82f5d254c3';
//     const depositor = users[0];
//     const borrower = users[1];
//     printDivider();

  
//     const addressProvider = await getLendingPoolAddressesProvider();
//     const rates = await deployDefaultReserveInterestRateStrategy(
//       [
//         addressProvider.address,
//         new BigNumber(0.9).multipliedBy(oneRay).toFixed(),
//         '0',
//         '0',
//         new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
//         '0',
//         '0',
//       ],
//       false
//     );

//     await impersonateAccountsHardhat(['0x154D73802a6B3324c017481AC818050afE4a0b0A']);
//     let signer = await ethers.provider.getSigner('0x154D73802a6B3324c017481AC818050afE4a0b0A');
//     const configurator = await getLendingPoolConfiguratorProxy();
//     await configurator.connect(signer).setReserveInterestRateStrategyAddress(usdc.address, rates.address);


//     const depositUSDC = '7000';
//     //Make some test USDC for depositor
//     await impersonateAccountsHardhat([usdcOwnerAddress]);
//     signer = await ethers.provider.getSigner(usdcOwnerAddress);
//     const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
//     await usdc.connect(signer).transfer(depositor.address, amountUSDCtoDeposit);

//     //approve protocol to access depositor wallet
//     await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

//     //Supplier  deposits 7000 USDC
//     await pool
//       .connect(depositor.signer)
//       .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

//     const supplierGlobalData = await pool.getUserAccountData(depositor.address);
//     printUserAccountData({
//       user: `Supplier ${depositor.address}`,
//       action: 'deposited',
//       amount: depositUSDC,
//       coin: 'USDC',
//       unit: 'USD',
//       ...supplierGlobalData,
//     });

//     //user 2 deposits 1000 FTM
//     const amountFTMtoDeposit = ethers.utils.parseEther('1000');
//     await yearnVault
//       .connect(borrower.signer)
//       .depositCollateral(ZERO_ADDRESS, amountFTMtoDeposit, { value: amountFTMtoDeposit });
//     {
//       const supplierGlobalData = await pool.getUserAccountData(borrower.address);
//       printUserAccountData({
//         user: `Borrower ${borrower.address}`,
//         action: 'deposited',
//         amount: ETHfromWei(amountFTMtoDeposit),
//         coin: 'FTM',
//         unit: 'USD',
//         ...supplierGlobalData,
//       });
//     }

//     //user 2 borrows
//     const userGlobalData = await pool.getUserAccountData(borrower.address);
//     const usdcPrice = await oracle.getAssetPrice(usdc.address);

//     const amountUSDCToBorrow = await convertToCurrencyDecimals(
//       usdc.address,
//       new BigNumber(userGlobalData.availableBorrowsETH.toString())
//         .div(usdcPrice.toString())
//         .multipliedBy(0.95)
//         .toFixed(0)
//     );

//     await pool
//       .connect(borrower.signer)
//       .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

//     const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);
//     printUserAccountData({
//       user: `Borrower ${borrower.address}`,
//       action: 'borrowed',
//       amount: amountUSDCToBorrow,
//       coin: 'USDC',
//       unit: 'USD',
//       ...userGlobalDataAfter,
//     });

//     expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
//       '7500',
//       'Invalid liquidation threshold'
//     );

//     await advanceBlock((await timeLatest()).plus(3600 * 120).toNumber());

//     //approve protocol to access borrower wallet
//     await usdc.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

//     await expect(
//       pool
//         .connect(borrower.signer)
//         .repay(usdc.address, amountUSDCToBorrow, RateMode.Variable, borrower.address)
//     ).to.not.be.reverted;

//     printUserAccountData({
//       user: `Borrower ${borrower.address}`,
//       action: 'borrowed',
//       amount: amountUSDCToBorrow,
//       coin: 'USDC',
//       unit: 'USD',
//       ...(await pool.getUserAccountData(borrower.address)),
//     });
//   });
// });