import BigNumber from 'bignumber.js';

import {TestEnv, makeSuite} from './helpers/make-suite';
import {APPROVAL_AMOUNT_LENDING_POOL, oneRay} from '../helpers/constants';
import {convertToCurrencyDecimals, getContract} from '../helpers/contracts-helpers';
// import {ethers} from 'ethers';
import {ProtocolErrors, eContractid, RateMode} from '../helpers/types';
import {VariableDebtToken} from '../types/VariableDebtToken';
import {StableDebtToken} from '../types/StableDebtToken';
import {AmplVariableDebtToken} from '../types/AmplVariableDebtToken';
import {AmplStableDebtToken} from '../types/AmplStableDebtToken';
import {
  getAAmplToken,
  getAmplStableDebtToken,
  getAmplVariableDebtToken,
  getLendingRateOracle,
  getReserveLogic,
} from '../helpers/contracts-getters';
import {BigNumberish, ethers} from "ethers";
import {LendingRateOracle} from "../types/LendingRateOracle";
import {ILendingRateOracle} from "../types/ILendingRateOracle";
import {
  calcExpectedVariableDebtTokenBalance,
  calcExpectedStableDebtTokenBalance,
} from './helpers/utils/calculations';

const {expect} = require('chai');

makeSuite('Ampl aToken', (testEnv: TestEnv) => {
  const {
    VL_COLLATERAL_BALANCE_IS_0,
    TRANSFER_AMOUNT_EXCEEDS_BALANCE,
    SAFEERC20_LOWLEVEL_CALL,
    LP_BORROW_ALLOWANCE_NOT_ENOUGH,
  } = ProtocolErrors;

  before(async () => {
    const {ampl, deployer} = testEnv;
    await ampl.setMonetaryPolicy(deployer.address);
  });

  function printUserData(userData) {
    console.log('totalCollateralETH : ', userData.totalCollateralETH.toString());
    console.log('totalDebtETH: ',userData.totalDebtETH.toString());
    console.log('availableBorrowsETH: ', userData.availableBorrowsETH.toString());
    console.log('currentLiquidationThreshold: ', userData.currentLiquidationThreshold.toString());
    console.log('ltv: ', userData.ltv.toString());
    console.log('healthFactor: ', userData.healthFactor.toString());
  }

  it('Deposits AMPL into the reserve[First deposit]', async () => {

    const {pool, dai, ampl, users, addressesProvider, uni, aAMPL, aDai, deployer} = testEnv;

    // Borrower deposits
    const borrower = await users[1];
    const collateralAmount = await convertToCurrencyDecimals(dai.address, '20000');
    await dai.mint(collateralAmount);
    await dai.approve(pool.address, collateralAmount);
    await pool.deposit(dai.address, collateralAmount, borrower.address, '0');

    // Lender deposits
    const lender = await users[0];
    const amountToDeposit = await convertToCurrencyDecimals(ampl.address, '10000');
    await ampl.connect(deployer.signer).transfer(lender.address, amountToDeposit);
    await ampl.connect(lender.signer).approve(pool.address, amountToDeposit);
    await pool.connect(lender.signer).deposit(ampl.address, amountToDeposit, lender.address, '0');

    // Borrowing
    const amountToBorrow = await convertToCurrencyDecimals(ampl.address, '2000');
    await pool.connect(borrower.signer).borrow(
      ampl.address, amountToBorrow, RateMode.Variable,'0', borrower.address);

    let variableDebtToken = await getAmplVariableDebtToken((await aAMPL.VARIABLE_DEBT_TOKEN_ADDRESS()));
    const debt = await variableDebtToken.balanceOf(borrower.address);
    expect(debt.toString()).to.be.bignumber.equal((await convertToCurrencyDecimals(ampl.address, '2000')).toString());
    expect((await ampl.balanceOf(borrower.address)).toString()).to.be.bignumber.equal((await convertToCurrencyDecimals(ampl.address, '2000')).toString());
    expect((await aAMPL.balanceOf(borrower.address)).toString()).to.be.bignumber.equal((await convertToCurrencyDecimals(ampl.address, '0')).toString());
    expect((await ampl.balanceOf(lender.address)).toString()).to.be.bignumber.equal((await convertToCurrencyDecimals(ampl.address, '0')).toString());
    expect((await aAMPL.balanceOf(lender.address)).toString()).to.be.bignumber.almostEqual((await convertToCurrencyDecimals(ampl.address, '10000')).toString());
    await pool.connect(lender.signer).withdraw(ampl.address, amountToDeposit, lender.address);
  });

  it('Deposits AMPL into the reserve[lone depositor]', async () => {
    const {pool, dai, ampl, users, addressesProvider, uni, aAMPL, aDai, deployer} = testEnv;

    // Lender deposits
    const lender = await users[0];
    const amountToDeposit = await convertToCurrencyDecimals(ampl.address, '5000');
    await ampl.connect(deployer.signer).transfer(lender.address, amountToDeposit);
    await ampl.connect(lender.signer).approve(pool.address, amountToDeposit);
    await pool.connect(lender.signer).deposit(ampl.address, amountToDeposit, lender.address, '0');

    // Borrowing more
    const borrower = await users[1];
    const amountToBorrow = await convertToCurrencyDecimals(ampl.address, '1000');
    await pool.connect(borrower.signer).borrow(
      ampl.address, amountToBorrow, RateMode.Variable,'0', borrower.address);

    let variableDebtToken = await getAmplVariableDebtToken((await aAMPL.VARIABLE_DEBT_TOKEN_ADDRESS()));
    const debt = await variableDebtToken.balanceOf(borrower.address);
    // expect(debt.toString()).to.be.bignumber.almostEqual((await convertToCurrencyDecimals(ampl.address, '3000')).toString());
    expect((await ampl.balanceOf(borrower.address)).toString()).to.be.bignumber.equal((await convertToCurrencyDecimals(ampl.address, '3000')).toString());
    expect((await aAMPL.balanceOf(borrower.address)).toString()).to.be.bignumber.equal((await convertToCurrencyDecimals(ampl.address, '0')).toString());
    expect((await ampl.balanceOf(lender.address)).toString()).to.be.bignumber.equal((await convertToCurrencyDecimals(ampl.address, '0')).toString());
    expect((await aAMPL.balanceOf(lender.address)).toString()).to.be.bignumber.almostEqual((await convertToCurrencyDecimals(ampl.address, '15000')).toString());
  });

  // it('Negative rebase', async () => {
  //
  //   const {pool, dai, ampl, users, addressesProvider, uni, aAMPL, aDai, deployer} = testEnv;
  //
  //   // let amplReserve = await pool.getReserveData(ampl.address);
  //   // console.log('amplReserve:');
  //   // console.log(amplReserve);
  //   //
  //   // // Borrower deposits
  //   const borrower = await users[1];
  //   // const collateralAmount = await convertToCurrencyDecimals(dai.address, '20000');
  //   // await dai.mint(collateralAmount);
  //   // await dai.approve(pool.address, collateralAmount);
  //   // await pool.deposit(dai.address, collateralAmount, borrower.address, '0');
  //   //
  //   // // Lender deposits
  //   const lender = await users[0];
  //   // const amountToDeposit = await convertToCurrencyDecimals(ampl.address, '10000');
  //   //
  //   // console.log('Deployer test: ' + deployer.address);
  //   // console.log('balance : ' + (await ampl.balanceOf(deployer.address)).toString());
  //   //
  //   // await ampl.connect(deployer.signer).transfer(lender.address, amountToDeposit);
  //   //
  //   // console.log('Balance: ' +  (await ampl.balanceOf(lender.address)).toNumber());
  //   // await ampl.connect(lender.signer).approve(pool.address, amountToDeposit);
  //   // console.log('Allowance: ' +  (await ampl.allowance(lender.address, pool.address)).toNumber());
  //   //
  //   // console.log(await aAMPL._fetchExtData());
  //   //
  //   // await pool.connect(lender.signer).deposit(ampl.address, amountToDeposit, lender.address, '0');
  //   //
  //   //
  //   // // Borrowing
  //   // const amountToBorrow = await convertToCurrencyDecimals(ampl.address, '1000');
  //   // await pool.connect(borrower.signer).borrow(ampl.address, amountToBorrow, RateMode.Variable,'0', borrower.address);
  //   // const amountToBorrow = await convertToCurrencyDecimals(ampl.address, '1000');
  //   // await pool.connect(borrower.signer).borrow(ampl.address, amountToBorrow, RateMode.Variable,'0', borrower.address);
  //
  //   let lenderUserData = await pool.getUserAccountData(lender.address);
  //   printUserData(lenderUserData);
  //   let borrowerUserData = await pool.getUserAccountData(borrower.address);
  //   printUserData(borrowerUserData);
  //
  //   const rebase_amount = new BigNumber((await ampl.totalSupply()).toString()).multipliedBy(-0.1);
  //   // -10% Rebase
  //   await ampl.rebase(1, rebase_amount.toString());
  //   // await expect(ampl.balanceOf(borrower.address)).to.be.equal(
  //   //   await convertToCurrencyDecimals(ampl.address, '10000'));
  //   console.log((await ampl.balanceOf(borrower.address)).toString());
  //   console.log((await aAMPL.balanceOf(borrower.address)).toString());
  //   console.log((await ampl.balanceOf(lender.address)).toString());
  //   console.log((await aAMPL.balanceOf(lender.address)).toString());
  //
  // });
  //
  // it('Positive rebase', async () => {
  //
  //   const {pool, dai, ampl, users, addressesProvider, uni, aAMPL, aDai, deployer} = testEnv;
  //
  //   // let amplReserve = await pool.getReserveData(ampl.address);
  //   // console.log('amplReserve:');
  //   // console.log(amplReserve);
  //   //
  //   // // Borrower deposits
  //   const borrower = await users[1];
  //   // const collateralAmount = await convertToCurrencyDecimals(dai.address, '20000');
  //   // await dai.mint(collateralAmount);
  //   // await dai.approve(pool.address, collateralAmount);
  //   // await pool.deposit(dai.address, collateralAmount, borrower.address, '0');
  //   //
  //   // // Lender deposits
  //   const lender = await users[0];
  //   // const amountToDeposit = await convertToCurrencyDecimals(ampl.address, '10000');
  //   //
  //   // console.log('Deployer test: ' + deployer.address);
  //   // console.log('balance : ' + (await ampl.balanceOf(deployer.address)).toString());
  //   //
  //   // await ampl.connect(deployer.signer).transfer(lender.address, amountToDeposit);
  //   //
  //   // console.log('Balance: ' +  (await ampl.balanceOf(lender.address)).toNumber());
  //   // await ampl.connect(lender.signer).approve(pool.address, amountToDeposit);
  //   // console.log('Allowance: ' +  (await ampl.allowance(lender.address, pool.address)).toNumber());
  //   //
  //   // console.log(await aAMPL._fetchExtData());
  //   //
  //   // await pool.connect(lender.signer).deposit(ampl.address, amountToDeposit, lender.address, '0');
  //   //
  //   //
  //   // // Borrowing
  //   // const amountToBorrow = await convertToCurrencyDecimals(ampl.address, '1000');
  //   // await pool.connect(borrower.signer).borrow(ampl.address, amountToBorrow, RateMode.Variable,'0', borrower.address);
  //   // const amountToBorrow = await convertToCurrencyDecimals(ampl.address, '1000');
  //   // await pool.connect(borrower.signer).borrow(ampl.address, amountToBorrow, RateMode.Variable,'0', borrower.address);
  //
  //   let lenderUserData = await pool.getUserAccountData(lender.address);
  //   printUserData(lenderUserData);
  //   let borrowerUserData = await pool.getUserAccountData(borrower.address);
  //   printUserData(borrowerUserData);
  //
  //   const rebase_amount = new BigNumber((await ampl.totalSupply()).toString()).multipliedBy(0.1);
  //   // +10% Rebase
  //   await ampl.rebase(1, rebase_amount.toString());
  //   // await expect(ampl.balanceOf(borrower.address)).to.be.equal(
  //   //   await convertToCurrencyDecimals(ampl.address, '10000'));
  //   console.log((await ampl.balanceOf(borrower.address)).toString());
  //   console.log((await aAMPL.balanceOf(borrower.address)).toString());
  //   console.log((await ampl.balanceOf(lender.address)).toString());
  //   console.log((await aAMPL.balanceOf(lender.address)).toString());
  //
  // });
});
