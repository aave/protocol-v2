import rawDRE, { ethers } from 'hardhat';
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
  InitializableAdminUpgradeabilityProxyFactory,
  StaticAToken,
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
import { MAX_UINT_AMOUNT, USD_ADDRESS } from '../../../../helpers/constants';
import { AbiCoder, formatEther, verifyTypedData } from 'ethers/lib/utils';

import { _TypedDataEncoder } from 'ethers/lib/utils';

import { expect, use } from 'chai';
import { zeroAddress } from 'hardhat/node_modules/ethereumjs-util';

//use(solidity);

const DEFAULT_GAS_LIMIT = 10000000;
const DEFAULT_GAS_PRICE = utils.parseUnits('100', 'gwei');

const defaultTxParams = { gasLimit: DEFAULT_GAS_LIMIT, gasPrice: DEFAULT_GAS_PRICE };

const LENDING_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

const STKAAVE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';
const AENJ = '0xaC6Df26a590F08dcC95D5a4705ae8abbc88509Ef';
const ENJ = '0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c';

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

const ENJ_WHALE = '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8';

describe('StaticATokenLM: aToken wrapper with static balances and NO liquidity mining', () => {
  let userSigner: providers.JsonRpcSigner;
  let user2Signer: providers.JsonRpcSigner;
  let lendingPool: LendingPool;
  let stkAave: ERC20;
  let enj: ERC20;
  let aenj: AToken;

  let staticATokenImplementation: StaticATokenLM;
  let staticAToken: StaticATokenLM;

  let snap: string;

  let enjWhale: providers.JsonRpcSigner;

  before(async () => {
    await rawDRE.run('set-DRE');

    const [user1, user2] = await DRE.ethers.getSigners();
    userSigner = DRE.ethers.provider.getSigner(await user1.getAddress());
    user2Signer = DRE.ethers.provider.getSigner(await user2.getAddress());
    enjWhale = DRE.ethers.provider.getSigner(ENJ_WHALE);
    lendingPool = LendingPoolFactory.connect(LENDING_POOL, userSigner);

    enj = ERC20Factory.connect(ENJ, userSigner);
    aenj = ATokenFactory.connect(AENJ, userSigner);
    stkAave = ERC20Factory.connect(STKAAVE, userSigner);

    staticATokenImplementation = await new StaticATokenLMFactory(userSigner).deploy();
    await staticATokenImplementation.initialize(LENDING_POOL, AENJ, 'Wrapped aENJ', 'waaenj');

    const proxy = await new InitializableAdminUpgradeabilityProxyFactory(userSigner).deploy();
    const encodedInitializedParams = staticATokenImplementation.interface.encodeFunctionData(
      'initialize',
      [LENDING_POOL, AENJ, 'Wrapped aENJ', 'waaenj']
    );

    await proxy['initialize(address,address,bytes)'](
      staticATokenImplementation.address,
      zeroAddress(),
      encodedInitializedParams
    );

    staticAToken = StaticATokenLMFactory.connect(proxy.address, userSigner);

    expect(await staticATokenImplementation.isImplementation()).to.be.eq(true);
    expect(await staticAToken.isImplementation()).to.be.eq(false);

    expect(await staticAToken.decimals()).to.be.eq(18);
    expect(await staticAToken.name()).to.be.eq('Wrapped aENJ');
    expect(await staticAToken.symbol()).to.be.eq('waaenj');
    expect(await staticAToken.ATOKEN()).to.be.eq(AENJ);

    await impersonateAccountsHardhat([ENJ_WHALE]);

    const balanceWhale = await enj.balanceOf(ENJ_WHALE);

    await waitForTx(await enj.connect(enjWhale).transfer(userSigner._address, balanceWhale));

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
    it('No rewards accrue at deposit, update or withdraw', async () => {
      const amountToDeposit = utils.parseEther('5');
      const amountToWithdraw = MAX_UINT_AMOUNT;

      // Just preparation
      await waitForTx(
        await enj.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
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

      await waitForTx(await staticAToken.collectAndUpdateRewards());

      const pendingRewards3 = await staticAToken.getClaimableRewards(userSigner._address);

      // Withdrawing all.
      await waitForTx(
        await staticAToken.withdraw(userSigner._address, amountToWithdraw, true, defaultTxParams)
      );

      const pendingRewards4 = await staticAToken.getClaimableRewards(userSigner._address);
      const totPendingRewards4 = await staticAToken.getTotalClaimableRewards();
      const claimedRewards4 = await stkAave.balanceOf(userSigner._address);
      const stkAaveStatic4 = await stkAave.balanceOf(staticAToken.address);

      await waitForTx(await staticAToken.connect(userSigner).claimRewardsToSelf(false));

      const pendingRewards5 = await staticAToken.getClaimableRewards(userSigner._address);
      const totPendingRewards5 = await staticAToken.getTotalClaimableRewards();
      const claimedRewards5 = await stkAave.balanceOf(userSigner._address);
      const stkAaveStatic5 = await stkAave.balanceOf(staticAToken.address);

      await waitForTx(await staticAToken.collectAndUpdateRewards());
      const pendingRewards6 = await staticAToken.getClaimableRewards(userSigner._address);

      // Checks
      expect(pendingRewards1).to.be.eq(0);
      expect(pendingRewards2).to.be.eq(0);
      expect(pendingRewards3).to.be.eq(0);
      expect(pendingRewards4).to.be.eq(0);
      expect(pendingRewards5).to.be.eq(0);
      expect(pendingRewards6).to.be.eq(0);
      expect(totPendingRewards4).to.be.eq(0);
      expect(totPendingRewards5).to.be.eq(0);
      expect(claimedRewards4).to.be.eq(0);
      expect(claimedRewards5).to.be.eq(0);
      expect(stkAaveStatic4).to.be.eq(0);
      expect(stkAaveStatic5).to.be.eq(0);
    });

    it('Check getters', async () => {
      const amountToDeposit = utils.parseEther('5');

      const accRewardsPerTokenPre = await staticAToken.getAccRewardsPerToken();
      const lifetimeRewardsClaimedPre = await staticAToken.getLifetimeRewardsClaimed();
      const lifetimeRewards = await staticAToken.getLifetimeRewards();
      const lastRewardBlock = await staticAToken.getLastRewardBlock();

      // Just preparation
      await waitForTx(
        await enj.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
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

      await staticAToken.collectAndUpdateRewards();

      expect(await staticAToken.getAccRewardsPerToken()).to.be.eq(0);
      expect(accRewardsPerTokenPre).to.be.eq(0);
      expect(await staticAToken.getLifetimeRewardsClaimed()).to.be.eq(0);
      expect(lifetimeRewardsClaimedPre).to.be.eq(0);
      expect(await staticAToken.getLifetimeRewards()).to.be.eq(0);
      expect(lifetimeRewards).to.be.eq(0);
      expect(await staticAToken.getLastRewardBlock()).to.be.eq(0);
      expect(lastRewardBlock).to.be.eq(0);
    });

    it('Multiple deposits in one block (Breaks if GasReport enabled)', async () => {
      const amountToDeposit = utils.parseEther('5');

      // Just preparation
      await waitForTx(
        await enj.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
      );

      await DRE.network.provider.send('evm_setAutomine', [false]);

      // Depositing
      let a = await staticAToken.deposit(
        userSigner._address,
        amountToDeposit,
        0,
        true,
        defaultTxParams
      );

      // Depositing
      let b = await staticAToken.deposit(
        userSigner._address,
        amountToDeposit,
        0,
        true,
        defaultTxParams
      );

      await DRE.network.provider.send('evm_mine', []);

      const aReceipt = await DRE.network.provider.send('eth_getTransactionReceipt', [a.hash]);
      const bReceipt = await DRE.network.provider.send('eth_getTransactionReceipt', [b.hash]);

      const aGas = BigNumber.from(aReceipt['gasUsed']);
      const bGas = BigNumber.from(bReceipt['gasUsed']);

      expect(aGas).to.be.gt(250000);
      expect(bGas).to.be.lt(210000);

      await DRE.network.provider.send('evm_setAutomine', [true]);
      await DRE.network.provider.send('evm_mine', []);
    });

    it('Multiple collectAndUpdate in one block (Breaks if GasReport enabled)', async () => {
      const amountToDeposit = utils.parseEther('5');

      // Just preparation
      await waitForTx(
        await enj.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
      );

      // Depositing
      await waitForTx(
        await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
      );

      await DRE.network.provider.send('evm_setAutomine', [false]);

      let a = await staticAToken.collectAndUpdateRewards();
      let b = await staticAToken.collectAndUpdateRewards();

      await DRE.network.provider.send('evm_mine', []);

      const aReceipt = await DRE.network.provider.send('eth_getTransactionReceipt', [a.hash]);
      const bReceipt = await DRE.network.provider.send('eth_getTransactionReceipt', [b.hash]);

      const aGas = BigNumber.from(aReceipt['gasUsed']);
      const bGas = BigNumber.from(bReceipt['gasUsed']);

      expect(aGas).to.be.lt(35000);
      expect(bGas).to.be.lt(35000);

      await DRE.network.provider.send('evm_setAutomine', [true]);
    });

    it('Update and claim', async () => {
      const amountToDeposit = utils.parseEther('5');

      // Just preparation
      await waitForTx(
        await enj.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
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

      await waitForTx(await staticAToken.collectAndUpdateRewards());

      const pendingRewards3 = await staticAToken.getClaimableRewards(userSigner._address);
      const claimedRewards3 = await stkAave.balanceOf(userSigner._address);

      await waitForTx(await staticAToken.connect(userSigner).claimRewardsToSelf(true));

      const pendingRewards4 = await staticAToken.getClaimableRewards(userSigner._address);
      const claimedRewards4 = await stkAave.balanceOf(userSigner._address);

      expect(pendingRewards1).to.be.eq(0);
      expect(pendingRewards2).to.be.eq(0);
      expect(pendingRewards3).to.be.eq(0);
      expect(pendingRewards4).to.be.eq(0);
      expect(claimedRewards3).to.be.eq(0);
      expect(claimedRewards4).to.be.eq(0);
    });

    it('Withdraw to other user', async () => {
      const amountToDeposit = utils.parseEther('5');
      const amountToWithdraw = MAX_UINT_AMOUNT;

      const recipient = user2Signer._address;

      // Just preparation
      await waitForTx(
        await enj.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
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

      expect(userPendingRewards1).to.be.eq(0);
      expect(userPendingRewards2).to.be.eq(0);
      expect(recipientPendingRewards1).to.be.eq(0);
      expect(recipientPendingRewards2).to.be.eq(0);
    });

    it('Deposit, Wait, Withdraw, claim?', async () => {
      const amountToDeposit = utils.parseEther('5');
      const amountToWithdraw = MAX_UINT_AMOUNT;

      // Just preparation
      await waitForTx(
        await enj.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
      );

      // Depositing
      await waitForTx(
        await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
      );

      const pendingRewards1 = await staticAToken.getClaimableRewards(userSigner._address);

      await advanceTimeAndBlock(60 * 60);

      const pendingRewards2 = await staticAToken.getClaimableRewards(userSigner._address);

      // Withdrawing all.
      await waitForTx(
        await staticAToken.withdraw(userSigner._address, amountToWithdraw, true, defaultTxParams)
      );

      // How will my pending look now
      const pendingRewards3 = await staticAToken.getClaimableRewards(userSigner._address);

      await waitForTx(await staticAToken.connect(userSigner).claimRewardsToSelf(true));

      const pendingRewards4 = await staticAToken.getClaimableRewards(userSigner._address);
      const userBalance4 = await stkAave.balanceOf(userSigner._address);

      expect(pendingRewards1).to.be.eq(0);
      expect(pendingRewards2).to.be.eq(0);
      expect(pendingRewards3).to.be.eq(0);
      expect(pendingRewards4).to.be.eq(0);
    });

    it('Deposit, Wait, Withdraw, claim to other user', async () => {
      const amountToDeposit = utils.parseEther('5');
      const amountToWithdraw = MAX_UINT_AMOUNT;

      // Just preparation
      await waitForTx(
        await enj.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
      );

      // Depositing
      await waitForTx(
        await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
      );

      const pendingRewards1 = await staticAToken.getClaimableRewards(userSigner._address);

      await advanceTimeAndBlock(60 * 60);

      const pendingRewards2 = await staticAToken.getClaimableRewards(userSigner._address);

      // Withdrawing all.
      await waitForTx(
        await staticAToken.withdraw(userSigner._address, amountToWithdraw, true, defaultTxParams)
      );

      // How will my pending look now
      const pendingRewards3 = await staticAToken.getClaimableRewards(userSigner._address);

      const userBalance3 = await stkAave.balanceOf(userSigner._address);
      await staticAToken.connect(user2Signer).claimRewards(userSigner._address, true);
      const userBalance4 = await stkAave.balanceOf(userSigner._address);

      await waitForTx(
        await staticAToken.connect(userSigner).claimRewards(user2Signer._address, true)
      );

      const pendingRewards5 = await staticAToken.getClaimableRewards(userSigner._address);
      const user2Balance5 = await stkAave.balanceOf(user2Signer._address);

      expect(pendingRewards1).to.be.eq(0);
      expect(pendingRewards2).to.be.eq(0);
      expect(pendingRewards3).to.be.eq(0);

      expect(userBalance3).to.be.eq(userBalance4);
      expect(pendingRewards5).to.be.eq(0);
      expect(user2Balance5).to.be.eq(pendingRewards3);
    });

    it('Deposit, Wait, collectAndUpdate, Withdraw, claim?', async () => {
      const amountToDeposit = utils.parseEther('5');
      const amountToWithdraw = MAX_UINT_AMOUNT;

      // Just preparation
      await waitForTx(
        await enj.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
      );

      // Depositing
      await waitForTx(
        await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
      );

      const pendingRewards1 = await staticAToken.getClaimableRewards(userSigner._address);

      await advanceTimeAndBlock(60 * 60);
      await waitForTx(await staticAToken.collectAndUpdateRewards());

      const pendingRewards2 = await staticAToken.getClaimableRewards(userSigner._address);

      // Withdrawing all.
      await waitForTx(
        await staticAToken.withdraw(userSigner._address, amountToWithdraw, true, defaultTxParams)
      );

      const pendingRewards3 = await staticAToken.getClaimableRewards(userSigner._address);

      await waitForTx(await staticAToken.connect(userSigner).claimRewardsToSelf(true));

      const pendingRewards4 = await staticAToken.getClaimableRewards(userSigner._address);
      const userBalance4 = await stkAave.balanceOf(userSigner._address);

      expect(pendingRewards1).to.be.eq(0);
      expect(pendingRewards2).to.be.eq(0);
      expect(pendingRewards3).to.be.eq(0);
      expect(pendingRewards4).to.be.eq(0);

      expect(userBalance4).to.be.eq(pendingRewards3);
    });

    it('Throw away as much as possible: Deposit, collectAndUpdate, wait, Withdraw, claim', async () => {
      const amountToDeposit = utils.parseEther('5');
      const amountToWithdraw = MAX_UINT_AMOUNT;

      // Just preparation
      await waitForTx(
        await enj.approve(staticAToken.address, amountToDeposit.mul(2), defaultTxParams)
      );

      // Depositing
      await waitForTx(
        await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
      );

      const pendingRewards1 = await staticAToken.getClaimableRewards(userSigner._address);

      await waitForTx(await staticAToken.collectAndUpdateRewards());
      await advanceTimeAndBlock(60 * 60);

      const pendingRewards2 = await staticAToken.getClaimableRewards(userSigner._address);

      // Withdrawing all.
      await waitForTx(
        await staticAToken.withdraw(userSigner._address, amountToWithdraw, true, defaultTxParams)
      );

      // How will my pending look now
      const pendingRewards3 = await staticAToken.getClaimableRewards(userSigner._address);
      const unclaimedRewards3 = await staticAToken.getUnclaimedRewards(userSigner._address);

      await waitForTx(await staticAToken.connect(userSigner).claimRewardsToSelf(false));

      const pendingRewards4 = await staticAToken.getClaimableRewards(userSigner._address);
      const userBalance4 = await stkAave.balanceOf(userSigner._address);
      const totClaimable4 = await staticAToken.getTotalClaimableRewards();
      const unclaimedRewards4 = await staticAToken.getUnclaimedRewards(userSigner._address);

      expect(pendingRewards1).to.be.eq(0);
      expect(pendingRewards2).to.be.eq(0);
      expect(pendingRewards3).to.be.eq(0);
      expect(pendingRewards4).to.be.eq(0);
      expect(totClaimable4).to.be.eq(0);
      expect(userBalance4).to.be.eq(0);
      expect(unclaimedRewards3).to.be.eq(0);
      expect(unclaimedRewards4).to.be.eq(0);
    });
  });

  it('Multiple users deposit ENJ on waaenj, wait 1 hour, update rewards, one user transfer, then claim and update rewards.', async () => {
    // In this case, the recipient should have approx 1.5 the rewards of the others.

    // 1. Deposit
    // 2. Wait 3600 seconds
    // 2-5. Update rewards
    // 3. Transfer
    // 4. Wait 3600 seconds
    // 5. Claim rewards
    // 6. Update rewards

    const amountToDeposit = utils.parseEther('5');
    const allusers = await DRE.ethers.getSigners();
    const users = [allusers[0], allusers[1], allusers[2], allusers[3], allusers[4]];

    const _debugUserData = false;

    for (let i = 0; i < 5; i++) {
      let currentUser = users[i];
      // Preparation
      await waitForTx(
        await enj.connect(allusers[0]).transfer(await currentUser.getAddress(), amountToDeposit)
      );
      await waitForTx(
        await enj
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
    await staticAToken.collectAndUpdateRewards();

    let staticATokenTotClaimableInitial = await staticAToken.getTotalClaimableRewards();
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
      // This will claim the first half of the collected tokens (those collected at `collectAndUpdateRewards`)
      await waitForTx(await staticAToken.connect(users[i]).claimRewardsToSelf(false));
    }

    let staticATokenTotClaimableAfterTransferAndClaim = await staticAToken.getTotalClaimableRewards();
    let usersDataAfterTransferAndClaim = await getUserData(users, _debugUserData, {
      staticAToken,
      stkAave,
    });

    await waitForTx(await staticAToken.collectAndUpdateRewards());

    let staticATokenTotClaimableFinal = await staticAToken.getTotalClaimableRewards();
    let usersDataFinal = await getUserData(users, _debugUserData, { staticAToken, stkAave });

    // Time for checks
    let pendingRewardsSumInitial = BigNumber.from(0);
    let pendingRewardsSumAfter = BigNumber.from(0);
    let pendingRewardsSumFinal = BigNumber.from(0);
    for (let i = 0; i < 5; i++) {
      expect(usersDataInitial[i].stkAaveBalance).to.be.eq(0);
      expect(usersDataAfterTransferAndClaim[i].stkAaveBalance).to.be.eq(0);
      expect(usersDataFinal[i].stkAaveBalance).to.be.eq(0);
      expect(usersDataInitial[i].pendingRewards).to.be.eq(0);
      expect(usersDataAfterTransferAndClaim[i].pendingRewards).to.be.eq(0);
      expect(usersDataFinal[i].pendingRewards).to.be.eq(0);

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
    expect(usersDataAfterTransferAndClaim[0].staticBalance).to.be.eq(0);
    expect(usersDataAfterTransferAndClaim[0].pendingRewards).to.be.eq(0);
    expect(usersDataFinal[0].staticBalance).to.be.eq(0);
    expect(usersDataFinal[0].pendingRewards).to.be.eq(0);

    // Expect user 1 to have received funds
    expect(usersDataAfterTransferAndClaim[1].staticBalance).to.be.eq(
      usersDataInitial[1].staticBalance.add(usersDataInitial[0].staticBalance)
    );

    expect(pendingRewardsSumInitial).to.be.eq(0);
    expect(pendingRewardsSumAfter).to.be.eq(0);
    expect(pendingRewardsSumFinal).to.be.eq(0);

    expect(staticATokenTotClaimableInitial).to.be.eq(0);
    expect(staticATokenTotClaimableAfterTransferAndClaim).to.be.eq(0);
    expect(staticATokenTotClaimableFinal).to.be.eq(0);
  });

  it('Multiple users deposit ENJ on waaenj, wait 1 hour, one user transfer, then claim and update rewards.', async () => {
    // In this case, the recipient should have approx twice the rewards.
    // Note that he has not held the 2x  balance for this entire time, but only for one block.
    // He have gotten this extra reward from the sender, because there was not a update prior.

    // 1. Deposit
    // 2. Wait 3600 seconds
    // 3. Transfer
    // 4. Wait 3600 seconds
    // 5. Claim rewards
    // 6. Update rewards

    const amountToDeposit = utils.parseEther('5');
    const allusers = await DRE.ethers.getSigners();
    const users = [allusers[0], allusers[1], allusers[2], allusers[3], allusers[4]];

    const _debugUserData = false;

    for (let i = 0; i < 5; i++) {
      let currentUser = users[i];
      // Preparation
      await waitForTx(
        await enj.connect(allusers[0]).transfer(await currentUser.getAddress(), amountToDeposit)
      );
      await waitForTx(
        await enj
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

    let staticATokenTotClaimableInitial = await staticAToken.getTotalClaimableRewards();
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
      // This will not do anything, hence there is no rewards in the current contract.
      await waitForTx(await staticAToken.connect(users[i]).claimRewardsToSelf(false));
    }

    let staticATokenTotClaimableAfterTransfer = await staticAToken.getTotalClaimableRewards();
    let usersDataAfterTransfer = await getUserData(users, _debugUserData, {
      staticAToken,
      stkAave,
    });

    await waitForTx(await staticAToken.collectAndUpdateRewards());

    let staticATokenTotClaimableFinal = await staticAToken.getTotalClaimableRewards();
    let usersDataFinal = await getUserData(users, _debugUserData, { staticAToken, stkAave });

    // Time for checks
    let pendingRewardsSumInitial = BigNumber.from(0);
    let pendingRewardsSumAfter = BigNumber.from(0);
    let pendingRewardsSumFinal = BigNumber.from(0);
    for (let i = 0; i < 5; i++) {
      expect(usersDataInitial[i].stkAaveBalance).to.be.eq(0);
      expect(usersDataAfterTransfer[i].stkAaveBalance).to.be.eq(0);
      expect(usersDataFinal[i].stkAaveBalance).to.be.eq(0);
      expect(usersDataInitial[i].pendingRewards).to.be.eq(0);
      expect(usersDataAfterTransfer[i].pendingRewards).to.be.eq(0);
      expect(usersDataFinal[i].pendingRewards).to.be.eq(0);
      if (i > 1) {
        // Expect initial static balance == after transfer == after claiming
        expect(usersDataInitial[i].staticBalance).to.be.eq(usersDataAfterTransfer[i].staticBalance);
        expect(usersDataInitial[i].staticBalance).to.be.eq(usersDataFinal[i].staticBalance);
      }

      pendingRewardsSumInitial = pendingRewardsSumInitial.add(usersDataInitial[i].pendingRewards);
      pendingRewardsSumAfter = pendingRewardsSumAfter.add(usersDataAfterTransfer[i].pendingRewards);
      pendingRewardsSumFinal = pendingRewardsSumFinal.add(usersDataFinal[i].pendingRewards);
    }

    expect(await staticAToken.getTotalClaimableRewards()).to.be.eq(0);
    expect(await stkAave.balanceOf(staticAToken.address)).to.be.eq(0);
    expect(pendingRewardsSumInitial).to.be.eq(0);
    expect(pendingRewardsSumAfter).to.be.eq(0);
    expect(pendingRewardsSumFinal).to.be.eq(0);

    expect(usersDataAfterTransfer[0].staticBalance).to.be.eq(0);
    expect(usersDataFinal[0].staticBalance).to.be.eq(0);

    // Expect user 1 to have received funds
    expect(usersDataAfterTransfer[1].staticBalance).to.be.eq(
      usersDataInitial[1].staticBalance.add(usersDataInitial[0].staticBalance)
    );

    expect(staticATokenTotClaimableInitial).to.be.eq(0);
    expect(staticATokenTotClaimableAfterTransfer).to.be.eq(0);
    expect(staticATokenTotClaimableFinal).to.be.eq(0);

    expect(pendingRewardsSumInitial).to.be.eq(0);
    expect(pendingRewardsSumAfter).to.be.eq(0);
    expect(pendingRewardsSumFinal).to.be.eq(0);
  });

  it('Mass deposit, then mass claim to own account', async () => {
    const amountToDeposit = utils.parseEther('1.1'); // 18 decimals should be the worst here //1.135359735917531199
    const users = await DRE.ethers.getSigners();

    const depositCount = users.length;

    for (let i = 0; i < depositCount; i++) {
      let currentUser = users[i % users.length];
      // Preparation
      await waitForTx(
        await enj.connect(users[0]).transfer(await currentUser.getAddress(), amountToDeposit)
      );
      await waitForTx(
        await enj
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
    await waitForTx(await staticAToken.collectAndUpdateRewards());

    for (let i = 0; i < users.length; i++) {
      const pendingReward = await staticAToken.getClaimableRewards(await users[i].getAddress());
      expect(pendingReward).to.be.eq(0);
    }
    for (let i = 0; i < users.length; i++) {
      await waitForTx(await staticAToken.connect(users[i]).claimRewardsToSelf(false));
      expect(await stkAave.balanceOf(await users[i].getAddress())).to.be.eq(0);
    }
    expect(await stkAave.balanceOf(staticAToken.address)).to.be.eq(0);
  });

  it('Mass deposit, then mass claim to specified account', async () => {
    const amountToDeposit = utils.parseEther('1.1'); // 18 decimals should be the worst here //1.135359735917531199
    const users = await DRE.ethers.getSigners();

    const depositCount = users.length;

    for (let i = 0; i < depositCount; i++) {
      let currentUser = users[i % users.length];
      // Preparation
      await waitForTx(
        await enj.connect(users[0]).transfer(await currentUser.getAddress(), amountToDeposit)
      );
      await waitForTx(
        await enj
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
    await waitForTx(await staticAToken.collectAndUpdateRewards());

    const receiverAddress = await users[0].getAddress();

    for (let i = 0; i < users.length; i++) {
      const pendingReward = await staticAToken.getClaimableRewards(await users[i].getAddress());
      expect(pendingReward).to.be.eq(0);
    }
    for (let i = 0; i < users.length; i++) {
      await waitForTx(await staticAToken.connect(users[i]).claimRewards(receiverAddress, false));
      expect(await stkAave.balanceOf(receiverAddress)).to.be.eq(0);
    }
    expect(await stkAave.balanceOf(staticAToken.address)).to.be.eq(0);
  });

  it('Mass deposits, mass withdraws and mass claims', async () => {
    const amountToDeposit = utils.parseEther('1.135359735917531199'); // 18 decimals should be the worst here //1.135359735917531199
    const users = await DRE.ethers.getSigners();

    const depositCount = users.length;

    for (let i = 0; i < depositCount; i++) {
      let currentUser = users[i % users.length];
      // Preparation
      await waitForTx(
        await enj.connect(users[0]).transfer(await currentUser.getAddress(), amountToDeposit)
      );
      await waitForTx(
        await enj
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
      await waitForTx(await staticAToken.connect(users[i]).claimRewardsToSelf(true));
      expect(pendingReward).to.be.eq(0);
      expect(await stkAave.balanceOf(await users[i].getAddress())).to.be.eq(pendingReward);
    }
  });

  it('Checks that withdraw and collect in different blocks updates _lifetimeRewardsClaimed as expected', async () => {
    const users = await DRE.ethers.getSigners();
    const user = users[0];
    const depositAmount = utils.parseEther('1');

    // Preparation
    await waitForTx(
      await enj.connect(user).approve(staticAToken.address, depositAmount, defaultTxParams)
    );

    // Deposit
    await waitForTx(
      await staticAToken
        .connect(user)
        .deposit(await user.getAddress(), depositAmount, 0, true, defaultTxParams)
    );

    await advanceTimeAndBlock(60);

    expect(await staticAToken.getLifetimeRewardsClaimed()).to.be.eq(0);
    expect(await staticAToken.getClaimableRewards(await user.getAddress())).to.be.eq(0);
    expect(await stkAave.balanceOf(await user.getAddress())).to.be.eq(0);

    await waitForTx(
      await staticAToken.connect(user).withdraw(await user.getAddress(), MAX_UINT_AMOUNT, true)
    );
    await staticAToken.collectAndUpdateRewards();
    await staticAToken.connect(user).claimRewardsToSelf(false);

    expect(await staticAToken.getLifetimeRewardsClaimed()).to.be.eq(0);
    expect(await staticAToken.getClaimableRewards(await user.getAddress())).to.be.eq(0);
    expect(await stkAave.balanceOf(await user.getAddress())).to.be.eq(0);
  });

  it('Checks that withdraw and collect in the same block updates _lifetimeRewardsClaimed as expected (Breaks if GasReport is enabled)', async () => {
    const users = await DRE.ethers.getSigners();
    const user = users[0];
    const depositAmount = utils.parseEther('1');

    // Preparation
    await waitForTx(
      await enj.connect(user).approve(staticAToken.address, depositAmount, defaultTxParams)
    );

    // Deposit
    await waitForTx(
      await staticAToken
        .connect(user)
        .deposit(await user.getAddress(), depositAmount, 0, true, defaultTxParams)
    );

    await advanceTimeAndBlock(60);

    expect(await staticAToken.getLifetimeRewardsClaimed()).to.be.eq(0);
    expect(await staticAToken.getClaimableRewards(await user.getAddress())).to.be.eq(0);
    expect(await stkAave.balanceOf(await user.getAddress())).to.be.eq(0);

    await DRE.network.provider.send('evm_setAutomine', [false]);

    await staticAToken.connect(user).withdraw(await user.getAddress(), MAX_UINT_AMOUNT, true);
    await staticAToken.collectAndUpdateRewards();
    await staticAToken.connect(user).claimRewardsToSelf(false);

    await DRE.network.provider.send('evm_mine', []);
    await DRE.network.provider.send('evm_setAutomine', [true]);

    expect(await staticAToken.getLifetimeRewardsClaimed()).to.be.eq(0);
    expect(await staticAToken.getClaimableRewards(await user.getAddress())).to.be.eq(0);
    expect(await stkAave.balanceOf(await user.getAddress())).to.be.eq(0);
  });
});
