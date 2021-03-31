import BigNumber from 'bignumber.js';

import {TestEnv, makeSuite} from './helpers/make-suite';
import { MAX_UINT_AMOUNT, APPROVAL_AMOUNT_LENDING_POOL, oneRay} from '../helpers/constants';
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
  calcExpectedATokenBalance,
} from './helpers/utils/calculations';
import {getTxCostAndTimestamp} from "./helpers/actions";
import {DRE, waitForTx, advanceTimeAndBlock, evmSnapshot, evmRevert} from "../helpers/misc-utils";
import {getReserveData, getUserData} from "./helpers/utils/helpers";

const {expect} = require('chai');


let lenderA, lenderB, lenderC, admin, borrowerA, borrowerB,
  lenderAAddress, lenderBAddress, lenderCAddress, adminAddress,
  borrowerAAddress, borrowerBAddress,
  evmSnapshotId, reserveData, debtToken, treasuryAddress;

async function rebase(pool, ampl, perc){
  const currentSupply = new BigNumber((await ampl.totalSupply()).toString());
  const supplyDelta = currentSupply.multipliedBy(perc);


  // Interest rate changes up or down after rebase
  // Option 1: tell lending pool to recalculate rate
  await ampl.rebase(1, supplyDelta.toString(10));
  await pool.syncInterestRates(ampl.address);

  // Option 2: tiny deposit to get the pool in sync
  // await ampl.connect(admin.signer).approve(pool.address, await fxtPt(ampl, '1'));
  // await pool.connect(admin.signer).deposit(ampl.address, await fxtPt(ampl, '0.001'), adminAddress, '0');
  // await ampl.rebase(1, supplyDelta.toString(10));
  // await pool.connect(admin.signer).deposit(ampl.address, await fxtPt(ampl, '0.001'), adminAddress, '0');
}

function fxtPt(t, amt){
  return convertToCurrencyDecimals(t.address, amt);
}

async function check(amt, cmpAmt, token, tolarance){
  const t = new BigNumber(tolarance).multipliedBy(10 ** (await token.decimals())).toString();
  expect(amt).to.be.bignumber
    .gte(cmpAmt.sub(t))
    .lte(cmpAmt.add(t));
}

// tolarance 1 AMPL cent ~= 0.01 AMPL
async function checkBal(token, addr, amt, tolarance=0.01){
 return check(await token.balanceOf(addr), await fxtPt(token, amt), token, tolarance);
}

async function checkScaledBal(token, addr, amt, tolarance=0.01){
 return check(await token.scaledBalanceOf(addr), await fxtPt(token, amt), token, tolarance);
}

async function checkSupply(token, amt, tolarance=0.01){
 return check(await token.totalSupply(), await fxtPt(token, amt), token, tolarance);
}

