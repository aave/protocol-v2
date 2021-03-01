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
  getStableDebtToken,
  getVariableDebtToken,
  getLendingRateOracle, getReserveLogic,
} from '../helpers/contracts-getters';
import {ethers} from "ethers";
import {LendingRateOracle} from "../types/LendingRateOracle";
import {ILendingRateOracle} from "../types/ILendingRateOracle";

const {expect} = require('chai');

makeSuite('Ampl aToken', (testEnv: TestEnv) => {
  const {
    VL_COLLATERAL_BALANCE_IS_0,
    TRANSFER_AMOUNT_EXCEEDS_BALANCE,
    SAFEERC20_LOWLEVEL_CALL,
    LP_BORROW_ALLOWANCE_NOT_ENOUGH,
  } = ProtocolErrors;

  // before(async () => {
  // });

  // it('Deposits WETH into the reserve', async () => {
  //   const {pool, weth, ampl} = testEnv;
  //   const userAddress = await pool.signer.getAddress();
  //   const amountToDeposit = ethers.utils.parseEther('1');
  //
  //   await weth.mint(amountToDeposit);
  //
  //   await weth.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
  //
  //   await pool.deposit(weth.address, amountToDeposit, userAddress, '0');
  // });

  it('Deposits UNI into the reserve', async () => {
    const {pool, weth, uni, ampl, users} = testEnv;
    const user = await users[0]
    const amountToDeposit = await convertToCurrencyDecimals(uni.address, '20000');

    await uni.mint(amountToDeposit);

    await uni.approve(pool.address, amountToDeposit);

    await pool.deposit(uni.address, amountToDeposit, user.address, '0');
  });
  //
  // it('Deposits DAI into the reserve', async () => {
  //   const { pool, weth, users,dai } = testEnv;
  //   const user = await users[0]
  //   const amountToDeposit = await convertToCurrencyDecimals(dai.address, '20000');
  //   await dai.mint(amountToDeposit);
  //
  //   await dai.approve(pool.address, amountToDeposit);
  //
  //   await pool.deposit(dai.address, amountToDeposit, user.address, '0');
  // });
  //
  //
  // it('Deposits AAVE into the reserve', async () => {
  //   const { pool, weth, users,aave } = testEnv;
  //   const user = await users[0]
  //   const amountToDeposit = await convertToCurrencyDecimals(aave.address, '20000');
  //   await aave.mint(amountToDeposit);
  //
  //   await aave.approve(pool.address, amountToDeposit);
  //
  //   await pool.deposit(aave.address, amountToDeposit, user.address, '0');
  // });

  function printUserData(userData) {

    console.log('totalCollateralETH : ', userData.totalCollateralETH.toString());
    console.log('totalDebtETH: ',userData.totalDebtETH.toNumber());
    console.log('availableBorrowsETH: ', userData.availableBorrowsETH.toNumber());
    console.log('currentLiquidationThreshold: ', userData.currentLiquidationThreshold.toNumber());
    console.log('ltv: ', userData.ltv.toNumber());
    console.log('healthFactor: ', userData.healthFactor.toNumber());
    console.log('healthFactor: ', userData.healthFactor.toNumber());
  }

  it('Deposits AMPL into the reserve', async () => {

    const {pool, dai, ampl, users, addressesProvider, uni, aAMPL, aDai, deployer} = testEnv;

    let amplReserve = await pool.getReserveData(ampl.address);
    let uniReserve = await pool.getReserveData(uni.address);
    let daiReserve = await pool.getReserveData(dai.address);
    console.log('amplReserve:');
    console.log(amplReserve);
    // console.log(uniReserve);
    // console.log(daiReserve);


    // Borrower deposits
    const borrower = await users[1];
    const collateralAmount = await convertToCurrencyDecimals(dai.address, '20000');
    await dai.mint(collateralAmount);
    await dai.approve(pool.address, collateralAmount);
    await pool.deposit(dai.address, collateralAmount, borrower.address, '0');


    // Lender deposits
    const lender = await users[0];
    const amountToDeposit = await convertToCurrencyDecimals(ampl.address, '10000');

    console.log('Deployer test: ' + deployer.address);
    console.log('balance : ' + (await ampl.balanceOf(deployer.address)).toString());

    await ampl.connect(deployer.signer).transfer(lender.address, amountToDeposit);

    console.log('Balance: ' +  (await ampl.balanceOf(lender.address)).toNumber());
    await ampl.connect(lender.signer).approve(pool.address, amountToDeposit);
    console.log('Allowance: ' +  (await ampl.allowance(lender.address, pool.address)).toNumber());

    // console.log("ampl Rate : " + await rateOracle.getMarketBorrowRate(ampl.address));
    // console.log("aAMPL Rate : " + await rateOracle.getMarketBorrowRate(aAMPL.address));
    // console.log("dai Rate : " + await rateOracle.getMarketBorrowRate(dai.address));
    // console.log("aUSDC Rate : " + await rateOracle.getMarketBorrowRate(aDai.address));
    console.log(await aAMPL._fetchExtData());

    await pool.connect(lender.signer).deposit(ampl.address, amountToDeposit, lender.address, '0');
    let lenderUserData = await pool.getUserAccountData(borrower.address);
    printUserData(lenderUserData);


    // Borrowing
    const amountToBorrow = await convertToCurrencyDecimals(ampl.address, '1000');
    await pool.connect(borrower.signer).borrow(ampl.address, amountToBorrow, RateMode.Variable,'0', borrower.address);

    let borrowerUserData = await pool.getUserAccountData(borrower.address);
    printUserData(borrowerUserData);
  });
});
