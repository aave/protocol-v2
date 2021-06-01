import rawDRE, { ethers } from 'hardhat';
import bnjs from 'bignumber.js';
import { solidity } from 'ethereum-waffle';
import {
  LendingPoolFactory,
  WETH9Factory,
  ATokenFactory,
  ERC20,
  LendingPool,
  StaticATokenLMFactory,
  ERC20Factory,
  WETH9,
  AToken,
  StaticATokenLM,
} from '../../../../types';
import {
  impersonateAccountsHardhat,
  DRE,
  waitForTx,
  evmRevert,
  evmSnapshot,
  timeLatest,
  advanceTimeAndBlock,
} from '../../../../helpers/misc-utils';
import { BigNumber, providers, Signer, utils } from 'ethers';
import { MAX_UINT_AMOUNT } from '../../../../helpers/constants';
import { tEthereumAddress } from '../../../../helpers/types';
import { AbiCoder, formatEther, verifyTypedData } from 'ethers/lib/utils';

import { _TypedDataEncoder } from 'ethers/lib/utils';

import { expect, use } from 'chai';
import { stat } from 'fs';
import { getCurrentBlock } from '../../../../helpers/contracts-helpers';

//use(solidity);

const DEFAULT_GAS_LIMIT = 10000000;
const DEFAULT_GAS_PRICE = utils.parseUnits('100', 'gwei');

const defaultTxParams = { gasLimit: DEFAULT_GAS_LIMIT, gasPrice: DEFAULT_GAS_PRICE };

const LENDING_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const STKAAVE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';
const AWETH = '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e';

const getUserData = async (_users: Signer[], _debug = false, { staticAToken, stkAave }) => {
  let usersData: {
    pendingRewards: BigNumber;
    stkAaveBalance: BigNumber;
    staticBalance: BigNumber;
  }[] = [];
  if (_debug) {
    console.log(`Printing user data:`);
  }
  for (let i = 0; i < _users.length; i++) {
    const userAddress = await _users[i].getAddress();
    usersData.push({
      pendingRewards: await staticAToken.getClaimableRewards(userAddress),
      stkAaveBalance: await stkAave.balanceOf(userAddress),
      staticBalance: await staticAToken.balanceOf(userAddress),
    });
    if (_debug) {
      console.log(
        `\tUser ${i} pendingRewards: ${formatEther(
          usersData[i].pendingRewards
        )}, stkAave balance: ${formatEther(usersData[i].stkAaveBalance)}, static bal: ${formatEther(
          usersData[i].staticBalance
        )} `
      );
    }
  }
  return usersData;
};

const DUST = 100;

