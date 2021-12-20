import BigNumber from 'bignumber.js';

import './__setup.spec';
import { TestEnv, makeSuite, SignerWithAddress } from './helpers/make-suite';
import { convertToCurrencyDecimals } from '../helpers/contracts-helpers';
import { ethers } from 'ethers';
import { ProtocolErrors, RateMode } from '../helpers/types';
import { AStETH } from '../types/AStETH';
import { getAStETH } from '../helpers/contracts-getters';
import { evmSnapshot, evmRevert, advanceTimeAndBlock } from '../helpers/misc-utils';
import { LendingPool, StETHMocked } from '../types';
import { strategyStETH } from '../markets/aave/reservesConfigs';
import { expect } from 'chai';
import { _TypedDataEncoder } from 'ethers/lib/utils';
import { MAX_UINT_AMOUNT } from '../helpers/constants';

const { parseEther } = ethers.utils;

let lenderA,
  lenderB,
  lenderC,
  lenderAAddress,
  lenderBAddress,
  lenderCAddress,
  evmSnapshotId,
  reserveData,
  astETH: AStETH;

async function rebase(steth, perc) {
  const currentSupply = new BigNumber((await steth.totalSupply()).toString());
  const supplyDelta = currentSupply.multipliedBy(perc);
  await steth.rebase(supplyDelta.toString(10));
}

function fxtPt(t, amt) {
  return convertToCurrencyDecimals(t.address, amt);
}

async function check(amt, cmpAmt, token, tolarance) {
  const t = new BigNumber(tolarance).multipliedBy(10 ** (await token.decimals())).toString(10);
  expect(amt).to.be.bignumber.gte(cmpAmt.sub(t)).lte(cmpAmt.add(t));
}

async function checkGt(amt, cmpAmt) {
  expect(amt).to.be.bignumber.gt(cmpAmt);
}

async function assertBalance(token, account, expectedAmount, precision = 0.01) {
  const decimals = await token.decimals();
  const fixedAmount = expectedAmount.toFixed(6);
  const parsedAmount = await fxtPt(token, fixedAmount);
  const convertedPrecision = new BigNumber(precision).multipliedBy(10 ** decimals).toString(10);
  const accountBalance = await token.balanceOf(account.address);
  expect(accountBalance)
    .to.be.bignumber.gte(parsedAmount.sub(convertedPrecision))
    .lte(parsedAmount.add(convertedPrecision));
}

async function assertTotalSupply(token, expectedAmount, precision = 0.01) {
  const decimals = await token.decimals();
  const fixedAmount = expectedAmount.toFixed(6);
  const parsedAmount = await fxtPt(token, fixedAmount);
  const convertedPrecision = new BigNumber(precision).multipliedBy(10 ** decimals).toString(10);
  const totalSupply = await token.totalSupply();
  expect(totalSupply)
    .to.be.bignumber.gte(parsedAmount.sub(convertedPrecision))
    .lte(parsedAmount.add(convertedPrecision));
}

// tolarance 1 StETH cent ~= 0.01 StETH
async function checkBal(token, addr, amt, tolarance = 0.01) {
  return check(await token.balanceOf(addr), await fxtPt(token, amt), token, tolarance);
}

async function checkBalGt(token, addr, amt) {
  const balanceOf = await token.balanceOf(addr);
  const targetAmt = await fxtPt(token, amt);
  return checkGt(balanceOf, targetAmt);
}

async function checkScaledBal(token, addr, amt, tolarance = 0.01) {
  return check(await token.scaledBalanceOf(addr), await fxtPt(token, amt), token, tolarance);
}

async function checkSupply(token, amt, tolarance = 0.01) {
  return check(await token.totalSupply(), await fxtPt(token, amt), token, tolarance);
}

async function checkSupplyGt(token, amt) {
  const totalSupply = await token.totalSupply();
  const targetAmt = await fxtPt(token, amt);
  return checkGt(totalSupply, targetAmt);
}

function format(value: ethers.BigNumber, decimals: number = 1e18): string {
  return new BigNumber(value.toString()).div(decimals).toFixed(18);
}

