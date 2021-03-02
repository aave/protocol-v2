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

  before(async () => {
    const {ampl, deployer} = testEnv;
    ampl.setMonetaryPolicy(deployer.address);
  });

  function printUserData(userData) {
    console.log('totalCollateralETH : ', userData.totalCollateralETH.toString());
    console.log('totalDebtETH: ',userData.totalDebtETH.toString());
    console.log('availableBorrowsETH: ', userData.availableBorrowsETH.toString());
    console.log('currentLiquidationThreshold: ', userData.currentLiquidationThreshold.toString());
    console.log('ltv: ', userData.ltv.toString());
    console.log('healthFactor: ', userData.healthFactor.toString());
  }

  it('Deposits AMPL into the reserve', async () => {

    const {pool, dai, ampl, users, addressesProvider, uni, aAMPL, aDai, deployer} = testEnv;

    let amplReserve = await pool.getReserveData(ampl.address);
    console.log('amplReserve:');
    console.log(amplReserve);


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
    let lenderUserData = await pool.getUserAccountData(borrower.address)
    printUserData(lenderUserData);

    // Borrowing
    const amountToBorrow = await convertToCurrencyDecimals(ampl.address, '1000');
    await pool.connect(borrower.signer).borrow(ampl.address, amountToBorrow, RateMode.Variable,'0', borrower.address);

    let borrowerUserData = await pool.getUserAccountData(borrower.address);

    console.log((await ampl.balanceOf(borrower.address)).toString());
    console.log((await aAMPL.balanceOf(borrower.address)).toString());
    console.log((await ampl.balanceOf(lender.address)).toString());
    console.log((await aAMPL.balanceOf(lender.address)).toString());
    printUserData(borrowerUserData);
  });
});