describe('StaticATokenLM: aToken wrapper with static balances and liquidity mining', () => {
  let userSigner: providers.JsonRpcSigner;
  let user2Signer: providers.JsonRpcSigner;
  let lendingPool: LendingPool;
  let weth: WETH9;
  let aweth: AToken;
  let stkAave: ERC20;

  let staticAToken: StaticATokenLM;

  let snap: string;

  before(async () => {
    await rawDRE.run('set-DRE');

    console.log(`Initial block number: ${await getCurrentBlock()}`);

    const [user1, user2] = await DRE.ethers.getSigners();
    userSigner = DRE.ethers.provider.getSigner(await user1.getAddress());
    user2Signer = DRE.ethers.provider.getSigner(await user2.getAddress());
    lendingPool = LendingPoolFactory.connect(LENDING_POOL, userSigner);

    weth = WETH9Factory.connect(WETH, userSigner);
    aweth = ATokenFactory.connect(AWETH, userSigner);
    stkAave = ERC20Factory.connect(STKAAVE, userSigner);

    staticAToken = await new StaticATokenLMFactory(userSigner).deploy(
      LENDING_POOL,
      AWETH,
      'Static Aave Interest Bearing WETH',
      'stataAAVE'
    );

    snap = await evmSnapshot();
  });

  beforeEach(async () => {
    await evmRevert(snap);
    snap = await evmSnapshot();
  });

  after(async () => {
    await evmRevert(snap);
  });

  describe('Small checks', async () => {
    it('Rewards increase at deposit, update and withdraw and set to 0 at claim', async () => {
      const amountToDeposit = utils.parseEther('5');
      const amountToWithdraw = MAX_UINT_AMOUNT; // Still need to figure out why this works :eyes:

      // Just preparation
      await waitForTx(await weth.deposit({ value: amountToDeposit.mul(2) }));
      await waitForTx(
        await weth.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
      );

      // Depositing
      await waitForTx(
        await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
      );

      const pendingRewards1 = await staticAToken.getClaimableRewards(userSigner._address);

      // Depositing
      await waitForTx(
        await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
      );

      const pendingRewards2 = await staticAToken.getClaimableRewards(userSigner._address);

      await waitForTx(await staticAToken.updateRewards());

      const pendingRewards3 = await staticAToken.getClaimableRewards(userSigner._address);

      // Withdrawing all.
      await waitForTx(
        await staticAToken.withdraw(userSigner._address, amountToWithdraw, true, defaultTxParams)
      );

      const pendingRewards4 = await staticAToken.getClaimableRewards(userSigner._address);
      const claimedRewards4 = await stkAave.balanceOf(userSigner._address);

      await waitForTx(await staticAToken.claimRewards(userSigner._address));

      const pendingRewards5 = await staticAToken.getClaimableRewards(userSigner._address);

      expect(pendingRewards2).to.be.gt(pendingRewards1);
      expect(pendingRewards3).to.be.gt(pendingRewards2);
      expect(pendingRewards4).to.be.gt(pendingRewards3);
      expect(pendingRewards5).to.be.eq(0);
    });

    it('Check getters', async () => {
      const amountToDeposit = utils.parseEther('5');
      const amountToWithdraw = MAX_UINT_AMOUNT; // Still need to figure out why this works :eyes:

      // Just preparation
      await waitForTx(await weth.deposit({ value: amountToDeposit.mul(2) }));
      await waitForTx(
        await weth.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
      );

      // Depositing
      await waitForTx(
        await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
      );

      const staticBalance = await staticAToken.balanceOf(userSigner._address);
      const dynamicBalance = await staticAToken.dynamicBalanceOf(userSigner._address);

      const dynamicBalanceFromStatic = await staticAToken.staticToDynamicAmount(staticBalance);
      const staticBalanceFromDynamic = await staticAToken.dynamicToStaticAmount(dynamicBalance);

      expect(staticBalance).to.be.eq(staticBalanceFromDynamic);
      expect(dynamicBalance).to.be.eq(dynamicBalanceFromStatic);
    });

    it('Multiple updates in one block', async () => {
      const amountToDeposit = utils.parseEther('5');

      // Just preparation
      await waitForTx(await weth.deposit({ value: amountToDeposit.mul(2) }));
      await waitForTx(
        await weth.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
      );

      // Depositing
      await waitForTx(
        await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
      );

      await DRE.network.provider.send('evm_setAutomine', [false]);

      let a = await staticAToken.updateRewards();
      let b = await staticAToken.updateRewards();

      await DRE.network.provider.send('evm_mine', []);

      const aReceipt = await DRE.network.provider.send('eth_getTransactionReceipt', [a.hash]);
      const bReceipt = await DRE.network.provider.send('eth_getTransactionReceipt', [b.hash]);

      const aGas = BigNumber.from(aReceipt['gasUsed']);
      const bGas = BigNumber.from(bReceipt['gasUsed']);

      expect(aGas).to.be.gt(350000);
      expect(bGas).to.be.lt(25000);

      await DRE.network.provider.send('evm_setAutomine', [true]);
    });

    it('Update and claim', async () => {
      const amountToDeposit = utils.parseEther('5');
      const amountToWithdraw = MAX_UINT_AMOUNT; // Still need to figure out why this works :eyes:

      // Just preparation
      await waitForTx(await weth.deposit({ value: amountToDeposit.mul(2) }));
      await waitForTx(
        await weth.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
      );

      // Depositing
      await waitForTx(
        await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
      );

      const pendingRewards1 = await staticAToken.getClaimableRewards(userSigner._address);

      // Depositing
      await waitForTx(
        await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
      );

      const pendingRewards2 = await staticAToken.getClaimableRewards(userSigner._address);

      await waitForTx(await staticAToken.updateRewards());

      const pendingRewards3 = await staticAToken.getClaimableRewards(userSigner._address);
      const claimedRewards3 = await stkAave.balanceOf(userSigner._address);

      await waitForTx(await staticAToken.updateAndClaimRewards(userSigner._address));

      const pendingRewards4 = await staticAToken.getClaimableRewards(userSigner._address);
      const claimedRewards4 = await stkAave.balanceOf(userSigner._address);

      expect(pendingRewards1).to.be.eq(0);
      expect(pendingRewards2).to.be.gt(pendingRewards1);
      expect(pendingRewards3).to.be.gt(pendingRewards2);
      expect(pendingRewards4).to.be.eq(0);

      expect(claimedRewards3).to.be.eq(0);
      expect(claimedRewards4).to.be.gt(pendingRewards3);
    });

    it('Withdraw to other user', async () => {
      const amountToDeposit = utils.parseEther('5');
      const amountToWithdraw = MAX_UINT_AMOUNT;

      const recipient = user2Signer._address;

      // Just preparation
      await waitForTx(await weth.deposit({ value: amountToDeposit.mul(2) }));
      await waitForTx(
        await weth.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
      );

      // Depositing
      await waitForTx(
        await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
      );

      const userPendingRewards1 = await staticAToken.getClaimableRewards(userSigner._address);
      const recipientPendingRewards1 = await staticAToken.getClaimableRewards(recipient);

      // Withdrawing all
      await waitForTx(
        await staticAToken.withdraw(recipient, amountToWithdraw, true, defaultTxParams)
      );

      const userPendingRewards2 = await staticAToken.getClaimableRewards(userSigner._address);
      const recipientPendingRewards2 = await staticAToken.getClaimableRewards(recipient);

      // Check that the recipient have gotten the rewards
      expect(userPendingRewards2).to.be.gt(userPendingRewards1);
      expect(recipientPendingRewards1).to.be.eq(0);
      expect(recipientPendingRewards2).to.be.eq(0);
    });

    // Those that checks that subs could not be wrong or something other
  });

  it('Multiple users deposit WETH on stataWETH, wait 1 hour, update rewards, one user transfer, then claim and update rewards.', async () => {
    // In this case, the recipient should have approx twice the rewards.
    // Note that he has not held the 2x  balance for this entire time, but only for one block.
    // He have gotten this extra reward from the sender, because there was not a update prior.

    // Only diff here is if we wait, transfer, wait

    // 1. Deposit
    // 2. Wait 3600 seconds
    // 2-5. Update rewards
    // 3. Transfer
    // 4. Wait 3600 seconds
    // 5. Claim rewards
    // 6. Update rewards

    // When doing so, it should be clear that the recipient also gets the 'uncollected' rewards to the protocol that the value has accrued since last update.
    // The thought is that since it is expensive to retrieve these rewards, a small holder may rather want to give away the extra rewards (if rewards < gas).

    const amountToDeposit = utils.parseEther('5');
    const allusers = await DRE.ethers.getSigners();
    const users = [allusers[0], allusers[1], allusers[2], allusers[3], allusers[4]];

    const _debugUserData = false;

    for (let i = 0; i < 5; i++) {
      let currentUser = users[i];
      // Preparation
      await waitForTx(await weth.connect(currentUser).deposit({ value: amountToDeposit }));
      await waitForTx(
        await weth
          .connect(currentUser)
          .approve(staticAToken.address, amountToDeposit, defaultTxParams)
      );

      // Deposit
      await waitForTx(
        await staticAToken
          .connect(currentUser)
          .deposit(await currentUser.getAddress(), amountToDeposit, 0, true, defaultTxParams)
      );
    }

    // Advance time to accrue significant rewards.
    await advanceTimeAndBlock(60 * 60);
    await staticAToken.updateRewards();

    let staticATokenStkAaveBalInitial = await stkAave.balanceOf(staticAToken.address);
    let usersDataInitial = await getUserData(users, _debugUserData, { staticAToken, stkAave });

    await waitForTx(
      await staticAToken
        .connect(users[0])
        .transfer(
          await users[1].getAddress(),
          await staticAToken.balanceOf(await users[0].getAddress())
        )
    );

    await advanceTimeAndBlock(60 * 60);

    for (let i = 0; i < 5; i++) {
      await waitForTx(await staticAToken.claimRewards(await users[i].getAddress()));
    }

    let staticATokenStkAaveBalAfterTransferAndClaim = await stkAave.balanceOf(staticAToken.address);
    let usersDataAfterTransferAndClaim = await getUserData(users, _debugUserData, {
      staticAToken,
      stkAave,
    });

    await waitForTx(await staticAToken.updateRewards());

    let staticATokenStkAaveBalFinal = await stkAave.balanceOf(staticAToken.address);
    let usersDataFinal = await getUserData(users, _debugUserData, { staticAToken, stkAave });

    // Time for checks
    let pendingRewardsSumInitial = BigNumber.from(0);
    let pendingRewardsSumAfter = BigNumber.from(0);
    let pendingRewardsSumFinal = BigNumber.from(0);
    for (let i = 0; i < 5; i++) {
      expect(usersDataInitial[i].stkAaveBalance).to.be.eq(0);
      // Everyone else than i == 1, should have no change in pending rewards.
      // i == 1, will get additional rewards that have accrue
      expect(usersDataAfterTransferAndClaim[i].stkAaveBalance).to.be.eq(
        usersDataInitial[i].pendingRewards
      );
      if (i > 1) {
        // Expect initial static balance == after transfer == after claiming
        expect(usersDataInitial[i].staticBalance).to.be.eq(
          usersDataAfterTransferAndClaim[i].staticBalance
        );
        expect(usersDataInitial[i].staticBalance).to.be.eq(usersDataFinal[i].staticBalance);
      }

      pendingRewardsSumInitial = pendingRewardsSumInitial.add(usersDataInitial[i].pendingRewards);
      pendingRewardsSumAfter = pendingRewardsSumAfter.add(
        usersDataAfterTransferAndClaim[i].pendingRewards
      );
      pendingRewardsSumFinal = pendingRewardsSumFinal.add(usersDataFinal[i].pendingRewards);
    }

    // Expect user 0 to accrue zero fees after the transfer
    expect(usersDataFinal[0].pendingRewards).to.be.eq(0);
    expect(usersDataAfterTransferAndClaim[0].staticBalance).to.be.eq(0);
    expect(usersDataFinal[0].staticBalance).to.be.eq(0);

    // Expect user 1 to have received funds
    expect(usersDataAfterTransferAndClaim[1].staticBalance).to.be.eq(
      usersDataInitial[1].staticBalance.add(usersDataInitial[0].staticBalance)
    );
    /*
     * Expect user 1 to have accrued more than twice in pending rewards.
     * note that we get very little rewards in the transfer, because of the fresh update.
     */
    // Expect the pending of user to be a lot
    expect(usersDataFinal[1].pendingRewards).to.be.gt(usersDataFinal[2].pendingRewards.mul(2));
    // Expect his total fees to be almost 1.5 as large. Because of the small initial diff
    expect(usersDataFinal[1].pendingRewards.add(usersDataFinal[1].stkAaveBalance)).to.be.gt(
      usersDataFinal[2].pendingRewards.add(usersDataFinal[2].stkAaveBalance).mul(145).div(100)
    );
    expect(usersDataFinal[1].pendingRewards.add(usersDataFinal[1].stkAaveBalance)).to.be.lt(
      usersDataFinal[2].pendingRewards.add(usersDataFinal[2].stkAaveBalance).mul(155).div(100)
    );

    // Expect there to be excess stkAave in the contract. Expect it to be dust. This ensure that everyone can claim full amount of rewards.
    expect(pendingRewardsSumInitial).to.be.lte(staticATokenStkAaveBalInitial);
    expect(staticATokenStkAaveBalInitial.sub(pendingRewardsSumInitial)).to.be.lte(DUST);

    expect(pendingRewardsSumAfter).to.be.lte(staticATokenStkAaveBalAfterTransferAndClaim);
    expect(staticATokenStkAaveBalAfterTransferAndClaim.sub(pendingRewardsSumAfter)).to.be.lte(DUST);

    expect(pendingRewardsSumFinal).to.be.lte(staticATokenStkAaveBalFinal);
    expect(staticATokenStkAaveBalFinal.sub(pendingRewardsSumFinal)).to.be.lte(DUST);

    expect(usersDataInitial[0].pendingRewards).to.be.eq(
      usersDataAfterTransferAndClaim[0].stkAaveBalance
    );
    expect(usersDataAfterTransferAndClaim[0].pendingRewards).to.be.eq(0);
    expect(usersDataAfterTransferAndClaim[1].staticBalance).to.be.eq(
      usersDataInitial[1].staticBalance.add(usersDataInitial[0].staticBalance)
    );
  });

  it('Multiple users deposit WETH on stataWETH, wait 1 hour, one user transfer, then claim and update rewards.', async () => {
    // In this case, the recipient should have approx twice the rewards.
    // Note that he has not held the 2x  balance for this entire time, but only for one block.
    // He have gotten this extra reward from the sender, because there was not a update prior.

    // Only diff here is if we wait, transfer, wait

    // 1. Deposit
    // 2. Wait 3600 seconds
    // 3. Transfer
    // 4. Wait 3600 seconds
    // 5. Claim rewards
    // 6. Update rewards

    // When doing so, it should be clear that the recipient also gets the 'uncollected' rewards to the protocol that the value has accrued since last update.
    // The thought is that since it is expensive to retrieve these rewards, a small holder may rather want to give away the extra rewards (if rewards < gas).

    const amountToDeposit = utils.parseEther('5'); //'5');
    const allusers = await DRE.ethers.getSigners();
    const users = [allusers[0], allusers[1], allusers[2], allusers[3], allusers[4]];

    const _debugUserData = false;

    for (let i = 0; i < 5; i++) {
      let currentUser = users[i];
      // Preparation
      await waitForTx(await weth.connect(currentUser).deposit({ value: amountToDeposit }));
      await waitForTx(
        await weth
          .connect(currentUser)
          .approve(staticAToken.address, amountToDeposit, defaultTxParams)
      );

      // Deposit
      await waitForTx(
        await staticAToken
          .connect(currentUser)
          .deposit(await currentUser.getAddress(), amountToDeposit, 0, true, defaultTxParams)
      );
    }

    // Advance time to accrue significant rewards.
    await advanceTimeAndBlock(60 * 60);

    let staticATokenStkAaveBalInitial = await stkAave.balanceOf(staticAToken.address);
    let usersDataInitial = await getUserData(users, _debugUserData, { staticAToken, stkAave });

    // User 0 transfer full balance of staticATokens to user 1. This will also transfer the rewards since last update as well.
    await waitForTx(
      await staticAToken
        .connect(users[0])
        .transfer(
          await users[1].getAddress(),
          await staticAToken.balanceOf(await users[0].getAddress())
        )
    );

    await advanceTimeAndBlock(60 * 60);

    for (let i = 0; i < 5; i++) {
      await waitForTx(await staticAToken.claimRewards(await users[i].getAddress()));
    }

    let staticATokenStkAaveBalAfterTransfer = await stkAave.balanceOf(staticAToken.address);
    let usersDataAfterTransfer = await getUserData(users, _debugUserData, {
      staticAToken,
      stkAave,
    });

    await waitForTx(await staticAToken.updateRewards());

    let staticATokenStkAaveBalFinal = await stkAave.balanceOf(staticAToken.address);
    let usersDataFinal = await getUserData(users, _debugUserData, { staticAToken, stkAave });

    // Time for checks
    let pendingRewardsSumInitial = BigNumber.from(0);
    let pendingRewardsSumAfter = BigNumber.from(0);
    let pendingRewardsSumFinal = BigNumber.from(0);
    for (let i = 0; i < 5; i++) {
      expect(usersDataInitial[i].stkAaveBalance).to.be.eq(0);
      // Everyone else than i == 1, should have no change in pending rewards.
      // i == 1, will get additional rewards that have accrue
      expect(usersDataAfterTransfer[i].stkAaveBalance).to.be.eq(usersDataInitial[i].pendingRewards);
      if (i > 1) {
        // Expect initial static balance == after transfer == after claiming
        expect(usersDataInitial[i].staticBalance).to.be.eq(usersDataAfterTransfer[i].staticBalance);
        expect(usersDataInitial[i].staticBalance).to.be.eq(usersDataFinal[i].staticBalance);
      }

      pendingRewardsSumInitial = pendingRewardsSumInitial.add(usersDataInitial[i].pendingRewards);
      pendingRewardsSumAfter = pendingRewardsSumAfter.add(usersDataAfterTransfer[i].pendingRewards);
      pendingRewardsSumFinal = pendingRewardsSumFinal.add(usersDataFinal[i].pendingRewards);
    }

    // Expect user 0 to accrue zero fees after the transfer
    expect(usersDataFinal[0].pendingRewards).to.be.eq(0);
    expect(usersDataAfterTransfer[0].staticBalance).to.be.eq(0);
    expect(usersDataFinal[0].staticBalance).to.be.eq(0);

    // Expect user 1 to have received funds
    expect(usersDataAfterTransfer[1].staticBalance).to.be.eq(
      usersDataInitial[1].staticBalance.add(usersDataInitial[0].staticBalance)
    );
    /*
     * Expect user 1 to have pending more than twice the rewards as the last user.
     * Note that he should have accrued this, even though he did not have 2x bal for the full time,
     * as he also received the "uncollected" rewards from user1 at the transfer.
     */
    expect(usersDataFinal[1].pendingRewards).to.be.gt(usersDataFinal[2].pendingRewards.mul(2));
    // Expect his total fees to be almost twice as large. Because of the small initial diff
    expect(usersDataFinal[1].pendingRewards.add(usersDataFinal[1].stkAaveBalance)).to.be.gt(
      usersDataFinal[2].pendingRewards.add(usersDataFinal[2].stkAaveBalance).mul(195).div(100)
    );
    expect(usersDataFinal[1].pendingRewards.add(usersDataFinal[1].stkAaveBalance)).to.be.lt(
      usersDataFinal[2].pendingRewards.add(usersDataFinal[2].stkAaveBalance).mul(205).div(100)
    );

    // Expect there to be excess stkAave in the contract.
    // Expect it to be dust. This ensure that everyone can claim full amount of rewards.
    expect(pendingRewardsSumInitial).to.be.lte(staticATokenStkAaveBalInitial);
    expect(staticATokenStkAaveBalInitial.sub(pendingRewardsSumInitial)).to.be.lte(DUST);

    expect(pendingRewardsSumAfter).to.be.lte(staticATokenStkAaveBalAfterTransfer);
    expect(staticATokenStkAaveBalAfterTransfer.sub(pendingRewardsSumAfter)).to.be.lte(DUST);

    // We got an error here, pendingRewardsSumFinal = actual + 1
    expect(pendingRewardsSumFinal).to.be.lte(staticATokenStkAaveBalFinal);
    expect(staticATokenStkAaveBalFinal.sub(pendingRewardsSumFinal)).to.be.lte(DUST); // How small should we say dust is?

    // Expect zero rewards after all is claimed. But there is some dust left.
    expect(usersDataInitial[0].pendingRewards).to.be.eq(usersDataAfterTransfer[0].stkAaveBalance);
    expect(usersDataAfterTransfer[0].pendingRewards).to.be.eq(0);
    expect(usersDataAfterTransfer[1].staticBalance).to.be.eq(
      usersDataInitial[1].staticBalance.add(usersDataInitial[0].staticBalance)
    );
  });

  it('Mass deposit, then mass claim', async () => {
    const amountToDeposit = utils.parseEther('1.1'); // 18 decimals should be the worst here //1.135359735917531199
    const users = await DRE.ethers.getSigners();

    const depositCount = users.length;

    for (let i = 0; i < depositCount; i++) {
      let currentUser = users[i % users.length];
      // Preparation
      await waitForTx(await weth.connect(currentUser).deposit({ value: amountToDeposit }));
      await waitForTx(
        await weth
          .connect(currentUser)
          .approve(staticAToken.address, amountToDeposit, defaultTxParams)
      );

      // Deposit
      await waitForTx(
        await staticAToken
          .connect(currentUser)
          .deposit(await currentUser.getAddress(), amountToDeposit, 0, true, defaultTxParams)
      );
    }

    // Advance time to accrue significant rewards.
    await advanceTimeAndBlock(60 * 60);
    await waitForTx(await staticAToken.updateRewards());

    for (let i = 0; i < users.length; i++) {
      const pendingReward = await staticAToken.getClaimableRewards(await users[i].getAddress());
      await waitForTx(await staticAToken.claimRewards(await users[i].getAddress()));
      expect(await stkAave.balanceOf(await users[i].getAddress())).to.be.eq(pendingReward);
    }
    expect(await stkAave.balanceOf(staticAToken.address)).to.be.lt(DUST);
  });

  it('Multiple deposits, withdraws and claims', async () => {
    const amountToDeposit = utils.parseEther('1.135359735917531199'); // 18 decimals should be the worst here //1.135359735917531199
    const users = await DRE.ethers.getSigners();

    const depositCount = users.length;

    for (let i = 0; i < depositCount; i++) {
      let currentUser = users[i % users.length];
      // Preparation
      await waitForTx(await weth.connect(currentUser).deposit({ value: amountToDeposit }));
      await waitForTx(
        await weth
          .connect(currentUser)
          .approve(staticAToken.address, amountToDeposit, defaultTxParams)
      );

      // Deposit
      await waitForTx(
        await staticAToken
          .connect(currentUser)
          .deposit(await currentUser.getAddress(), amountToDeposit, 0, true, defaultTxParams)
      );

      await advanceTimeAndBlock(60);

      await waitForTx(
        await staticAToken
          .connect(currentUser)
          .withdraw(await currentUser.getAddress(), MAX_UINT_AMOUNT, true, defaultTxParams)
      );

      const pendingReward = await staticAToken.getClaimableRewards(await users[i].getAddress());
      await waitForTx(await staticAToken.updateAndClaimRewards(await users[i].getAddress()));
      expect(await stkAave.balanceOf(await users[i].getAddress())).to.be.eq(pendingReward);
    }
    expect(await stkAave.balanceOf(staticAToken.address)).to.be.lt(DUST);
  });
});