function getReserveFactor(): number {
  return Number(strategyStETH.reserveFactor);
}

interface Upprovable {
  approve(
    _to: string,
    amount: ethers.BigNumberish,
    overrides?: ethers.Overrides
  ): Promise<ethers.ContractTransaction>;
}

interface DepositableAsset<T> {
  address: string;
  connect(signerOrProvider: string | ethers.Signer | ethers.providers.Provider): T;
}

async function deposit<T extends Upprovable>(
  lendingPool: LendingPool,
  underlyingAsset: DepositableAsset<T>,
  depositor: SignerWithAddress,
  amount: number
) {
  const amountParsed = await fxtPt(underlyingAsset, amount.toFixed(6));
  await underlyingAsset.connect(depositor.signer).approve(lendingPool.address, amountParsed);
  await lendingPool
    .connect(depositor.signer)
    .deposit(underlyingAsset.address, amountParsed, depositor.address, '0');
}

async function borrow<T extends Upprovable>(
  lendingPool: LendingPool,
  underlyingAsset: DepositableAsset<T>,
  borrower: SignerWithAddress,
  amount: number
) {
  await lendingPool
    .connect(borrower.signer)
    .borrow(
      underlyingAsset.address,
      await fxtPt(underlyingAsset, amount.toFixed(6)),
      RateMode.Variable,
      '0',
      borrower.address
    );
}

async function assertDeposits(
  stETH: StETHMocked,
  astETH: AStETH,
  initialBalances: number[],
  depositors: SignerWithAddress[],
  expectedAmounts: number[]
) {
  const totalDepositsAmount = expectedAmounts.reduce(
    (sum, depositAmount) => sum + depositAmount,
    0
  );
  await assertTotalSupply(astETH, totalDepositsAmount);
  await assertBalance(stETH, astETH, totalDepositsAmount);
  console.log(initialBalances, expectedAmounts);
  for (let i = 0; i < initialBalances.length; ++i) {
    const depositor = depositors[i];
    console.log(initialBalances[i], expectedAmounts[i], initialBalances[i] - expectedAmounts[i]);
    // await assertBalance(stETH, depositor, initialBalances[i] - expectedAmounts[i]);
    await assertBalance(astETH, depositor, expectedAmounts[i]);
  }
}

