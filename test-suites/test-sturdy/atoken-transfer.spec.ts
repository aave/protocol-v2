import {
  APPROVAL_AMOUNT_LENDING_POOL,
  MAX_UINT_AMOUNT,
  ZERO_ADDRESS,
} from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { expect } from 'chai';
import { ethers } from 'ethers';
import { RateMode, ProtocolErrors } from '../../helpers/types';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { CommonsConfig } from '../../markets/sturdy/commons';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';

const STURDY_REFERRAL = CommonsConfig.ProtocolGlobalParams.SturdyReferral;

makeSuite('AToken: Transfer', (testEnv: TestEnv) => {
  const {
    INVALID_FROM_BALANCE_AFTER_TRANSFER,
    INVALID_TO_BALANCE_AFTER_TRANSFER,
    VL_TRANSFER_NOT_ALLOWED,
  } = ProtocolErrors;

  it('User 0 deposits 1000 DAI, transfers to user 1', async () => {
    const { users, pool, dai, aDai } = testEnv;

    const daiOwnerAddress = '0xC2c7D100d234D23cd7233066a5FEE97f56DB171C';
    const ethers = (DRE as any).ethers;

    await impersonateAccountsHardhat([daiOwnerAddress]);
    const signer = await ethers.provider.getSigner(daiOwnerAddress);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');
    await dai.connect(signer).transfer(users[0].address, amountDAItoDeposit);
    await dai.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool
      .connect(users[0].signer)
      .deposit(dai.address, amountDAItoDeposit, users[0].address, '0');

    await aDai.connect(users[0].signer).transfer(users[1].address, amountDAItoDeposit);

    const name = await aDai.name();

    expect(name).to.be.equal('Sturdy interest bearing DAI');

    const fromBalance = await aDai.balanceOf(users[0].address);
    const toBalance = await aDai.balanceOf(users[1].address);

    expect(fromBalance.toString()).to.be.equal('0', INVALID_FROM_BALANCE_AFTER_TRANSFER);
    expect(toBalance.toString()).to.be.equal(
      amountDAItoDeposit.toString(),
      INVALID_TO_BALANCE_AFTER_TRANSFER
    );
  });

  it('User 1 tries to transfer a small amount of DAI back to user 0', async () => {
    const { users, pool, aDai, dai } = testEnv;

    const aDAItoTransfer = await convertToCurrencyDecimals(dai.address, '100');

    await aDai.connect(users[1].signer).transfer(users[0].address, aDAItoTransfer);

    const user0Balance = await aDai.balanceOf(users[0].address);

    expect(user0Balance.toString()).to.be.eq(aDAItoTransfer.toString());
  });
});
