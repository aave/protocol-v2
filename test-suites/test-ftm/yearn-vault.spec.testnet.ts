/**
 * @dev test for yearnVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { printDivider } from './helpers/utils/helpers';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { APPROVAL_AMOUNT_LENDING_POOL, ZERO_ADDRESS } from '../../helpers/constants';
import { ILidoFactory } from '../../types/ILidoFactory';
import { getMockyvWFTM } from '../../helpers/contracts-getters';

const { parseEther } = ethers.utils;

makeSuite('yearnVault', (testEnv: TestEnv) => {
  it('failed deposit for collateral without ftm', async () => {
    const { yearnVault } = testEnv;

    await expect(yearnVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
  });

  it('deposit FTM for collateral', async () => {
    const { yearnVault, deployer, yvwftm, aYVWFTM } = testEnv;
    await yearnVault
      .connect(deployer.signer)
      .depositCollateral(ZERO_ADDRESS, parseEther('1200'), { value: parseEther('1200') });
    expect(await yvwftm.balanceOf(yearnVault.address)).to.be.equal(0);
    expect(await aYVWFTM.balanceOf(yearnVault.address)).to.be.equal(0);
    expect((await aYVWFTM.balanceOf(deployer.address)).gt(parseEther('1199.99999'))).to.be.equal(true);
    expect(await ethers.getDefaultProvider().getBalance(yearnVault.address)).to.be.equal(0);
  });

  it('yvWFTM & aYVWFTM balance check after deposit for collateral', async () => {
    const { yearnVault, deployer, yvwftm, aYVWFTM } = testEnv;
    const yvWFTMBalanceOfPool = await yvwftm.balanceOf(yearnVault.address);
    const aTokensBalance = await aYVWFTM.balanceOf(deployer.address);
    expect(yvWFTMBalanceOfPool).to.be.equal(0);
    expect(aTokensBalance.gt(parseEther('1199.99999'))).to.be.equal(true);
  });

  it('transfering aYVWFTM should be success after deposit FTM', async () => {
    const { aYVWFTM, users, deployer } = testEnv;
    await expect(aYVWFTM.connect(deployer.signer).transfer(users[0].address, parseEther('100'))).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, yearnVault } = testEnv;
    await expect(
      yearnVault
        .connect(deployer.signer)
        .withdrawCollateral(ZERO_ADDRESS, parseEther('1200'), 9900, deployer.address)).to
      .be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, yvwftm, yearnVault } = testEnv;
    const yvWFTMBalanceOfPool = await yvwftm.balanceOf(yearnVault.address);
    const ftmBeforeBalanceOfUser = await deployer.signer.getBalance();

    await yearnVault
      .connect(deployer.signer)
      .withdrawCollateral(ZERO_ADDRESS, parseEther('1099'), 9900, deployer.address);

    const ftmCurrentBalanceOfUser = await deployer.signer.getBalance();
    expect(yvWFTMBalanceOfPool).to.be.equal(0);
    expect(ftmCurrentBalanceOfUser.sub(ftmBeforeBalanceOfUser).gt(parseEther('1090'))).to.be.equal(
      true
    );
    expect(await ethers.getDefaultProvider().getBalance(yearnVault.address)).to.be.equal(0);
  });
});

makeSuite('yearnVault - use other coin as collatoral', (testEnv) => {
  it('Should revert to use any of coin other than FTM, yvWFTM as collatoral. ', async () => {
    const { usdc, users, yearnVault, deployer } = testEnv;
    const ethers = (DRE as any).ethers;
    const depositor = users[0];
    printDivider();

    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');
    await usdc.connect(deployer.signer).transfer(depositor.address, amountUSDCtoDeposit);

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(yearnVault.address, APPROVAL_AMOUNT_LENDING_POOL);

    //depositor deposits 1000 usdc as collateral
    await expect(
      yearnVault.connect(depositor.signer).depositCollateral(usdc.address, amountUSDCtoDeposit)
    ).to.be.reverted;
  });
});

// makeSuite('yearnVault', (testEnv: TestEnv) => {
//   it('distribute yield to supplier for single asset', async () => {
//     const { pool, yearnVault, usdc, users, deployer, yvwftm, WFTM, aUsdc, aYVWFTM } = testEnv;
//     const depositor = users[0];
//     const borrower = users[1];
//     const ethers = (DRE as any).ethers;
//     const depositUSDC = '7000';
//     //Make some test USDC for depositor
//     const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
//     await usdc.connect(deployer.signer).transfer(depositor.address, amountUSDCtoDeposit);

//     //approve protocol to access depositor wallet
//     await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

//     //Supplier  deposits 7000 USDC
//     await pool
//       .connect(depositor.signer)
//       .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

//     const WFTMOwnerAddress = '0xde080FdB13F273dbE1183deB59025B2BC4250a23';
//     const depositWFTM = '1000';
//     const depositWFTMAmount = await convertToCurrencyDecimals(WFTM.address, depositWFTM);
//     //Make some test WFTM for borrower
//     await impersonateAccountsHardhat([WFTMOwnerAddress]);
//     let signer = await ethers.provider.getSigner(WFTMOwnerAddress);

//     //transfer to borrower
//     await WFTM.connect(signer).transfer(borrower.address, depositWFTMAmount);

//     //approve protocol to access borrower wallet
//     await WFTM.connect(borrower.signer).approve(yearnVault.address, APPROVAL_AMOUNT_LENDING_POOL);

//     WFTMOwnerAddress
//     // deposit collateral to borrow
//     await yearnVault.connect(borrower.signer).depositCollateral(WFTM.address, depositWFTMAmount);
//     expect(await yearnVault.getYieldAmount()).to.be.equal(0);

//     //To simulate yield in lendingPool, deposit some yvWFTM to aYVWFTM contract
//     const yieldyvWFTM = '1000';
//     const yieldyvWFTMAmount = await convertToCurrencyDecimals(yvwftm.address, yieldyvWFTM);
//     await WFTM.connect(signer).transfer(deployer.address, yieldyvWFTMAmount);
    
//     const mockyvWFTM = await getMockyvWFTM();
//     await WFTM.connect(deployer.signer).approve(mockyvWFTM.address, APPROVAL_AMOUNT_LENDING_POOL);
//     await mockyvWFTM.connect(deployer.signer).deposit(yieldyvWFTMAmount, deployer.address);

//     //Make some test WFTM for borrower
//     await yvwftm.connect(deployer.signer).transfer(aYVWFTM.address, yieldyvWFTMAmount);

//     expect((await yearnVault.getYieldAmount()).gt(parseEther('999'))).to.be.equal(true);
//     expect(await usdc.balanceOf(yearnVault.address)).to.be.equal(0);
//     expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);

//     // process yield, so all yield should be converted to usdc
//     await yearnVault.connect(deployer.signer).processYield();
//     const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '8000');
//     expect((await aUsdc.balanceOf(depositor.address)).gt(yieldUSDC)).to.be.equal(true);
//   });
// });

// makeSuite('yearnVault', (testEnv: TestEnv) => {
//   it('distribute yield to supplier for multiple asset', async () => {
//     const { pool, yearnVault, usdc, usdt, users, yvwftm, aUsdc, aUsdt, aYVWFTM, WFTM, dai, aDai } = testEnv;
//     const depositor = users[0];
//     const depositor1 = users[1];
//     const depositor2 = users[2];
//     const borrower = users[3];
//     const ethers = (DRE as any).ethers;
//     const usdcOwnerAddress = '0x93C08a3168fC469F3fC165cd3A471D19a37ca19e';
//     const depositUSDC = '7000';
//     //Make some test USDC for depositor
//     await impersonateAccountsHardhat([usdcOwnerAddress]);
//     let signer = await ethers.provider.getSigner(usdcOwnerAddress);
//     const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
//     await usdc.connect(signer).transfer(depositor.address, amountUSDCtoDeposit);

//     //approve protocol to access depositor wallet
//     await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

//     //Supplier  deposits 7000 USDC
//     await pool
//       .connect(depositor.signer)
//       .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

//     const daiOwnerAddress = '0x6Bf97f2534be2242dDb3A29bfb24d498212DcdED';
//     const depositDAI = '7000';
//     //Make some test DAI for depositor
//     await impersonateAccountsHardhat([daiOwnerAddress]);
//     signer = await ethers.provider.getSigner(daiOwnerAddress);
//     const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, depositDAI);
//     await dai.connect(signer).transfer(depositor1.address, amountDAItoDeposit);

//     //approve protocol to access depositor wallet
//     await dai.connect(depositor1.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

//     //Supplier deposits 7000 DAI
//     await pool
//       .connect(depositor1.signer)
//       .deposit(dai.address, amountDAItoDeposit, depositor1.address, '0');
    
//     const usdtOwnerAddress = '0x93C08a3168fC469F3fC165cd3A471D19a37ca19e';
//     const depositUSDT = '3500';
//     //Make some test USDT for depositor
//     await impersonateAccountsHardhat([usdtOwnerAddress]);
//     signer = await ethers.provider.getSigner(usdtOwnerAddress);
//     const amountUSDTtoDeposit = await convertToCurrencyDecimals(usdt.address, depositUSDT);
//     await usdt.connect(signer).transfer(depositor2.address, amountUSDTtoDeposit);

//     //approve protocol to access depositor wallet
//     await usdt.connect(depositor2.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

//     //Supplier  deposits 3500 USDT
//     await pool
//       .connect(depositor2.signer)
//       .deposit(usdt.address, amountUSDTtoDeposit, depositor2.address, '0');

//     const WFTMOwnerAddress = '0x4901C740607E415685b4d09E4Aa960329cd183Ca';
//     const depositWFTM = '1000';
//     const depositWFTMAmount = await convertToCurrencyDecimals(WFTM.address, depositWFTM);
//     //Make some test WFTM for borrower
//     await impersonateAccountsHardhat([WFTMOwnerAddress]);
//     signer = await ethers.provider.getSigner(WFTMOwnerAddress);

//     //transfer to borrower
//     await WFTM.connect(signer).transfer(borrower.address, depositWFTMAmount);

//     //approve protocol to access borrower wallet
//     await WFTM.connect(borrower.signer).approve(yearnVault.address, APPROVAL_AMOUNT_LENDING_POOL);

//     // deposit collateral to borrow
//     await yearnVault.connect(borrower.signer).depositCollateral(WFTM.address, depositWFTMAmount);
//     expect(await yearnVault.getYieldAmount()).to.be.equal(0);

//     //To simulate yield in lendingPool, deposit some yvWFTM to aYVWFTM contract
//     const yvWFTMOwnerAddress = '0x41fB1251bd68796Ff7fdF51Fb312529F81817913';
//     const yieldyvWFTM = '1000';
//     const yieldyvWFTMAmount = await convertToCurrencyDecimals(yvwftm.address, yieldyvWFTM);
//     //Make some test WFTM for borrower
//     await impersonateAccountsHardhat([yvWFTMOwnerAddress]);
//     signer = await ethers.provider.getSigner(yvWFTMOwnerAddress);
//     await yvwftm.connect(signer).transfer(aYVWFTM.address, yieldyvWFTMAmount);

//     expect((await yearnVault.getYieldAmount()).gt(parseEther('999'))).to.be.equal(true);
//     expect(await usdc.balanceOf(yearnVault.address)).to.be.equal(0);
//     expect(await dai.balanceOf(yearnVault.address)).to.be.equal(0);
//     expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
//     expect(await aDai.balanceOf(depositor1.address)).to.be.equal(amountDAItoDeposit);
//     expect(await aUsdt.balanceOf(depositor2.address)).to.be.equal(amountUSDTtoDeposit);

//     // process yield, so all yield should be converted to usdc and dai
//     await yearnVault.processYield();
//     const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '8000');
//     const yieldDAI = await convertToCurrencyDecimals(dai.address, '8000');
//     const yieldUSDT = await convertToCurrencyDecimals(usdt.address, '4500');
//     expect((await aUsdc.balanceOf(depositor.address)).gt(yieldUSDC)).to.be.equal(true);
//     expect((await aDai.balanceOf(depositor1.address)).gt(yieldDAI)).to.be.equal(true);
//     expect((await aUsdt.balanceOf(depositor2.address)).gt(yieldUSDT)).to.be.equal(true);
//   });
// });

// makeSuite('yearnVault', (testEnv: TestEnv) => {
//   it('move some yield to treasury', async () => {
//     const { pool, yearnVault, usdc, users, yvwftm, aUsdc, aYVWFTM, WFTM } = testEnv;
//     const depositor = users[0];
//     const borrower = users[1];
//     const treasury = users[2];
//     const ethers = (DRE as any).ethers;
//     const usdcOwnerAddress = '0x93C08a3168fC469F3fC165cd3A471D19a37ca19e';
//     const depositUSDC = '7000';
//     //Make some test USDC for depositor
//     await impersonateAccountsHardhat([usdcOwnerAddress]);
//     let signer = await ethers.provider.getSigner(usdcOwnerAddress);
//     const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
//     await usdc.connect(signer).transfer(depositor.address, amountUSDCtoDeposit);

//     //approve protocol to access depositor wallet
//     await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

//     //Supplier  deposits 7000 USDC
//     await pool
//       .connect(depositor.signer)
//       .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

//     const WFTMOwnerAddress = '0x4901C740607E415685b4d09E4Aa960329cd183Ca';
//     const depositWFTM = '1000';
//     const depositWFTMAmount = await convertToCurrencyDecimals(WFTM.address, depositWFTM);
//     //Make some test WFTM for borrower
//     await impersonateAccountsHardhat([WFTMOwnerAddress]);
//     signer = await ethers.provider.getSigner(WFTMOwnerAddress);

//     //transfer to borrower
//     await WFTM.connect(signer).transfer(borrower.address, depositWFTMAmount);

//     //approve protocol to access borrower wallet
//     await WFTM.connect(borrower.signer).approve(yearnVault.address, APPROVAL_AMOUNT_LENDING_POOL);

//     // deposit collateral to borrow
//     await yearnVault.connect(borrower.signer).depositCollateral(WFTM.address, depositWFTMAmount);
//     expect(await yearnVault.getYieldAmount()).to.be.equal(0);

//     //To simulate yield in lendingPool, deposit some yvWFTM to aYVWFTM contract
//     const yvWFTMOwnerAddress = '0x41fB1251bd68796Ff7fdF51Fb312529F81817913';
//     const yieldyvWFTM = '1000';
//     const yieldyvWFTMAmount = await convertToCurrencyDecimals(yvwftm.address, yieldyvWFTM);
//     //Make some test WFTM for borrower
//     await impersonateAccountsHardhat([yvWFTMOwnerAddress]);
//     signer = await ethers.provider.getSigner(yvWFTMOwnerAddress);
//     await yvwftm.connect(signer).transfer(aYVWFTM.address, yieldyvWFTMAmount);

//     expect((await yearnVault.getYieldAmount()).gt(parseEther('999'))).to.be.equal(true);
//     expect(await usdc.balanceOf(yearnVault.address)).to.be.equal(0);
//     expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
//     expect(await yvwftm.balanceOf(treasury.address)).to.be.equal(0);

//     // process yield, so all yield should be converted to usdc
//     await yearnVault.setTreasuryInfo(treasury.address, '2000');
//     await yearnVault.processYield();

//     const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '8000');
//     expect((await aUsdc.balanceOf(depositor.address)).gt(yieldUSDC)).to.be.equal(true);
//     expect(
//         (await yvwftm.balanceOf(treasury.address)).gt(yieldyvWFTMAmount.mul(19).div(100))
//       ).to.be.equal(true);
//   });
// });