makeSuite('AMPL aToken', (testEnv: TestEnv) => {
  beforeEach(async () => {
    evmSnapshotId = await evmSnapshot();

    const {users, ampl, aAMPL, deployer, helpersContract, pool} = testEnv;
    await ampl.setMonetaryPolicy(deployer.address);
    const { stableDebtTokenAddress,variableDebtTokenAddress } = await helpersContract.getReserveTokensAddresses(
      ampl.address
    );

    treasuryAddress = await aAMPL.RESERVE_TREASURY_ADDRESS();
    // console.log("ampl", ampl.address);
    // console.log("aAMPL", aAMPL.address);
    // console.log("stable", stableDebtTokenAddress);
    // console.log("variable", variableDebtTokenAddress);

    lenderA = users[1];
    lenderB = users[2];
    lenderC = users[3];
    borrowerA = users[4];
    borrowerB = users[5];
    admin = users[6];

    lenderAAddress = lenderA.address;
    lenderBAddress = lenderB.address;
    lenderCAddress = lenderC.address;
    borrowerAAddress = borrowerA.address;
    borrowerBAddress = borrowerB.address;
    adminAddress = admin.address;

    reserveData = await pool.getReserveData(ampl.address);

    await ampl.connect(deployer.signer).transfer(lenderAAddress, await fxtPt(ampl, '100000'));
    await ampl.connect(deployer.signer).transfer(lenderBAddress, await fxtPt(ampl, '100000'));
    await ampl.connect(deployer.signer).transfer(lenderCAddress, await fxtPt(ampl, '100000'));
    await ampl.connect(deployer.signer).transfer(adminAddress, await fxtPt(ampl, '1000'));

    debtToken = await getAmplVariableDebtToken((await aAMPL.VARIABLE_DEBT_TOKEN_ADDRESS()));
  });

  afterEach(async () => {
    await evmRevert(evmSnapshotId);
  });

  describe("user deposit", function(){
    describe("first deposit", function() {
      it('should mint correct number of aAMPL tokens', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await checkBal(ampl, lenderAAddress, '100000');
        await checkBal(aAMPL, lenderAAddress, '0');
        await checkBal(ampl, reserveData.aTokenAddress, '0');
        await checkSupply(aAMPL, '0');

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '1000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '99000');
        await checkBal(aAMPL, lenderAAddress, '1000');
        await checkBal(ampl, reserveData.aTokenAddress, '1000');
        await checkSupply(aAMPL, '1000');
      });

      it('should update balances after positive rebase', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '1000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '99000');
        await checkBal(aAMPL, lenderAAddress, '1000');
        await checkBal(ampl, reserveData.aTokenAddress, '1000');
        await checkSupply(aAMPL, '1000');

        await rebase(pool, ampl, 0.1); // + 10%

        await checkBal(ampl, lenderAAddress, '108900');
        await checkBal(aAMPL, lenderAAddress, '1100');
        await checkBal(ampl, reserveData.aTokenAddress, '1100');
        await checkSupply(aAMPL, '1100');
      });

      it('should update balances after negative rebase', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '1000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '99000');
        await checkBal(aAMPL, lenderAAddress, '1000');
        await checkBal(ampl, reserveData.aTokenAddress, '1000');
        await checkSupply(aAMPL, '1000');

        await rebase(pool, ampl, -0.1); // - 10%

        await checkBal(ampl, lenderAAddress, '89100');
        await checkBal(aAMPL, lenderAAddress, '900');
        await checkBal(ampl, reserveData.aTokenAddress, '900');
        await checkSupply(aAMPL, '900');
      });

      it('should update balances after neutral rebase', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '1000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '99000');
        await checkBal(aAMPL, lenderAAddress, '1000');
        await checkBal(ampl, reserveData.aTokenAddress, '1000');
        await checkSupply(aAMPL, '1000');

        await rebase(pool, ampl, 0);

        await checkBal(ampl, lenderAAddress, '99000');
        await checkBal(aAMPL, lenderAAddress, '1000');
        await checkBal(ampl, reserveData.aTokenAddress, '1000');
        await checkSupply(aAMPL, '1000');
      });
    });

    describe("lone user", function() {
      it('should mint correct number of aAMPL tokens', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '11000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '99000');
        await checkBal(aAMPL, lenderAAddress, '1000');
        await checkBal(ampl, reserveData.aTokenAddress, '1000');
        await checkSupply(aAMPL, '1000');

        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '10000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '89000');
        await checkBal(aAMPL, lenderAAddress, '11000');
        await checkBal(ampl, reserveData.aTokenAddress, '11000');
        await checkSupply(aAMPL, '11000');
      });

      it('should update balances after positive rebase', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '11000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress, '0');
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '10000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '89000');
        await checkBal(aAMPL, lenderAAddress, '11000');
        await checkBal(ampl, reserveData.aTokenAddress, '11000');
        await checkSupply(aAMPL, '11000');

        await rebase(pool, ampl, +0.1);

        await checkBal(ampl, lenderAAddress, '97900');
        await checkBal(aAMPL, lenderAAddress, '12100');
        await checkBal(ampl, reserveData.aTokenAddress, '12100');
        await checkSupply(aAMPL, '12100');
      });

      it('should update balances after negative rebase', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '11000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress, '0');
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '10000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '89000');
        await checkBal(aAMPL, lenderAAddress, '11000');
        await checkBal(ampl, reserveData.aTokenAddress, '11000');
        await checkSupply(aAMPL, '11000');

        await rebase(pool, ampl, -0.1);

        await checkBal(ampl, lenderAAddress, '80100');
        await checkBal(aAMPL, lenderAAddress, '9900');
        await checkBal(ampl, reserveData.aTokenAddress, '9900');
        await checkSupply(aAMPL, '9900');
      });
    });

    describe("many users", function() {
      it('should mint correct number of aAMPL tokens', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '33000'));
        await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '5000'));
        await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '350'));

        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '30000'), lenderAAddress, '0');
        await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '5000'), lenderBAddress, '0');
        await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '350'), lenderCAddress, '0');

        await checkBal(ampl, lenderAAddress, '70000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '99650');
        await checkBal(aAMPL, lenderAAddress, '30000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '350');
        await checkBal(ampl, reserveData.aTokenAddress, '35350');
        await checkSupply(aAMPL, '35350');

        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '3000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '67000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '99650');
        await checkBal(aAMPL, lenderAAddress, '33000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '350');
        await checkBal(ampl, reserveData.aTokenAddress, '38350');
        await checkSupply(aAMPL, '38350');
      });

      it('should update balances after positive rebase', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '33000'));
        await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '5000'));
        await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '350'));

        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '30000'), lenderAAddress, '0');
        await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '5000'), lenderBAddress, '0');
        await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '350'), lenderCAddress, '0');

        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '3000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '67000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '99650');
        await checkBal(aAMPL, lenderAAddress, '33000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '350');
        await checkBal(ampl, reserveData.aTokenAddress, '38350');
        await checkSupply(aAMPL, '38350');

        await rebase(pool, ampl, +0.1);

        await checkBal(ampl, lenderAAddress, '73700');
        await checkBal(ampl, lenderBAddress, '104500');
        await checkBal(ampl, lenderCAddress, '109615');
        await checkBal(aAMPL, lenderAAddress, '36300');
        await checkBal(aAMPL, lenderBAddress, '5500');
        await checkBal(aAMPL, lenderCAddress, '385');
        await checkBal(ampl, reserveData.aTokenAddress, '42185');
        await checkSupply(aAMPL, '42185');
      });

      it('should update balances after negative rebase', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '33000'));
        await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '5000'));
        await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '350'));

        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '30000'), lenderAAddress, '0');
        await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '5000'), lenderBAddress, '0');
        await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '350'), lenderCAddress, '0');

        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '3000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '67000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '99650');
        await checkBal(aAMPL, lenderAAddress, '33000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '350');
        await checkBal(ampl, reserveData.aTokenAddress, '38350');
        await checkSupply(aAMPL, '38350');

        await rebase(pool, ampl, -0.1);

        await checkBal(ampl, lenderAAddress, '60300');
        await checkBal(ampl, lenderBAddress, '85500');
        await checkBal(ampl, lenderCAddress, '89685');
        await checkBal(aAMPL, lenderAAddress, '29700');
        await checkBal(aAMPL, lenderBAddress, '4500');
        await checkBal(aAMPL, lenderCAddress, '315');
        await checkBal(ampl, reserveData.aTokenAddress, '34515');
        await checkSupply(aAMPL, '34515');
      });
    });

    describe("v large deposit", function() {
      it('should mint correct number of aAMPL tokens', async () => {
        const {deployer, pool, ampl, aAMPL} = testEnv;

        await ampl.connect(deployer.signer).transfer(lenderAAddress, await fxtPt(ampl, '100000'));
        await rebase(pool, ampl, 9999999)
        await checkSupply(ampl, '500000000000000'); // 500T

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '1000000000000')); // 1T
        await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '500000000000')); // 0.5T
        await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '500000000000')); // 0.5T
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000000000000'), lenderAAddress, '0');
        await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '500000000000'), lenderBAddress, '0');
        await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '500000000000'), lenderCAddress, '0');

        await checkBal(ampl, lenderAAddress, '1000000000000');
        await checkBal(ampl, lenderBAddress, '500000000000');
        await checkBal(ampl, lenderCAddress, '500000000000');
        await checkBal(aAMPL, lenderAAddress, '1000000000000');
        await checkBal(ampl, reserveData.aTokenAddress, '2000000000000');
        await checkSupply(aAMPL, '2000000000000');

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '1000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '999999999000');
        await checkBal(ampl, lenderBAddress, '500000000000');
        await checkBal(ampl, lenderCAddress, '500000000000');
        await checkBal(aAMPL, lenderAAddress, '1000000001000');
        await checkBal(ampl, reserveData.aTokenAddress, '2000000001000');
        await checkSupply(aAMPL, '2000000001000');
      });
    });

    describe("when borrow>0", function() {
      it('should mint correct number of aAMPL tokens', async () => {
        const {deployer, dai, pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '33000'));
        await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '5000'));
        await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '350'));

        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '30000'), lenderAAddress, '0');
        await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '5000'), lenderBAddress, '0');
        await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '350'), lenderCAddress, '0');

        // borrower borrows 2500 AMPL
        await dai.connect(deployer.signer).mint(await fxtPt(dai, '20000'));
        await dai.transfer(borrowerAAddress, await fxtPt(dai, '20000'));
        await dai.connect(borrowerA.signer).approve(pool.address, await fxtPt(dai, '20000'));
        await pool.connect(borrowerA.signer).deposit(dai.address, await fxtPt(dai, '20000'), borrowerAAddress, '0');
        await pool.connect(borrowerA.signer).borrow(
          ampl.address, await fxtPt(ampl, '2500'), RateMode.Variable, '0', borrowerAAddress);

        await checkBal(ampl, lenderAAddress, '70000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '99650');
        await checkBal(aAMPL, lenderAAddress, '30000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '350');
        await checkBal(ampl, reserveData.aTokenAddress, '32850');
        await checkSupply(aAMPL, '35350');

        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '3000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '67000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '99650');
        await checkBal(aAMPL, lenderAAddress, '33000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '350');
        await checkBal(ampl, reserveData.aTokenAddress, '35850');
        await checkSupply(aAMPL, '38350');
      });

      it('should update balances on positive rebase', async () => {
        const {deployer, dai, pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '33000'));
        await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '5000'));
        await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '350'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '33000'), lenderAAddress, '0');
        await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '5000'), lenderBAddress, '0');
        await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '350'), lenderCAddress, '0');

        await dai.connect(deployer.signer).mint(await fxtPt(dai, '20000'));
        await dai.transfer(borrowerAAddress, await fxtPt(dai, '20000'));
        await dai.connect(borrowerA.signer).approve(pool.address, await fxtPt(dai, '20000'));
        await pool.connect(borrowerA.signer).deposit(dai.address, await fxtPt(dai, '20000'), borrowerAAddress, '0');
        await pool.connect(borrowerA.signer).borrow(
          ampl.address, await fxtPt(ampl, '2500'), RateMode.Variable, '0', borrowerAAddress);


        await checkBal(ampl, lenderAAddress, '67000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '99650');
        await checkBal(aAMPL, lenderAAddress, '33000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '350');
        await checkBal(ampl, reserveData.aTokenAddress, '35850');
        await checkSupply(aAMPL, '38350');

        await rebase(pool, ampl, +0.1);

        await checkBal(ampl, lenderAAddress, '73700');
        await checkBal(ampl, lenderBAddress, '104500');
        await checkBal(ampl, lenderCAddress, '109615');
        await checkBal(aAMPL, lenderAAddress, '36084.87');
        await checkBal(aAMPL, lenderBAddress, '5467.40');
        await checkBal(aAMPL, lenderCAddress, '382.71');
        await checkBal(ampl, reserveData.aTokenAddress, '39435.00');

        // unborrowed (39435.00) + borrowed (2500)
        await checkSupply(aAMPL, '41935.00');
      });

      it('should update balances on negative rebase', async () => {
        const {deployer, dai, pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '33000'));
        await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '5000'));
        await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '350'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '33000'), lenderAAddress, '0');
        await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '5000'), lenderBAddress, '0');
        await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '350'), lenderCAddress, '0');

        await dai.connect(deployer.signer).mint(await fxtPt(dai, '20000'));
        await dai.transfer(borrowerAAddress, await fxtPt(dai, '20000'));
        await dai.connect(borrowerA.signer).approve(pool.address, await fxtPt(dai, '20000'));
        await pool.connect(borrowerA.signer).deposit(dai.address, await fxtPt(dai, '20000'), borrowerAAddress, '0');
        await pool.connect(borrowerA.signer).borrow(
          ampl.address, await fxtPt(ampl, '2500'), RateMode.Variable, '0', borrowerAAddress);

        await checkBal(ampl, lenderAAddress, '67000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '99650');
        await checkBal(aAMPL, lenderAAddress, '33000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '350');
        await checkBal(ampl, reserveData.aTokenAddress, '35850');
        await checkSupply(aAMPL, '38350');

        await rebase(pool, ampl, -0.1);

        await checkBal(ampl, lenderAAddress, '60300');
        await checkBal(ampl, lenderBAddress, '85500');
        await checkBal(ampl, lenderCAddress, '89685');
        await checkBal(aAMPL, lenderAAddress, '29915.12');
        await checkBal(aAMPL, lenderBAddress, '4532.59');
        await checkBal(aAMPL, lenderCAddress, '317.28');
        await checkBal(ampl, reserveData.aTokenAddress, '32265');

        // unborrowed (32265.00) + borrowed (2500)
        await checkSupply(aAMPL, '34765.00');
      });
    });
  });

  describe("user withdraw", function(){
    describe("single deposit partial withdraw", function() {
      it('should burn correct number of aAMPL tokens', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '1000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '99000');
        await checkBal(aAMPL, lenderAAddress, '1000');
        await checkBal(ampl, reserveData.aTokenAddress, '1000');
        await checkSupply(aAMPL, '1000');

        await pool.connect(lenderA.signer).withdraw(ampl.address, await fxtPt(ampl, '100'), lenderAAddress);

        await checkBal(ampl, lenderAAddress, '99100');
        await checkBal(aAMPL, lenderAAddress, '900');
        await checkBal(ampl, reserveData.aTokenAddress, '900');
        await checkSupply(aAMPL, '900');
      });
    });

    describe("single deposit full withdraw", function() {
      it('should burn correct number of aAMPL tokens', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '1000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '99000');
        await checkBal(aAMPL, lenderAAddress, '1000');
        await checkBal(ampl, reserveData.aTokenAddress, '1000');
        await checkSupply(aAMPL, '1000');

        await pool.connect(lenderA.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderAAddress);

        await checkBal(ampl, lenderAAddress, '100000');
        await checkBal(aAMPL, lenderAAddress, '0');
        await checkBal(ampl, reserveData.aTokenAddress, '0');
        await checkSupply(aAMPL, '0');
      });

      it('should burn correct number of aAMPL positive rebase', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '1000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '99000');
        await checkBal(aAMPL, lenderAAddress, '1000');
        await checkBal(ampl, reserveData.aTokenAddress, '1000');
        await checkSupply(aAMPL, '1000');

        await rebase(pool, ampl, 0.1); // + 10%
        await pool.connect(lenderA.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderAAddress);

        await checkBal(ampl, lenderAAddress, '110000');
        await checkBal(aAMPL, lenderAAddress, '0');
        await checkBal(ampl, reserveData.aTokenAddress, '0');
        await checkSupply(aAMPL, '0');
      });

      it('should burn correct number of aAMPL negative rebase', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '1000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '99000');
        await checkBal(aAMPL, lenderAAddress, '1000');
        await checkBal(ampl, reserveData.aTokenAddress, '1000');
        await checkSupply(aAMPL, '1000');

        await rebase(pool, ampl, -0.1); // - 10%
        await pool.connect(lenderA.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderAAddress);

        await checkBal(ampl, lenderAAddress, '90000');
        await checkBal(aAMPL, lenderAAddress, '0');
        await checkBal(ampl, reserveData.aTokenAddress, '0');
        await checkSupply(aAMPL, '0');
      });
    });

    describe("lone user multiple withdraws", function() {
      it('should burn correct number of aAMPL tokens', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '10000'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '10000'), lenderAAddress, '0');

        await checkBal(ampl, lenderAAddress, '90000');
        await checkBal(aAMPL, lenderAAddress, '10000');
        await checkBal(ampl, reserveData.aTokenAddress, '10000');
        await checkSupply(aAMPL, '10000');

        await pool.connect(lenderA.signer).withdraw(ampl.address, await fxtPt(ampl, '1000'), lenderAAddress);

        await checkBal(ampl, lenderAAddress, '91000');
        await checkBal(aAMPL, lenderAAddress, '9000');
        await checkBal(ampl, reserveData.aTokenAddress, '9000');
        await checkSupply(aAMPL, '9000');

        await advanceTimeAndBlock(3600*24*365); // 1 year
        await pool.connect(lenderA.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderAAddress);

        await checkBal(ampl, lenderAAddress, '100000');
        await checkBal(aAMPL, lenderAAddress, '0');
        await checkBal(ampl, reserveData.aTokenAddress, '0');
        await checkSupply(aAMPL, '0');
      });
    });

    describe("multiple withdraws", function() {
      it('should burn correct number of aAMPL tokens', async () => {
        const {pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '33000'));
        await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '5000'));
        await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '350'));

        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '30000'), lenderAAddress, '0');
        await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '5000'), lenderBAddress, '0');
        await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '350'), lenderCAddress, '0');

        await checkBal(ampl, lenderAAddress, '70000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '99650');
        await checkBal(aAMPL, lenderAAddress, '30000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '350');
        await checkBal(ampl, reserveData.aTokenAddress, '35350');
        await checkSupply(aAMPL, '35350');

        await pool.connect(lenderC.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderCAddress);
        await pool.connect(lenderB.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderBAddress);
        await pool.connect(lenderA.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderAAddress);

        await checkBal(ampl, lenderAAddress, '100000');
        await checkBal(ampl, lenderBAddress, '100000');
        await checkBal(ampl, lenderCAddress, '100000');
        await checkBal(aAMPL, lenderAAddress, '0');
        await checkBal(aAMPL, lenderBAddress, '0');
        await checkBal(aAMPL, lenderCAddress, '0');
        await checkBal(ampl, reserveData.aTokenAddress, '0');
        await checkSupply(aAMPL, '0');
      });
    });

    describe("v large withdraw", function() {
      it('should burn correct number of aAMPL tokens', async () => {
        const {deployer, pool, ampl, aAMPL} = testEnv;

        await ampl.connect(deployer.signer).transfer(lenderAAddress, await fxtPt(ampl, '100000'));
        await rebase(pool, ampl, 9999999)
        await checkSupply(ampl, '500000000000000'); // 500T

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '1000000000000')); // 1T
        await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '500000000000')); // 0.5T
        await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '500000000000')); // 0.5T
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '1000000000000'), lenderAAddress, '0');
        await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '500000000000'), lenderBAddress, '0');
        await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '500000000000'), lenderCAddress, '0');

        await checkBal(ampl, lenderAAddress, '1000000000000');
        await checkBal(ampl, lenderBAddress, '500000000000');
        await checkBal(ampl, lenderCAddress, '500000000000');
        await checkBal(aAMPL, lenderAAddress, '1000000000000');
        await checkBal(ampl, reserveData.aTokenAddress, '2000000000000');
        await checkSupply(aAMPL, '2000000000000');

        await pool.connect(lenderA.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderAAddress);

        await checkBal(ampl, lenderAAddress, '2000000000000');
        await checkBal(ampl, lenderBAddress, '500000000000');
        await checkBal(ampl, lenderCAddress, '500000000000');
        await checkBal(aAMPL, lenderAAddress, '0');
        await checkBal(ampl, reserveData.aTokenAddress, '1000000000000');
        await checkSupply(aAMPL, '1000000000000');
      });
    });

    describe("when borrow>0", function() {
      it('should burn correct number of aAMPL tokens', async () => {
        const {deployer, dai, pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '33000'));
        await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '5000'));
        await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '350'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '33000'), lenderAAddress, '0');
        await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '5000'), lenderBAddress, '0');
        await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '350'), lenderCAddress, '0');

        // borrower borrows 2500 AMPL
        await dai.connect(deployer.signer).mint(await fxtPt(dai, '20000'));
        await dai.transfer(borrowerAAddress, await fxtPt(dai, '20000'));
        await dai.connect(borrowerA.signer).approve(pool.address, await fxtPt(dai, '20000'));
        await pool.connect(borrowerA.signer).deposit(dai.address, await fxtPt(dai, '20000'), borrowerAAddress, '0');
        await pool.connect(borrowerA.signer).borrow(
          ampl.address, await fxtPt(ampl, '2500'), RateMode.Variable, '0', borrowerAAddress);

        await checkBal(ampl, lenderAAddress, '67000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '99650');
        await checkBal(aAMPL, lenderAAddress, '33000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '350');
        await checkBal(ampl, reserveData.aTokenAddress, '35850');
        await checkSupply(aAMPL, '38350');

        await pool.connect(lenderC.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderCAddress);

        await checkBal(ampl, lenderAAddress, '67000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '100000');
        await checkBal(aAMPL, lenderAAddress, '33000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '0');
        await checkBal(ampl, reserveData.aTokenAddress, '35500');
        await checkSupply(aAMPL, '38000');
      });

      it('should update balances on positive rebase', async () => {
        const {deployer, dai, pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '33000'));
        await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '5000'));
        await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '350'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '33000'), lenderAAddress, '0');
        await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '5000'), lenderBAddress, '0');
        await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '350'), lenderCAddress, '0');

        // borrower borrows 2500 AMPL
        await dai.connect(deployer.signer).mint(await fxtPt(dai, '20000'));
        await dai.transfer(borrowerAAddress, await fxtPt(dai, '20000'));
        await dai.connect(borrowerA.signer).approve(pool.address, await fxtPt(dai, '20000'));
        await pool.connect(borrowerA.signer).deposit(dai.address, await fxtPt(dai, '20000'), borrowerAAddress, '0');
        await pool.connect(borrowerA.signer).borrow(
          ampl.address, await fxtPt(ampl, '2500'), RateMode.Variable, '0', borrowerAAddress);

        await checkBal(ampl, lenderAAddress, '67000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '99650');
        await checkBal(aAMPL, lenderAAddress, '33000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '350');
        await checkBal(ampl, reserveData.aTokenAddress, '35850');
        await checkSupply(aAMPL, '38350');

        await rebase(pool, ampl, +0.1);
        await pool.connect(lenderC.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderCAddress);

        await checkBal(ampl, lenderAAddress, '73700');
        await checkBal(ampl, lenderBAddress, '104500');
        await checkBal(ampl, lenderCAddress, '109997.71');
        await checkBal(aAMPL, lenderAAddress, '36084.87');
        await checkBal(aAMPL, lenderBAddress, '5467.40');
        await checkBal(aAMPL, lenderCAddress, '0');
        await checkBal(ampl, reserveData.aTokenAddress, '39052.28');
        await checkSupply(aAMPL, '41552.28');
      });

      it('should update balances on negative rebase', async () => {
        const {deployer, dai, pool, ampl, aAMPL} = testEnv;

        await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '33000'));
        await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '5000'));
        await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '350'));
        await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '33000'), lenderAAddress, '0');
        await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '5000'), lenderBAddress, '0');
        await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '350'), lenderCAddress, '0');

        // borrower borrows 2500 AMPL
        await dai.connect(deployer.signer).mint(await fxtPt(dai, '20000'));
        await dai.transfer(borrowerAAddress, await fxtPt(dai, '20000'));
        await dai.connect(borrowerA.signer).approve(pool.address, await fxtPt(dai, '20000'));
        await pool.connect(borrowerA.signer).deposit(dai.address, await fxtPt(dai, '20000'), borrowerAAddress, '0');
        await pool.connect(borrowerA.signer).borrow(
          ampl.address, await fxtPt(ampl, '2500'), RateMode.Variable, '0', borrowerAAddress);

        await checkBal(ampl, lenderAAddress, '67000');
        await checkBal(ampl, lenderBAddress, '95000');
        await checkBal(ampl, lenderCAddress, '99650');
        await checkBal(aAMPL, lenderAAddress, '33000');
        await checkBal(aAMPL, lenderBAddress, '5000');
        await checkBal(aAMPL, lenderCAddress, '350');
        await checkBal(ampl, reserveData.aTokenAddress, '35850');
        await checkSupply(aAMPL, '38350');

        await rebase(pool, ampl, -0.1);
        await pool.connect(lenderC.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderCAddress);

        await checkBal(ampl, lenderAAddress, '60300');
        await checkBal(ampl, lenderBAddress, '85500');
        await checkBal(ampl, lenderCAddress, '90002.28');
        await checkBal(aAMPL, lenderAAddress, '29915.12');
        await checkBal(aAMPL, lenderBAddress, '4532.59');
        await checkBal(aAMPL, lenderCAddress, '0');
        await checkBal(ampl, reserveData.aTokenAddress, '31947.72');
        await checkSupply(aAMPL, '34447.72');
      });
    });
  });

  describe("user borrow repay with interest", function(){
    it('should update accounting', async () => {
      const {pool, dai, ampl, aAMPL, aDai, helpersContract} = testEnv;

      // lender deposits AMPL
      await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '10000'));
      await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '10000'), lenderAAddress, '0');

      // borrower deposits DAI
      await dai.mint(await fxtPt(dai, '20000'));
      await dai.transfer(borrowerAAddress, await fxtPt(dai, '20000'));
      await dai.connect(borrowerA.signer).approve(pool.address, await fxtPt(dai, '20000'));
      await pool.connect(borrowerA.signer).deposit(dai.address, await fxtPt(dai, '20000'), borrowerAAddress, '0');

      await checkBal(ampl, lenderAAddress, '90000');
      await checkBal(aAMPL, lenderAAddress, '10000');
      await checkSupply(aAMPL, '10000');
      await checkBal(ampl, reserveData.aTokenAddress, '10000');
      await checkBal(ampl, borrowerAAddress, '0');
      await checkBal(debtToken, borrowerAAddress, '0');

      // borrower borrows AMPL
      await pool.connect(borrowerA.signer).borrow(
        ampl.address, await fxtPt(ampl, '2500'), RateMode.Variable, '0', borrowerAAddress);

      await checkBal(ampl, lenderAAddress, '90000');
      await checkBal(aAMPL, lenderAAddress, '10000');
      await checkSupply(aAMPL, '10000');
      await checkBal(ampl, reserveData.aTokenAddress, '7500');
      await checkBal(ampl, borrowerAAddress, '2500');
      await checkBal(debtToken, borrowerAAddress, '2500');

      await advanceTimeAndBlock(10*3600*24*365); // 10 years

      await checkBal(ampl, lenderAAddress, '90000');
      await checkScaledBal(aAMPL, lenderAAddress, '10000');         // P = 7500 + 2500
      await checkBal(aAMPL, lenderAAddress, '10250.0');             // T = P + 250 (I)
      await checkSupply(aAMPL, '10250.0');
      await checkBal(ampl, reserveData.aTokenAddress, '7500');      // unborrowed pool balance
      await checkBal(ampl, borrowerAAddress, '2500');               // borrower AMPL balance
      await checkBal(debtToken, borrowerAAddress, '2793.20');       // 2500 (principal) + 250 (interest owed to pool) + 43.20 (interest owed to treasury)
      await checkBal(aAMPL, treasuryAddress, '0');

      // borrower gets some AMPL to close out debt
      await ampl.connect(lenderC.signer).transfer(borrowerAAddress, await fxtPt(ampl, '300'));
      await checkBal(ampl, borrowerAAddress, '2800', 1);

      // borrower repays 2500 + 250 + 43.2 AMPL
      await ampl.connect(borrowerA.signer).approve(pool.address, MAX_UINT_AMOUNT);
      await pool.connect(borrowerA.signer).repay(
        ampl.address, MAX_UINT_AMOUNT, RateMode.Variable, borrowerAAddress);

      await checkBal(ampl, lenderAAddress, '90000');
      await checkBal(aAMPL, lenderAAddress, '10250.0');            // 7500 (unborrowed) + 2500 (borrowed) + 250 (interest paid)
      await checkSupply(aAMPL, '10279.32');                        // NOTE: mismatch here!
      await checkBal(ampl, reserveData.aTokenAddress, '10293.20'); // 10250 + 43.2
      await checkBal(ampl, borrowerAAddress, '6.80');
      await checkBal(debtToken, borrowerAAddress, '0');
      await checkBal(aAMPL, treasuryAddress, '29.32');

      await pool.connect(lenderA.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderAAddress);

      await checkBal(ampl, lenderAAddress, '100250.0');
      await checkBal(aAMPL, lenderAAddress, '0');
      await checkSupply(aAMPL, '29.32');
      await checkBal(ampl, reserveData.aTokenAddress, '43.2');
      await checkBal(aAMPL, treasuryAddress, '29.32');
      // treasury minted 29.32 aAMPL but 43.2 AMPL in the pool
      // However, this is  consistent with borrowing usdc with dai
    });
  });

  describe("user borrow repay with positive rebase", function(){
    it('should update accounting', async () => {
      const {pool, dai, ampl, aAMPL, aDai, helpersContract} = testEnv;

      // lender deposits AMPL
      await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '10000'));
      await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '10000'), lenderAAddress, '0');

      // borrower deposits DAI
      await dai.mint(await fxtPt(dai, '20000'));
      await dai.transfer(borrowerAAddress, await fxtPt(dai, '20000'));
      await dai.connect(borrowerA.signer).approve(pool.address, await fxtPt(dai, '20000'));
      await pool.connect(borrowerA.signer).deposit(dai.address, await fxtPt(dai, '20000'), borrowerAAddress, '0');

      // borrower borrows AMPL
      await pool.connect(borrowerA.signer).borrow(
        ampl.address, await fxtPt(ampl, '2500'), RateMode.Variable, '0', borrowerAAddress);

      await advanceTimeAndBlock(10*3600*24*365); // 10 years

      await rebase(pool, ampl, +0.25) // 25% rebase

      await checkBal(ampl, lenderAAddress, '112500');
      await checkScaledBal(aAMPL, lenderAAddress, '11875.00');    // P = (7500*1.25) + 2500
      await checkBal(aAMPL, lenderAAddress, '12085.52');          // T = P + 210.52 (I)
      await checkSupply(aAMPL, '12085.52');
      await checkBal(ampl, reserveData.aTokenAddress, '9375');    // unborrowed principal balance (7500*1.25)
      await checkBal(ampl, borrowerAAddress, '3125.00');          // Borrowed AMPL balance
      await checkBal(debtToken, borrowerAAddress, '2744.86');     // 2500 (principal) + 244.86 (I)
      await checkBal(aAMPL, treasuryAddress, '0');                // Treasury

      // borrower repays 2500 + 244.86 AMPL
      await ampl.connect(borrowerA.signer).approve(pool.address, MAX_UINT_AMOUNT);
      await pool.connect(borrowerA.signer).repay(
        ampl.address, MAX_UINT_AMOUNT, RateMode.Variable, borrowerAAddress);

      await checkBal(ampl, lenderAAddress, '112500');
      await checkBal(aAMPL, lenderAAddress, '12085.52');
      await checkSupply(aAMPL, '12110.01');
      await checkBal(ampl, reserveData.aTokenAddress, '12119.86');
      await checkBal(ampl, borrowerAAddress, '380.14');
      await checkBal(debtToken, borrowerAAddress, '0');
      await checkBal(aAMPL, treasuryAddress, '24.48');

      await pool.connect(lenderA.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderAAddress);

      await checkBal(ampl, lenderAAddress, '124585.52');
      await checkBal(aAMPL, lenderAAddress, '0');
      await checkSupply(aAMPL, '24.48');
      await checkBal(ampl, reserveData.aTokenAddress, '34.34');
      await checkBal(aAMPL, treasuryAddress, '24.48');
    });
  });

  describe("user borrow repay with negative rebase", function(){
    it('should update accounting', async () => {
      const {pool, dai, ampl, aAMPL, aDai, helpersContract} = testEnv;

      // lender deposits AMPL
      await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '10000'));
      await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '10000'), lenderAAddress, '0');

      // borrower deposits DAI
      await dai.mint(await fxtPt(dai, '20000'));
      await dai.transfer(borrowerAAddress, await fxtPt(dai, '20000'));
      await dai.connect(borrowerA.signer).approve(pool.address, await fxtPt(dai, '20000'));
      await pool.connect(borrowerA.signer).deposit(dai.address, await fxtPt(dai, '20000'), borrowerAAddress, '0');

      // borrower borrows AMPL
      await pool.connect(borrowerA.signer).borrow(
        ampl.address, await fxtPt(ampl, '2500'), RateMode.Variable, '0', borrowerAAddress);

      await advanceTimeAndBlock(10*3600*24*365); // 10 years
      await rebase(pool, ampl, -0.25) // -25% rebase

      await checkBal(ampl, lenderAAddress, '67500.00');
      await checkScaledBal(aAMPL, lenderAAddress, '8125.00');     // P = (7500*0.75) + 2500
      await checkBal(aAMPL, lenderAAddress, '8432.69');           // T = P + 210.52 (I)
      await checkSupply(aAMPL, '8432.69');
      await checkBal(ampl, reserveData.aTokenAddress, '5625.00'); // unborrowed principal balance (7500*0.75)
      await checkBal(ampl, borrowerAAddress, '1875.00');          // Borrowed AMPL balance
      await checkBal(debtToken, borrowerAAddress, '2865.25');     // 2500 (principal) + 365.25 (I)
      await checkBal(aAMPL, treasuryAddress, '0');                // Treasury

      // friend sends borrower some ampl to pay back interest
      await ampl.connect(lenderC.signer).transfer(borrowerAAddress, await fxtPt(ampl, '1000'));

      // borrower repays 2500 + 365.25 AMPL
      await ampl.connect(borrowerA.signer).approve(pool.address, MAX_UINT_AMOUNT);
      await pool.connect(borrowerA.signer).repay(
        ampl.address, MAX_UINT_AMOUNT, RateMode.Variable, borrowerAAddress);

      await checkBal(ampl, lenderAAddress, '67500.00');
      await checkScaledBal(aAMPL, lenderAAddress, '8125.00');
      await checkBal(aAMPL, lenderAAddress, '8432.69');
      await checkSupply(aAMPL, '8469.21');
      await checkBal(ampl, reserveData.aTokenAddress, '8490.25');
      await checkBal(ampl, borrowerAAddress, '9.74');               // 1875.00 + 1000 - 2865.25
      await checkBal(debtToken, borrowerAAddress, '0');
      await checkBal(aAMPL, treasuryAddress, '36.52');

      await pool.connect(lenderA.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderAAddress);

      await checkBal(ampl, lenderAAddress, '75932.69');
      await checkScaledBal(aAMPL, lenderAAddress, '0');
      await checkBal(aAMPL, lenderAAddress, '0');
      await checkSupply(aAMPL, '36.52');
      await checkBal(ampl, reserveData.aTokenAddress, '57.56');
      await checkBal(ampl, borrowerAAddress, '9.74');
      await checkBal(debtToken, borrowerAAddress, '0');
      await checkBal(aAMPL, treasuryAddress, '36.52');
    });
  });

  describe("multi user borrow repay", function(){
    it('should update accounting', async () => {
      const {pool, dai, ampl, aAMPL, aDai, helpersContract} = testEnv;

      // lender deposits AMPL
      await ampl.connect(lenderA.signer).approve(pool.address, await fxtPt(ampl, '10000'));
      await pool.connect(lenderA.signer).deposit(ampl.address, await fxtPt(ampl, '10000'), lenderAAddress, '0');

      await ampl.connect(lenderB.signer).approve(pool.address, await fxtPt(ampl, '5000'));
      await pool.connect(lenderB.signer).deposit(ampl.address, await fxtPt(ampl, '5000'), lenderBAddress, '0');

      await ampl.connect(lenderC.signer).approve(pool.address, await fxtPt(ampl, '2500'));
      await pool.connect(lenderC.signer).deposit(ampl.address, await fxtPt(ampl, '2500'), lenderCAddress, '0');

      // borrowers deposits DAI and borrow AMPL
      await dai.mint(await fxtPt(dai, '1000000'));
      await dai.transfer(borrowerAAddress, await fxtPt(dai, '30000'));
      await dai.transfer(borrowerBAddress, await fxtPt(dai, '50000'));
      await dai.connect(borrowerA.signer).approve(pool.address, await fxtPt(dai, '30000'));
      await dai.connect(borrowerB.signer).approve(pool.address, await fxtPt(dai, '50000'));

      await pool.connect(borrowerA.signer).deposit(dai.address, await fxtPt(dai, '20000'), borrowerAAddress, '0');
      await pool.connect(borrowerB.signer).deposit(dai.address, await fxtPt(dai, '40000'), borrowerBAddress, '0');

      await pool.connect(borrowerA.signer).borrow(
        ampl.address, await fxtPt(ampl, '2500'), RateMode.Variable, '0', borrowerAAddress);
      await pool.connect(borrowerB.signer).borrow(
        ampl.address, await fxtPt(ampl, '5000'), RateMode.Variable, '0', borrowerBAddress);

      // time passes and supply changes
      await advanceTimeAndBlock(10*3600*24*365); // 10 years
      await rebase(pool, ampl, 0.50) // +50% rebase

      // borrower A repays
      await ampl.connect(borrowerA.signer).approve(pool.address, MAX_UINT_AMOUNT);
      await pool.connect(borrowerA.signer).repay(
        ampl.address, MAX_UINT_AMOUNT, RateMode.Variable, borrowerAAddress);


      // time passes and supply changes
      await advanceTimeAndBlock(10*3600*24*365); // 10 years
      await rebase(pool, ampl, -0.05) // -5% rebase
      // lenders pull out
      await pool.connect(lenderC.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderAAddress);
      // borrower B repays
      await ampl.connect(borrowerB.signer).approve(pool.address, MAX_UINT_AMOUNT);
      await pool.connect(borrowerB.signer).repay(
        ampl.address, MAX_UINT_AMOUNT, RateMode.Variable, borrowerBAddress);

      // time passes and supply changes
      await advanceTimeAndBlock(10*3600*24*365); // 10 years
      await rebase(pool, ampl, -0.1) // -10% rebase


      // lenders pull out
      await pool.connect(lenderA.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderAAddress);
      await pool.connect(lenderB.signer).withdraw(ampl.address, MAX_UINT_AMOUNT, lenderAAddress);

      await checkBal(aAMPL, lenderAAddress, '0');
      await checkBal(aAMPL, lenderBAddress, '0');
      await checkBal(aAMPL, lenderCAddress, '0');
      await checkBal(debtToken, borrowerAAddress, '0');
      await checkBal(debtToken, borrowerBAddress, '0');

      await checkSupply(aAMPL, '168.15');
      await checkBal(ampl, reserveData.aTokenAddress, '289.55');
      await checkBal(aAMPL, treasuryAddress, '168.15');
    });
  });
});

