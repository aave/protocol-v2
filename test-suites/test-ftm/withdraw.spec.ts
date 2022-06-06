import BigNumber from 'bignumber.js';

import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { APPROVAL_AMOUNT_LENDING_POOL } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { makeSuite } from './helpers/make-suite';
import { printUserAccountData, printDivider } from './helpers/utils/helpers';

const chai = require('chai');
const { expect } = chai;

makeSuite('Withdraw USDC ', (testEnv) => {
  it('User1 deposits USDC and then withdraw USDC', async () => {
    const { usdc, users, pool, yearnVault, oracle } = testEnv;
    const ethers = (DRE as any).ethers;
    const usdcOwnerAddress = '0x93C08a3168fC469F3fC165cd3A471D19a37ca19e';
    const depositor = users[0];
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

    await pool
      .connect(depositor.signer)
      .withdraw(usdc.address, amountUSDCtoDeposit, depositor.address);

    const userGlobalDataAfter = await pool.getUserAccountData(depositor.address);
    printUserAccountData({
      user: `Supplier ${depositor.address}`,
      action: 'withdraw',
      amount: amountUSDCtoDeposit,
      coin: 'USDC',
      unit: 'USD',
      ...userGlobalDataAfter,
    });
  });
});

makeSuite('Withdraw USDT ', (testEnv) => {
  it('User1 deposits USDT and then withdraw USDT', async () => {
    const { usdt, users, pool, yearnVault, oracle } = testEnv;
    const ethers = (DRE as any).ethers;
    const usdtOwnerAddress = '0x93C08a3168fC469F3fC165cd3A471D19a37ca19e';
    const depositor = users[0];
    printDivider();
    const depositUSDT = '3500';
    //Make some test USDT for depositor
    await impersonateAccountsHardhat([usdtOwnerAddress]);
    const signer = await ethers.provider.getSigner(usdtOwnerAddress);
    const amountUSDTtoDeposit = await convertToCurrencyDecimals(usdt.address, depositUSDT);
    await usdt.connect(signer).transfer(depositor.address, amountUSDTtoDeposit);

    //approve protocol to access depositor wallet
    await usdt.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //Supplier  deposits 3500 USDT
    await pool
      .connect(depositor.signer)
      .deposit(usdt.address, amountUSDTtoDeposit, depositor.address, '0');

    const supplierGlobalData = await pool.getUserAccountData(depositor.address);
    printUserAccountData({
      user: `Supplier ${depositor.address}`,
      action: 'deposited',
      amount: depositUSDT,
      coin: 'USDT',
      unit: 'USD',
      ...supplierGlobalData,
    });

    await pool
      .connect(depositor.signer)
      .withdraw(usdt.address, amountUSDTtoDeposit, depositor.address);

    const userGlobalDataAfter = await pool.getUserAccountData(depositor.address);
    printUserAccountData({
      user: `Supplier ${depositor.address}`,
      action: 'withdraw',
      amount: amountUSDTtoDeposit,
      coin: 'USDT',
      unit: 'USD',
      ...userGlobalDataAfter,
    });
  });
});
