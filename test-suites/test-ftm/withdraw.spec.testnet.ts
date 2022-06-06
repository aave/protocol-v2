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
    const { usdc, users, pool, yearnVault, oracle, deployer } = testEnv;
    const ethers = (DRE as any).ethers;
    const depositor = users[0];
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

    await pool
      .connect(depositor.signer)
      .withdraw(usdc.address, amountUSDCtoDeposit, depositor.address);

    const userGlobalDataAfter = await pool.getUserAccountData(depositor.address);
    printUserAccountData({
      user: `Supplier ${depositor.address}`,
      action: 'withdraw',
      amount: amountUSDCtoDeposit,
      coin: 'USDC',
      ...userGlobalDataAfter,
    });
  });
});