makeSuite('StETH aToken', (testEnv: TestEnv) => {
  beforeEach(async () => {
    evmSnapshotId = await evmSnapshot();

    const { users, stETH, deployer, pool } = testEnv;
    lenderA = users[1];
    lenderB = users[2];
    lenderC = users[3];

    lenderAAddress = lenderA.address;
    lenderBAddress = lenderB.address;
    lenderCAddress = lenderC.address;

    reserveData = await pool.getReserveData(stETH.address);
    astETH = await getAStETH(reserveData.aTokenAddress);

    await stETH.connect(deployer.signer).mint(deployer.address, await fxtPt(stETH, '10000000000'));
    await stETH.connect(deployer.signer).transfer(lenderAAddress, await fxtPt(stETH, '100000'));
    await stETH.connect(deployer.signer).transfer(lenderBAddress, await fxtPt(stETH, '100000'));
    await stETH.connect(deployer.signer).transfer(lenderCAddress, await fxtPt(stETH, '100000'));
  });

  afterEach(async () => {
    await evmRevert(evmSnapshotId);
  });

  describe('Transfer', () => {
    const {
      INVALID_FROM_BALANCE_AFTER_TRANSFER,
      INVALID_TO_BALANCE_AFTER_TRANSFER,
    } = ProtocolErrors;

    it('lender A deposits 1 stETH, transfers to lender B', async () => {
      const { pool, stETH } = testEnv;
      await pool
        .connect(lenderA.signer)
        .deposit(stETH.address, ethers.utils.parseEther('1.0'), lenderAAddress, '0');

      await astETH.connect(lenderA.signer).transfer(lenderBAddress, ethers.utils.parseEther('1.0'));

      const fromBalance = await astETH.balanceOf(lenderAAddress);
      const toBalance = await astETH.balanceOf(lenderBAddress);

      expect(fromBalance.toString()).to.be.equal('0', INVALID_FROM_BALANCE_AFTER_TRANSFER);
      expect(toBalance.toString()).to.be.equal(
        (10 ** 18).toString(),
        INVALID_TO_BALANCE_AFTER_TRANSFER
      );
    });
    it('lender A deposits 1 stETH, positive rebase, lender A transfers to lender B 1 stETH', async () => {
      const { pool, stETH } = testEnv;
      await pool
        .connect(lenderA.signer)
        .deposit(stETH.address, ethers.utils.parseEther('1.0'), lenderAAddress, '0');

      await rebase(stETH, 1);

      await astETH.connect(lenderA.signer).transfer(lenderBAddress, ethers.utils.parseEther('1.0'));

      const fromBalance = await astETH.balanceOf(lenderAAddress);
      const toBalance = await astETH.balanceOf(lenderBAddress);

      expect(fromBalance.toString()).to.be.equal(
        (10 ** 18).toString(),
        INVALID_FROM_BALANCE_AFTER_TRANSFER
      );
      expect(toBalance.toString()).to.be.equal(
        (10 ** 18).toString(),
        INVALID_TO_BALANCE_AFTER_TRANSFER
      );
    });
    it('lender A deposits 1 stETH, negative rebase, lender A transfers to lender B 0.5 stETH', async () => {
      const { users, pool, stETH } = testEnv;
      await pool
        .connect(lenderA.signer)
        .deposit(stETH.address, ethers.utils.parseEther('1.0'), lenderAAddress, '0');

      await rebase(stETH, -0.5);

      await astETH.connect(lenderA.signer).transfer(lenderBAddress, ethers.utils.parseEther('0.5'));

      const fromBalance = await astETH.balanceOf(lenderAAddress);
      const toBalance = await astETH.balanceOf(lenderBAddress);

      expect(fromBalance.toString()).to.be.equal('0', INVALID_FROM_BALANCE_AFTER_TRANSFER);
      expect(toBalance.toString()).to.be.equal(
        (0.5 * 10 ** 18).toString(),
        INVALID_TO_BALANCE_AFTER_TRANSFER
      );
    });
    describe('when lenderA deposits 1000 StETH, transfers more than he has', function () {
      it('should update balances correctly', async () => {
        const { pool, stETH } = testEnv;

        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '1000'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '1000'), lenderAAddress, '0');

        await expect(
          astETH.connect(lenderA.signer).transfer(lenderAAddress, await fxtPt(stETH, '1001'))
        ).to.be.revertedWith('transfer amount exceeds balance');
      });
    });
  });
  describe('Deposit', () => {
    describe('first deposit', function () {
      it('should mint correct number of astETH tokens', async () => {
        const { pool, stETH } = testEnv;

        await checkBal(stETH, lenderAAddress, '100000');
        await checkBal(astETH, lenderAAddress, '0');
        await checkBal(stETH, reserveData.aTokenAddress, '0');
        await checkSupply(astETH, '0');

        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '1000'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '1000'), lenderAAddress, '0');

        expect(await astETH.balanceOf(lenderAAddress)).to.eq(await fxtPt(stETH, '1000'));

        await checkBal(stETH, lenderAAddress, '99000');
        await checkBal(astETH, lenderAAddress, '1000');
        await checkBal(stETH, reserveData.aTokenAddress, '1000');
        await checkSupply(astETH, '1000');
      });

      it('should update balances after positive rebase', async () => {
        const { pool, stETH } = testEnv;

        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '1000'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '1000'), lenderAAddress, '0');

        await checkBal(stETH, lenderAAddress, '99000');
        await checkBal(astETH, lenderAAddress, '1000');
        await checkBal(stETH, reserveData.aTokenAddress, '1000');
        await checkSupply(astETH, '1000');

        await rebase(stETH, 0.1); // + 10%

        expect(await astETH.balanceOf(lenderAAddress)).to.eq(await fxtPt(stETH, '1100'));

        await checkBal(stETH, lenderAAddress, '108900');
        await checkBal(astETH, lenderAAddress, '1100');
        await checkBal(stETH, reserveData.aTokenAddress, '1100');
        await checkSupply(astETH, '1100');
      });

      it('should update balances after negative rebase', async () => {
        const { pool, stETH } = testEnv;

        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '1000'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '1000'), lenderAAddress, '0');

        await checkBal(stETH, lenderAAddress, '99000');
        await checkBal(astETH, lenderAAddress, '1000');
        await checkBal(stETH, reserveData.aTokenAddress, '1000');
        await checkSupply(astETH, '1000');

        await rebase(stETH, -0.1); // - 10%

        expect(await astETH.balanceOf(lenderAAddress)).to.eq(await fxtPt(stETH, '900'));

        await checkBal(stETH, lenderAAddress, '89100');
        await checkBal(astETH, lenderAAddress, '900');
        await checkBal(stETH, reserveData.aTokenAddress, '900');
        await checkSupply(astETH, '900');
      });

      it('should update balances after neutral rebase', async () => {
        const { pool, stETH } = testEnv;

        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '1000'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '1000'), lenderAAddress, '0');

        await checkBal(stETH, lenderAAddress, '99000');
        await checkBal(astETH, lenderAAddress, '1000');
        await checkBal(stETH, reserveData.aTokenAddress, '1000');
        await checkSupply(astETH, '1000');

        await rebase(stETH, 0);

        expect(await astETH.balanceOf(lenderAAddress)).to.eq(await fxtPt(stETH, '1000'));

        await checkBal(stETH, lenderAAddress, '99000');
        await checkBal(astETH, lenderAAddress, '1000');
        await checkBal(stETH, reserveData.aTokenAddress, '1000');
        await checkSupply(astETH, '1000');
      });
    });

    describe('several sequintial deposits', function () {
      it('should mint aTokens correctly', async () => {
        const { pool, stETH } = testEnv;

        // the first deposit for A
        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '7'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '7'), lenderA.address, '0');

        // the single deposit for B
        await stETH.connect(lenderB.signer).approve(pool.address, await fxtPt(stETH, '11'));
        await pool
          .connect(lenderB.signer)
          .deposit(stETH.address, await fxtPt(stETH, '11'), lenderB.address, '0');

        let balances = await astETH.getScaledUserBalanceAndSupply(lenderAAddress);

        let expectedAmount = await fxtPt(astETH, '7');
        expect(balances[0].toString()).to.be.equal(expectedAmount.toString());

        expectedAmount = await fxtPt(astETH, '18');
        expect(balances[1].toString()).to.be.equal(expectedAmount.toString());

        await advanceTimeAndBlock(3600 * 24 * 14); // 2 weeks

        // the second deposit for A
        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '3'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '3'), lenderA.address, '0');

        await checkBal(astETH, lenderA.address, '10');

        balances = await astETH.getScaledUserBalanceAndSupply(lenderAAddress);

        expectedAmount = await fxtPt(astETH, '10');
        expect(balances[0].toString()).to.be.equal(expectedAmount.toString());

        expectedAmount = await fxtPt(astETH, '21');
        expect(balances[1].toString()).to.be.equal(expectedAmount.toString());
      });
    });
    describe('user deposits 1000 StETH', function () {
      it('should update balances correctly', async () => {
        const { pool, stETH } = testEnv;

        await stETH.connect(lenderC.signer).approve(pool.address, await fxtPt(stETH, '1000'));
        await pool
          .connect(lenderC.signer)
          .deposit(stETH.address, await fxtPt(stETH, '1000'), lenderCAddress, '0');

        const beforeBalance = await astETH.balanceOf(lenderCAddress);
        await astETH
          .connect(lenderC.signer)
          .transfer(lenderCAddress, await astETH.balanceOf(lenderCAddress));
        const afterBalance = await astETH.balanceOf(lenderCAddress);

        expect(beforeBalance.toString()).to.be.equal(afterBalance.toString());
      });
    });
    describe('the single deposit after rebase', function () {
      it('should update balances correctly', async () => {
        const { pool, stETH } = testEnv;

        await rebase(stETH, 1.0);

        // the single deposit for lender A
        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '13'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '13'), lenderA.address, '0');

        await checkBal(astETH, lenderA.address, '13');
      });
    });

    describe('the first deposit after rebase for lender', function () {
      it('should update balances correctly', async () => {
        const { pool, stETH } = testEnv;

        await stETH.connect(lenderB.signer).approve(pool.address, await fxtPt(stETH, '97'));
        await pool
          .connect(lenderB.signer)
          .deposit(stETH.address, await fxtPt(stETH, '97'), lenderB.address, '0');

        await rebase(stETH, 1.0);

        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '13'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '13'), lenderA.address, '0');

        let balances = await astETH.getScaledUserBalanceAndSupply(lenderAAddress);

        let expectedAmount = await fxtPt(astETH, '13');
        expect(balances[0].toString()).to.be.equal(expectedAmount.toString());

        expectedAmount = await fxtPt(astETH, '207');
        expect(balances[1].toString()).to.be.equal(expectedAmount.toString());

        await checkBal(astETH, lenderA.address, '13');
      });
    });
    describe('the single deposit after rebase', function () {
      it('should update balances correctly', async () => {
        const { pool, stETH } = testEnv;

        await rebase(stETH, 1.0);

        // the single deposit for lender A
        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '13'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '13'), lenderA.address, '0');

        await checkBal(astETH, lenderA.address, '13');
      });
    });
  });
  describe('Withdraw', () => {
    describe('single deposit partial withdraw', function () {
      it('should burn correct number of astETH tokens', async () => {
        const { pool, stETH } = testEnv;

        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '1000'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '1000'), lenderAAddress, '0');

        await checkBal(stETH, lenderAAddress, '99000');
        await checkBal(astETH, lenderAAddress, '1000');
        await checkBal(stETH, reserveData.aTokenAddress, '1000');
        await checkSupply(astETH, '1000');

        await pool
          .connect(lenderA.signer)
          .withdraw(stETH.address, await fxtPt(stETH, '100'), lenderAAddress);

        await checkBal(stETH, lenderAAddress, '99100');
        await checkBal(astETH, lenderAAddress, '900');
        await checkBal(stETH, reserveData.aTokenAddress, '900');
        await checkSupply(astETH, '900');
      });
      it('should burn correct number of astETH tokens after rebase', async () => {
        const { pool, stETH } = testEnv;

        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '1000'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '1000'), lenderAAddress, '0');

        await checkBal(stETH, lenderAAddress, '99000');
        await checkBal(astETH, lenderAAddress, '1000');
        await checkBal(stETH, reserveData.aTokenAddress, '1000');
        await checkSupply(astETH, '1000');

        await rebase(stETH, 1);

        await checkBal(stETH, lenderAAddress, '198000');
        await checkBal(astETH, lenderAAddress, '2000');
        await checkBal(stETH, reserveData.aTokenAddress, '2000');
        await checkSupply(astETH, '2000');

        await pool
          .connect(lenderA.signer)
          .withdraw(stETH.address, await fxtPt(stETH, '100'), lenderAAddress);

        await checkBal(stETH, lenderAAddress, '198100');
        await checkBal(astETH, lenderAAddress, '1900');
        await checkBal(stETH, reserveData.aTokenAddress, '1900');
        await checkSupply(astETH, '1900');
      });
    });

    describe('single deposit full withdraw', function () {
      it('should burn correct number of astETH tokens', async () => {
        const { pool, stETH } = testEnv;

        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '1000'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '1000'), lenderAAddress, '0');

        await checkBal(stETH, lenderAAddress, '99000');
        await checkBal(astETH, lenderAAddress, '1000');
        await checkBal(stETH, reserveData.aTokenAddress, '1000');
        await checkSupply(astETH, '1000');

        await pool.connect(lenderA.signer).withdraw(stETH.address, MAX_UINT_AMOUNT, lenderAAddress);

        await checkBal(stETH, lenderAAddress, '100000');
        await checkBal(astETH, lenderAAddress, '0');
        await checkBal(stETH, reserveData.aTokenAddress, '0');
        await checkSupply(astETH, '0');
      });

      it('should burn correct number of astETH positive rebase', async () => {
        const { pool, stETH } = testEnv;

        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '1000'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '1000'), lenderAAddress, '0');

        await checkBal(stETH, lenderAAddress, '99000');
        await checkBal(astETH, lenderAAddress, '1000');
        await checkBal(stETH, reserveData.aTokenAddress, '1000');
        await checkSupply(astETH, '1000');

        await rebase(stETH, 0.1); // + 10%
        await pool.connect(lenderA.signer).withdraw(stETH.address, MAX_UINT_AMOUNT, lenderAAddress);

        await checkBal(stETH, lenderAAddress, '110000');
        await checkBal(astETH, lenderAAddress, '0');
        await checkBal(stETH, reserveData.aTokenAddress, '0');
        await checkSupply(astETH, '0');
      });

      it('should burn correct number of astETH negative rebase', async () => {
        const { pool, stETH } = testEnv;

        await stETH.connect(lenderA.signer).approve(pool.address, await fxtPt(stETH, '1000'));
        await pool
          .connect(lenderA.signer)
          .deposit(stETH.address, await fxtPt(stETH, '1000'), lenderAAddress, '0');

        await checkBal(stETH, lenderAAddress, '99000');
        await checkBal(astETH, lenderAAddress, '1000');
        await checkBal(stETH, reserveData.aTokenAddress, '1000');
        await checkSupply(astETH, '1000');

        await rebase(stETH, -0.1); // - 10%
        await pool.connect(lenderA.signer).withdraw(stETH.address, MAX_UINT_AMOUNT, lenderAAddress);

        await checkBal(stETH, lenderAAddress, '90000');
        await checkBal(astETH, lenderAAddress, '0');
        await checkBal(stETH, reserveData.aTokenAddress, '0');
        await checkSupply(astETH, '0');
      });
    });
  });
  describe('Precision', () => {
    it('rebase index precision with big steth amount', async () => {
      const { pool, stETH, deployer } = testEnv;
      const depositAmount = '99999999';
      const stakedShares = await stETH.getSharesByPooledEth(depositAmount);
      await stETH.connect(deployer.signer).approve(pool.address, await fxtPt(stETH, depositAmount));
      await pool
        .connect(deployer.signer)
        .deposit(stETH.address, await fxtPt(stETH, depositAmount), deployer.address, '0');

      await checkBal(astETH, deployer.address, depositAmount, 0.000001);
      await stETH.connect(deployer.signer).rebase(7);
      await checkBal(
        astETH,
        deployer.address,
        (await stETH.getPooledEthByShares(stakedShares)).toString()
      );
    });
  });

  describe('Happy path', () => {
    it('lender A deposits 100 stETH', async () => {
      const { pool, stETH, deployer } = testEnv;

      await deposit(pool, stETH, lenderA, 100);

      await checkBal(astETH, lenderAAddress, '100');
      await checkBal(astETH, lenderBAddress, '0');

      await advanceTimeAndBlock(3600 * 24 * 30); // 1 month

      await checkBal(astETH, lenderAAddress, '100');
      await checkBal(astETH, lenderBAddress, '0');

      await deposit(pool, stETH, lenderB, 50);

      await checkBal(astETH, lenderAAddress, '100');
      await checkBal(astETH, lenderBAddress, '50');

      await rebase(stETH, 0.01);

      await checkBal(astETH, lenderAAddress, '101');
      await checkBal(astETH, lenderBAddress, '50.5');

      await advanceTimeAndBlock(3600 * 24 * 30); // 1 month

      await checkBal(astETH, lenderAAddress, '101');
      await checkBal(astETH, lenderBAddress, '50.5');

      await deposit(pool, stETH, lenderC, 50);

      await checkBal(astETH, lenderAAddress, '101');
      await checkBal(astETH, lenderBAddress, '50.5');
      await checkBal(astETH, lenderCAddress, '50');

      await advanceTimeAndBlock(3600 * 24 * 30); // 1 month

      await checkBal(astETH, lenderAAddress, '101');
      await checkBal(astETH, lenderBAddress, '50.5');
      await checkBal(astETH, lenderCAddress, '50');

      await rebase(stETH, -0.05);

      await checkBal(astETH, lenderAAddress, '95.95');
      await checkBal(astETH, lenderBAddress, '47.975');
      await checkBal(astETH, lenderCAddress, '47.5');

      await astETH.connect(lenderA.signer).transfer(lenderCAddress, await fxtPt(stETH, '50'));

      await checkBal(astETH, lenderAAddress, '45.95');
      await checkBal(astETH, lenderBAddress, '47.975');
      await checkBal(astETH, lenderCAddress, '97.5');

      await pool
        .connect(lenderA.signer)
        .withdraw(stETH.address, await fxtPt(stETH, '30'), lenderAAddress);

      await checkBal(astETH, lenderAAddress, '15.95');
      await checkBal(astETH, lenderBAddress, '47.975');
      await checkBal(astETH, lenderCAddress, '97.5');

      await advanceTimeAndBlock(3600 * 24 * 30); // 1 month

      await checkBal(astETH, lenderAAddress, '15.95');
      await checkBal(astETH, lenderBAddress, '47.975');
      await checkBal(astETH, lenderCAddress, '97.5');

      await pool
        .connect(lenderA.signer)
        .withdraw(stETH.address, await fxtPt(stETH, '15.95'), lenderAAddress);

      await checkBal(astETH, lenderAAddress, '0');
      await checkBal(astETH, lenderBAddress, '47.975');
      await checkBal(astETH, lenderCAddress, '97.5');

      await rebase(stETH, 0.07);

      await checkBal(astETH, lenderAAddress, '0');
      await checkBal(astETH, lenderBAddress, '51.33325');
      await checkBal(astETH, lenderCAddress, '104.325');

      await pool
        .connect(lenderB.signer)
        .withdraw(stETH.address, await fxtPt(stETH, '51.33325'), lenderBAddress);

      await checkBal(astETH, lenderAAddress, '0');
      await checkBal(astETH, lenderBAddress, '0');
      await checkBal(astETH, lenderCAddress, '104.325');

      await pool
        .connect(lenderC.signer)
        .withdraw(stETH.address, await fxtPt(stETH, '104.325'), lenderCAddress);

      await checkBal(astETH, lenderAAddress, '0');
      await checkBal(astETH, lenderBAddress, '0');
      await checkBal(astETH, lenderCAddress, '0');
    });
  });
  describe('Borrow', () => {
    it('disabled variable borrowing', async () => {
      const { dai, stETH, users, pool, oracle } = testEnv;
      const depositor = users[0];

      await dai
        .connect(depositor.signer)
        .mint(await convertToCurrencyDecimals(dai.address, '1000000'));
      await dai.connect(depositor.signer).approve(pool.address, await fxtPt(stETH, '1000000'));
      const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000000');
      await pool
        .connect(depositor.signer)
        .deposit(dai.address, amountDAItoDeposit, depositor.address, '0');

      await deposit(pool, stETH, lenderA, 100);

      await expect(
        pool
          .connect(depositor.signer)
          .borrow(stETH.address, 1, RateMode.Variable, '0', depositor.address)
      ).to.be.revertedWith('CONTRACT_NOT_ACTIVE');
    });
    it('disabled stable borrowing', async () => {
      const { dai, stETH, users, pool, oracle } = testEnv;
      const depositor = users[0];

      await dai
        .connect(depositor.signer)
        .mint(await convertToCurrencyDecimals(dai.address, '1000000'));
      await dai.connect(depositor.signer).approve(pool.address, await fxtPt(stETH, '1000000'));
      const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000000');
      await pool
        .connect(depositor.signer)
        .deposit(dai.address, amountDAItoDeposit, depositor.address, '0');

      await deposit(pool, stETH, lenderA, 100);

      await expect(
        pool
          .connect(depositor.signer)
          .borrow(stETH.address, 1, RateMode.Stable, '0', depositor.address)
      ).to.be.revertedWith('12');
    });
  });
});
