import {
  APPROVAL_AMOUNT_LENDING_POOL,
  AAVE_REFERRAL,
  MAX_UINT_AMOUNT,
  ZERO_ADDRESS,
} from '../helpers/constants';
import {convertToCurrencyDecimals} from '../helpers/contracts-helpers';
import {expect} from 'chai';
import {ethers} from 'ethers';
import {RateMode, ProtocolErrors} from '../helpers/types';
import {makeSuite, TestEnv} from './helpers/make-suite';

makeSuite('AToken: Transfer', (testEnv: TestEnv) => {
  const {
    INVALID_FROM_BALANCE_AFTER_TRANSFER,
    INVALID_TO_BALANCE_AFTER_TRANSFER,
    // ZERO_COLLATERAL,
    COLLATERAL_BALANCE_IS_0,
    TRANSFER_NOT_ALLOWED,
    IS_PAUSED,
  } = ProtocolErrors;

  it('User 0 deposits 1000 DAI, transfers to user 1', async () => {
    const {users, pool, dai, aDai} = testEnv;

    await dai.connect(users[0].signer).mint(await convertToCurrencyDecimals(dai.address, '1000'));

    await dai.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await pool
      .connect(users[0].signer)
      .deposit(dai.address, amountDAItoDeposit, users[0].address, '0');

    await aDai.connect(users[0].signer).transfer(users[1].address, amountDAItoDeposit);

    const fromBalance = await aDai.balanceOf(users[0].address);
    const toBalance = await aDai.balanceOf(users[1].address);

    expect(fromBalance.toString()).to.be.equal('0', INVALID_FROM_BALANCE_AFTER_TRANSFER);
    expect(toBalance.toString()).to.be.equal(
      amountDAItoDeposit.toString(),
      INVALID_TO_BALANCE_AFTER_TRANSFER
    );
  });

  it('User 0 deposits 1 WETH and user 1 tries to borrow, but the aTokens received as a transfer are not available as collateral (revert expected)', async () => {
    const {users, pool, weth} = testEnv;
    const userAddress = await pool.signer.getAddress();

    await weth.connect(users[0].signer).mint(await convertToCurrencyDecimals(weth.address, '1'));

    await weth.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool
      .connect(users[0].signer)
      .deposit(weth.address, ethers.utils.parseEther('1.0'), userAddress, '0');
    await expect(
      pool
        .connect(users[1].signer)
        .borrow(weth.address, ethers.utils.parseEther('0.1'), RateMode.Stable, AAVE_REFERRAL),
      COLLATERAL_BALANCE_IS_0
    ).to.be.revertedWith(COLLATERAL_BALANCE_IS_0);
  });

  it('User 1 sets the DAI as collateral and borrows, tries to transfer everything back to user 0 (revert expected)', async () => {
    const {users, pool, aDai, dai, weth} = testEnv;
    await pool.connect(users[1].signer).setUserUseReserveAsCollateral(dai.address, true);

    const aDAItoTransfer = await convertToCurrencyDecimals(dai.address, '1000');

    await pool
      .connect(users[1].signer)
      .borrow(weth.address, ethers.utils.parseEther('0.1'), RateMode.Stable, AAVE_REFERRAL);

    await expect(
      aDai.connect(users[1].signer).transfer(users[0].address, aDAItoTransfer),
      TRANSFER_NOT_ALLOWED
    ).to.be.revertedWith(TRANSFER_NOT_ALLOWED);
  });
});
