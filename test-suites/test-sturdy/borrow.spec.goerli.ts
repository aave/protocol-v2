import BigNumber from 'bignumber.js';
import { APPROVAL_AMOUNT_LENDING_POOL, ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { makeSuite } from './helpers/make-suite';
import { RateMode } from '../../helpers/types';
import { printUserAccountData, ETHfromWei, printDivider } from './helpers/utils/helpers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';

const chai = require('chai');
const { expect } = chai;

makeSuite('Deposit ETH as collateral and other as for pool liquidity supplier ', (testEnv) => {
  it('User1 deposits USDC, User deposits ETH as collateral and borrows USDC', async () => {
    const { usdc, users, pool, lidoVault, oracle, addressesProvider } = testEnv;
    const ethers = (DRE as any).ethers;
    const usdcOwnerAddress = '0x6dBe810e3314546009bD6e1B29f9031211CdA5d2';
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
      ...supplierGlobalData,
    });

    //user 2 deposits 1 ETH
    const amountETHtoDeposit = ethers.utils.parseEther('1');
    await lidoVault
      .connect(borrower.signer)
      .depositCollateral(ZERO_ADDRESS, amountETHtoDeposit, { value: amountETHtoDeposit });
    {
      const supplierGlobalData = await pool.getUserAccountData(borrower.address);
      printUserAccountData({
        user: `Borrower ${borrower.address}`,
        action: 'deposited',
        amount: ETHfromWei(amountETHtoDeposit),
        coin: 'stETH',
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
      ...userGlobalDataAfter,
    });

    expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
      '7500',
      'Invalid liquidation threshold'
    );
  });
});

makeSuite('Deposit stETH as collateral and other as for pool liquidity supplier ', (testEnv) => {
  it('User1 deposits USDC, User deposits stETH as collateral and borrows USDC', async () => {
    const { usdc, users, pool, lidoVault, lido, oracle } = testEnv;
    const ethers = (DRE as any).ethers;
    const usdcOwnerAddress = '0x6dBe810e3314546009bD6e1B29f9031211CdA5d2';
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
      ...supplierGlobalData,
    });

    //user 2 deposits 1 stETH
    const stETHOwnerAddress = '0x06F405e5a760b8cDE3a48F96105659CEDf62dA63';
    const depositStETH = '1';
    const amountStETHtoDeposit = await convertToCurrencyDecimals(lido.address, depositStETH);
    //Make some test stETH for borrower
    await impersonateAccountsHardhat([stETHOwnerAddress]);
    signer = await ethers.provider.getSigner(stETHOwnerAddress);
    await lido.connect(signer).transfer(borrower.address, amountStETHtoDeposit);
    //approve protocol to access depositor wallet
    await lido.connect(borrower.signer).approve(lidoVault.address, APPROVAL_AMOUNT_LENDING_POOL);

    await lidoVault.connect(borrower.signer).depositCollateral(lido.address, amountStETHtoDeposit);
    {
      const supplierGlobalData = await pool.getUserAccountData(borrower.address);
      printUserAccountData({
        user: `Borrower ${borrower.address}`,
        action: 'deposited',
        amount: ETHfromWei(amountStETHtoDeposit),
        coin: 'stETH',
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
      ...userGlobalDataAfter,
    });

    expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
      '7500',
      'Invalid liquidation threshold'
    );
  });
});

makeSuite('borrow stETH', (testEnv) => {
  it('Should revert if borrow stETH. User1 deposits stETH, User2 deposits ETH as collateral and borrows stETH', async () => {
    const { lido, users, pool, lidoVault, oracle } = testEnv;
    const ethers = (DRE as any).ethers;
    const depositor = users[0];
    const borrower = users[1];
    printDivider();
    const stETHOwnerAddress = '0x06F405e5a760b8cDE3a48F96105659CEDf62dA63';
    const depositStETH = '10';
    //Make some test stETH for depositor
    await impersonateAccountsHardhat([stETHOwnerAddress]);
    const signer = await ethers.provider.getSigner(stETHOwnerAddress);
    await lido.connect(signer).transfer(depositor.address, ethers.utils.parseEther(depositStETH));

    //approve protocol to access depositor wallet
    await lido.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 5 stETH
    const amountStETHtoDeposit = await convertToCurrencyDecimals(lido.address, '5');

    await expect(
      pool
        .connect(depositor.signer)
        .deposit(lido.address, amountStETHtoDeposit, depositor.address, '0')
    ).to.be.reverted;

    //Make 5ETH deposit for collateral
    await lidoVault
      .connect(borrower.signer)
      .depositCollateral(ZERO_ADDRESS, ethers.utils.parseEther('5'), {
        value: ethers.utils.parseEther('5'),
      });

    const borrowerGlobalData = await pool.getUserAccountData(borrower.address);
    printUserAccountData({
      user: `Borrower ${borrower.address}`,
      action: 'deposits',
      amount: 5,
      coin: 'stETH',
      ...borrowerGlobalData,
    });
    //user 2 borrows

    const userGlobalData = await pool.getUserAccountData(borrower.address);
    const stETHPrice = await oracle.getAssetPrice(lido.address);

    const amountStETHToBorrow = await convertToCurrencyDecimals(
      lido.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(stETHPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );
    await expect(
      pool
        .connect(borrower.signer)
        .borrow(lido.address, amountStETHToBorrow, RateMode.Stable, '0', borrower.address)
    ).to.be.reverted;
  });
});
