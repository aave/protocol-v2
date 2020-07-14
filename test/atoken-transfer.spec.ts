import {
  APPROVAL_AMOUNT_LENDING_POOL,
  MOCK_ETH_ADDRESS,
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
    INVALID_REDIRECTED_BALANCE_BEFORE_TRANSFER,
    INVALID_REDIRECTED_BALANCE_AFTER_TRANSFER,
    INVALID_REDIRECTION_ADDRESS,
    ZERO_COLLATERAL,
    TRANSFERRED_AMOUNT_GT_ZERO,
  } = ProtocolErrors;

  it('User 0 deposits 1000 DAI, transfers to user 1', async () => {
    const {users, pool, dai, aDai} = testEnv;

    await dai.connect(users[0].signer).mint(await convertToCurrencyDecimals(dai.address, '1000'));

    await dai.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await pool.connect(users[0].signer).deposit(dai.address, amountDAItoDeposit, '0');

    await aDai.connect(users[0].signer).transfer(users[1].address, amountDAItoDeposit);

    const fromBalance = await aDai.balanceOf(users[0].address);
    const toBalance = await aDai.balanceOf(users[1].address);

    expect(fromBalance.toString()).to.be.equal('0', INVALID_FROM_BALANCE_AFTER_TRANSFER);
    expect(toBalance.toString()).to.be.equal(
      amountDAItoDeposit.toString(),
      INVALID_TO_BALANCE_AFTER_TRANSFER
    );
  });

  it('User 1 redirects interest to user 2, transfers 500 DAI back to user 0', async () => {
    const {users, aDai, dai} = testEnv;
    await aDai.connect(users[1].signer).redirectInterestStream(users[2].address);

    const aDAIRedirected = await convertToCurrencyDecimals(dai.address, '1000');

    const aDAItoTransfer = await convertToCurrencyDecimals(dai.address, '500');

    const user2RedirectedBalanceBefore = await aDai.getRedirectedBalance(users[2].address);
    expect(user2RedirectedBalanceBefore.toString()).to.be.equal(
      aDAIRedirected,
      INVALID_REDIRECTED_BALANCE_BEFORE_TRANSFER
    );

    await aDai.connect(users[1].signer).transfer(users[0].address, aDAItoTransfer);

    const user2RedirectedBalanceAfter = await aDai.getRedirectedBalance(users[2].address);
    const user1RedirectionAddress = await aDai.getInterestRedirectionAddress(users[1].address);

    expect(user2RedirectedBalanceAfter.toString()).to.be.equal(
      aDAItoTransfer,
      INVALID_REDIRECTED_BALANCE_BEFORE_TRANSFER
    );
    expect(user1RedirectionAddress.toString()).to.be.equal(
      users[2].address,
      INVALID_REDIRECTION_ADDRESS
    );
  });

  it('User 0 transfers back to user 1', async () => {
    const {users, aDai, dai} = testEnv;
    const aDAItoTransfer = await convertToCurrencyDecimals(dai.address, '500');

    await aDai.connect(users[0].signer).transfer(users[1].address, aDAItoTransfer);

    const user2RedirectedBalanceAfter = await aDai.getRedirectedBalance(users[2].address);

    const user1BalanceAfter = await aDai.balanceOf(users[1].address);

    expect(user2RedirectedBalanceAfter.toString()).to.be.equal(
      user1BalanceAfter.toString(),
      INVALID_REDIRECTED_BALANCE_AFTER_TRANSFER
    );
  });

  it('User 0 deposits 1 ETH and user tries to borrow, but the aTokens received as a transfer are not available as collateral (revert expected)', async () => {
    const {users, pool} = testEnv;

    await pool
      .connect(users[0].signer)
      .deposit(MOCK_ETH_ADDRESS, ethers.utils.parseEther('1.0'), '0', {
        value: ethers.utils.parseEther('1.0'),
      });
    await expect(
      pool
        .connect(users[1].signer)
        .borrow(MOCK_ETH_ADDRESS, ethers.utils.parseEther('0.1'), RateMode.Stable, AAVE_REFERRAL),
      ZERO_COLLATERAL
    ).to.be.revertedWith(ZERO_COLLATERAL);
  });

  it('User 1 sets the DAI as collateral and borrows, tries to transfer everything back to user 0 (revert expected)', async () => {
    const {users, pool, aDai, dai} = testEnv;
    await pool.connect(users[1].signer).setUserUseReserveAsCollateral(dai.address, true);

    const aDAItoTransfer = await convertToCurrencyDecimals(dai.address, '1000');

    await pool
      .connect(users[1].signer)
      .borrow(MOCK_ETH_ADDRESS, ethers.utils.parseEther('0.1'), RateMode.Stable, AAVE_REFERRAL);

    await expect(
      aDai.connect(users[1].signer).transfer(users[0].address, aDAItoTransfer),
      'Transfer cannot be allowed.'
    ).to.be.revertedWith('Transfer cannot be allowed.');
  });

  it('User 0 tries to transfer 0 balance (revert expected)', async () => {
    const {users, pool, aDai, dai} = testEnv;
    await expect(
      aDai.connect(users[0].signer).transfer(users[1].address, '0'),
      TRANSFERRED_AMOUNT_GT_ZERO
    ).to.be.revertedWith(TRANSFERRED_AMOUNT_GT_ZERO);
  });

  it('User 1 repays the borrow, transfers aDAI back to user 0', async () => {
    const {users, pool, aDai, dai} = testEnv;
    await pool
      .connect(users[1].signer)
      .repay(MOCK_ETH_ADDRESS, MAX_UINT_AMOUNT, RateMode.Stable, users[1].address, {
        value: ethers.utils.parseEther('1'),
      });

    const aDAItoTransfer = await convertToCurrencyDecimals(aDai.address, '1000');

    await aDai.connect(users[1].signer).transfer(users[0].address, aDAItoTransfer);

    const user2RedirectedBalanceAfter = await aDai.getRedirectedBalance(users[2].address);

    const user1RedirectionAddress = await aDai.getInterestRedirectionAddress(users[1].address);

    expect(user2RedirectedBalanceAfter.toString()).to.be.equal(
      '0',
      INVALID_REDIRECTED_BALANCE_AFTER_TRANSFER
    );

    expect(user1RedirectionAddress.toString()).to.be.equal(
      ZERO_ADDRESS,
      INVALID_REDIRECTION_ADDRESS
    );
  });

  it('User 0 redirects interest to user 2, transfers 500 aDAI to user 1. User 1 redirects to user 3. User 0 transfers another 100 aDAI', async () => {
    const {users, pool, aDai, dai} = testEnv;

    let aDAItoTransfer = await convertToCurrencyDecimals(aDai.address, '500');

    await aDai.connect(users[0].signer).redirectInterestStream(users[2].address);

    await aDai.connect(users[0].signer).transfer(users[1].address, aDAItoTransfer);

    await aDai.connect(users[1].signer).redirectInterestStream(users[3].address);

    aDAItoTransfer = await convertToCurrencyDecimals(aDai.address, '100');

    await aDai.connect(users[0].signer).transfer(users[1].address, aDAItoTransfer);

    const user2RedirectedBalanceAfter = await aDai.getRedirectedBalance(users[2].address);
    const user3RedirectedBalanceAfter = await aDai.getRedirectedBalance(users[3].address);

    const expectedUser2Redirected = await convertToCurrencyDecimals(aDai.address, '400');
    const expectedUser3Redirected = await convertToCurrencyDecimals(aDai.address, '600');

    expect(user2RedirectedBalanceAfter.toString()).to.be.equal(
      expectedUser2Redirected,
      INVALID_REDIRECTED_BALANCE_AFTER_TRANSFER
    );
    expect(user3RedirectedBalanceAfter.toString()).to.be.equal(
      expectedUser3Redirected,
      INVALID_REDIRECTED_BALANCE_AFTER_TRANSFER
    );
  });

  it('User 1 transfers the whole amount to himself', async () => {
    const {users, pool, aDai, dai} = testEnv;

    const user1BalanceBefore = await aDai.balanceOf(users[1].address);

    await aDai.connect(users[1].signer).transfer(users[1].address, user1BalanceBefore);

    const user1BalanceAfter = await aDai.balanceOf(users[1].address);

    expect(user1BalanceAfter.toString()).to.be.equal(
      user1BalanceBefore,
      INVALID_REDIRECTED_BALANCE_AFTER_TRANSFER
    );
  });
});
