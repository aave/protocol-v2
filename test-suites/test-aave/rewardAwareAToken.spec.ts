import BigNumberJs from 'bignumber.js';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { MAX_UINT_AMOUNT } from '../../helpers/constants';
import { evmRevert, evmSnapshot, increaseTime } from '../../helpers/misc-utils';
import { makeSuite, SignerWithAddress, TestEnv } from './helpers/make-suite';
import { checkRewards } from './helpers/rewards-distribution/verify';

const chai = require('chai');
const { expect } = chai;

/**
 * @dev REW is a mocked mintable token named RewardsToken.sol with an emission rate of 1 REW per second that can be deposited using a RewardsAwareAToken implementation named  RewardsATokenMock.sol
 * The distribution of REW happens at `claim`, but there is also a `updateMintableEmission` functions that updates the state of the distribution of 1 user but does not claim.
 */

makeSuite('Reward Aware AToken', (testEnv: TestEnv) => {
  let initTimestamp;
  let evmSnapshotId;

  before('Initializing configuration', async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumberJs.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumberJs.ROUND_DOWN });
  });

  after('Reset', () => {
    // Reset BigNumber
    BigNumberJs.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumberJs.ROUND_HALF_UP });
  });

  beforeEach(async () => {
    initTimestamp = await testEnv.rew.INIT_TIMESTAMP();
    evmSnapshotId = await evmSnapshot();
  });

  afterEach(async () => {
    await evmRevert(evmSnapshotId);
  });

  const mintAndDeposit = async (
    key: SignerWithAddress,
    shouldReward?: boolean,
    amountSize?: BigNumber
  ) => {
    const { rew, aRew, pool } = testEnv;
    const amount = amountSize || parseEther('1');
    const userATokenBalanceBeforeDeposit = await aRew.balanceOf(key.address);

    // Mint REW to user
    await rew.connect(key.signer).mint(amount);

    // Approve and Deposit REW to pool and mint
    await rew.connect(key.signer).approve(pool.address, amount);

    const txDeposit = await pool.connect(key.signer).deposit(rew.address, amount, key.address, '0');

    expect(Promise.resolve(txDeposit)).emit(aRew, 'Mint');

    const userBalanceAfterDeposit = await rew.balanceOf(key.address);
    const userATokenBalanceAfterDeposit = await aRew.balanceOf(key.address);

    expect(userATokenBalanceAfterDeposit)
      .to.be.eq(
        userATokenBalanceBeforeDeposit.add(amount),
        'User aToken balance should be equal the amount deposited'
      )
      .and.gt('0', 'User aToken balance should be greater than zero');
    expect(userBalanceAfterDeposit).to.be.eq('0', 'Token balance should be zero');
    if (!txDeposit.blockNumber) {
      throw 'missing block number';
    }
    // Check all token rewards
    await checkRewards(key, aRew.address, txDeposit.blockNumber, shouldReward);
  };

  const claim = async (user: SignerWithAddress, skipRewardChecks?: boolean) => {
    skipRewardChecks = true;

    const { rew, aRew } = testEnv;

    // Claim all the rewards from aToken
    const txClaim = await aRew.connect(user.signer).claim(rew.address);
    await expect(Promise.resolve(txClaim)).to.emit(aRew, 'Claim');

    // Calculate expected rewards
    if (!txClaim.blockNumber) {
      throw 'Block number missing from tx';
    }

    if (!skipRewardChecks) {
      // Check all token rewards
      await checkRewards(user, aRew.address, txClaim.blockNumber, true);
    }
  };

  describe('Deposits: mints', async () => {
    it('User1 deposits Reward Aware Token to Lending Pool', async () => {
      const {
        users: [user1],
      } = testEnv;

      await mintAndDeposit(user1);
    });

    it('Other users deposits Reward Aware Token to Lending Pool', async () => {
      const {
        users: [, user2, user3, user4],
      } = testEnv;

      await mintAndDeposit(user2);
      await mintAndDeposit(user3);
      await mintAndDeposit(user4);
    });

    it('User1 deposits multiple time Reward Aware Token to Lending Pool', async () => {
      const {
        users: [user1],
      } = testEnv;

      await mintAndDeposit(user1, false, parseEther('2'));
      await mintAndDeposit(user1, true, parseEther('12'));
    });
  });
  describe('Withdrawals: burns', async () => {
    it('User1 deposits Reward Aware Token to Lending Pool', async () => {
      const {
        users: [user1],
        aRew,
        rew,
        pool,
      } = testEnv;

      // Deposits
      await mintAndDeposit(user1);

      // Burn/Withdraw
      await aRew.approve(pool.address, MAX_UINT_AMOUNT);
      await pool.connect(user1.signer).withdraw(rew.address, MAX_UINT_AMOUNT, user1.address);
    });
  });
  describe('Claim rewards', async () => {
    it('User1 claims 100% portion of REW via the aToken contract', async () => {
      const {
        users: [user1],
        rew,
        aRew,
      } = testEnv;
      // User1 deposits
      await mintAndDeposit(user1);

      // Pass time to generate rewards
      await increaseTime(1000);

      // Check rewards for aToken at rew
      const token = await aRew.getRewardsTokenAddress('0');
      const aTokenRewards = await rew.getClaimableRewards(aRew.address);
      // Check rewards for user at aRew
      const userRewards = await aRew.getClaimableRewards(rew.address, user1.address);
      // Expect user rewards to be the same as aToken rewards due 100%
      expect(aTokenRewards).to.be.eq(
        userRewards,
        'Rewards should be the same due user holds 100% of RewardsAware distribution'
      );

      // Claims and check rewards
      await claim(user1);
    });

    it('Two users with half the portion of REW via the aToken contract', async () => {
      const {
        users: [user1, user2],
        rew,
        aRew,
      } = testEnv;
      // User1 and user2 deposits
      await mintAndDeposit(user1);
      await mintAndDeposit(user2);

      // Pass time to generate rewards
      await increaseTime(1000);

      // Check rewards for aToken at rew
      const aTokenRewards = await rew.getClaimableRewards(aRew.address);

      // Check rewards for user1 at aRew
      const user1Rewards = await aRew.getClaimableRewards(rew.address, user1.address);

      // Check rewards for user2 at aRew
      const user2Rewards = await aRew.getClaimableRewards(rew.address, user2.address);

      // Expect user rewards to be the same as aToken rewards
      expect(aTokenRewards).to.be.eq(
        user1Rewards.add(user2Rewards),
        'Rewards should be the same of all users of RewardsAware distribution'
      );

      // Claims and check rewards
      await claim(user1);
      await claim(user2);
    });

    it('Four users with different portions of REW via the aToken contract', async () => {
      const {
        users: [user1, user2, user3, user4],
        rew,
        aRew,
      } = testEnv;
      // Deposits
      await mintAndDeposit(user1, false, parseEther('1'));
      await mintAndDeposit(user2, false, parseEther('2.5'));
      await mintAndDeposit(user3, false, parseEther('4.7'));
      await mintAndDeposit(user4, false, parseEther('0.31'));

      // Pass time to generate rewards
      await increaseTime(1000);

      // Claims and check rewards
      await claim(user1);
      await claim(user2);
      await claim(user3);
      await claim(user4);

      // Pass time to generate rewards
      await increaseTime(2713);

      // Claims and check rewards
      await claim(user1);
      await claim(user2);
      await claim(user3);
      await claim(user4);
    });

    it('Two users with half the portion of REW via the aToken contract, one burns and them claims', async () => {
      const {
        users: [user1, user2],
        rew,
        aRew,
        pool,
      } = testEnv;

      // User1 and user2 deposits
      await mintAndDeposit(user1, false, parseEther('1000'));
      await mintAndDeposit(user2, false, parseEther('1000'));

      // Pass time to generate rewards
      await increaseTime(1000);

      // Claims and check rewards
      await claim(user1);
      await claim(user2);

      // Pass time to generate rewards
      await increaseTime(1000);

      // Burn/Withdraw to update current lifetime rewards state
      await aRew.approve(pool.address, MAX_UINT_AMOUNT);
      await pool.connect(user1.signer).withdraw(rew.address, MAX_UINT_AMOUNT, user1.address);

      // Claims
      await claim(user1);
      await claim(user2);
    });
  });
  describe('Getters', () => {
    describe('getClaimableRewards', () => {
      it('Rewards should be zero if user with no balance', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;

        const rewards = await aRew.getClaimableRewards(rew.address, user1.address);
        expect(rewards).eq('0', 'Rewards should be zero');
      });

      it('Rewards should be available after time travel', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;
        await mintAndDeposit(user1);

        // Pass time to generate rewards
        await increaseTime(1000);

        const rewards = await aRew.getClaimableRewards(rew.address, user1.address);
        expect(rewards).gt('0', 'Rewards should be greater than zero');
      });
    });
    describe('getUserLifetimeRewardsAccrued', () => {
      it('User lifetime rewards should be zero if no deposit', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;

        const rewards = await aRew.getUserRewardsAccrued(rew.address, user1.address);
        expect(rewards).eq('0', 'Rewards should be zero');
      });

      it('User lifetime rewards should be zero if deposit due state is not updated', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;
        await mintAndDeposit(user1);

        const rewards = await aRew.getUserRewardsAccrued(rew.address, user1.address);
        expect(rewards).eq('0', 'Rewards should be zero');
      });

      it('User should have some lifetime rewards  if deposit again due state is updated', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;
        await mintAndDeposit(user1);

        // Pass time to generate rewards
        await increaseTime(1000);

        await mintAndDeposit(user1, true);

        const rewards = await aRew.getUserRewardsAccrued(rew.address, user1.address);
        expect(rewards).gt('0', 'Rewards should be greater than zero');
      });

      it('User should have some lifetime rewards  if claims due state is updated', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;
        await mintAndDeposit(user1);

        // Pass time to generate rewards
        await increaseTime(1000);

        await claim(user1);

        const rewards = await aRew.getUserRewardsAccrued(rew.address, user1.address);
        expect(rewards).gt('0', 'Rewards should be greater than zero');
      });
    });

    describe('getUserIndex', () => {
      it('User index should be zero if no deposit', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;

        const rewards = await aRew.getUserIndex(rew.address, user1.address);
        expect(rewards).eq('0', 'Rewards should be zero');
      });

      it('User lifetime rewards should be zero if deposit due state is not updated', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;
        await mintAndDeposit(user1);

        const rewards = await aRew.getUserIndex(rew.address, user1.address);
        expect(rewards).eq('0', 'Rewards should be zero');
      });

      it('User should have some lifetime rewards  if deposit again due state is updated', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;
        await mintAndDeposit(user1);

        // Pass time to generate rewards
        await increaseTime(1000);

        await mintAndDeposit(user1, true);

        const rewards = await aRew.getUserIndex(rew.address, user1.address);
        expect(rewards).gt('0', 'Rewards should be greater than zero');
      });

      it('User should have some lifetime rewards  if claims due state is updated', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;
        await mintAndDeposit(user1);

        // Pass time to generate rewards
        await increaseTime(1000);

        await claim(user1);

        const rewards = await aRew.getUserIndex(rew.address, user1.address);
        expect(rewards).gt('0', 'Rewards should be greater than zero');
      });
    });
    describe('getUserClaimedRewards', () => {
      it('User should NOT have claimed rewards  if didnt claim', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;
        await mintAndDeposit(user1);

        // Pass time to generate rewards
        await increaseTime(1000);

        const rewards = await aRew.getUserIndex(rew.address, user1.address);
        expect(rewards).eq('0', 'Rewards should be zero');
      });

      it('User should have claimed rewards  if claims', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;
        await mintAndDeposit(user1);

        // Pass time to generate rewards
        await increaseTime(1000);

        await claim(user1);

        const rewards = await aRew.getUserIndex(rew.address, user1.address);
        expect(rewards).gt('0', 'Rewards should be greater than zero');
      });
    });
    describe('getLifetimeRewards', () => {
      it('The aToken Tifetime rewards should be zero if there is no deposits', async () => {
        const { aRew, rew } = testEnv;

        const rewards = await aRew.getLifetimeRewards(rew.address);
        expect(rewards).eq('0', 'Rewards should be zero');
      });

      it('The aToken lifetime rewards should be zero at init', async () => {
        const { aRew, rew } = testEnv;

        const rewards = await aRew.getLifetimeRewards(rew.address);
        expect(rewards).eq('0', 'Rewards should be zero');
      });

      it('The aToken lifetime rewards should update if there is further actions: deposit', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;
        await mintAndDeposit(user1);

        // Pass time to generate rewards
        await increaseTime(1000);

        // Deposit again to update current lifetime rewards state
        await mintAndDeposit(user1, true);

        const rewards = await aRew.getLifetimeRewards(rew.address);
        expect(rewards).gte('0', 'Rewards should be greater than zero');
      });

      it('The aToken lifetime rewards should update if there is further actions: claim', async () => {
        const {
          users: [user1],
          aRew,
          rew,
        } = testEnv;
        await mintAndDeposit(user1);

        // Pass time to generate rewards
        await increaseTime(1000);

        // Claim to update current lifetime rewards state
        await claim(user1);

        const rewards = await aRew.getLifetimeRewards(rew.address);
        expect(rewards).gte('0', 'Rewards should be greater than zero');
      });

      it('The aToken lifetime rewards should update if there is further actions: burn', async () => {
        const {
          users: [user1],
          aRew,
          rew,
          pool,
        } = testEnv;
        await mintAndDeposit(user1);

        // Pass time to generate rewards
        await increaseTime(1000);

        // Burn/Withdraw to update current lifetime rewards state
        await aRew.approve(pool.address, MAX_UINT_AMOUNT);
        await pool.connect(user1.signer).withdraw(rew.address, MAX_UINT_AMOUNT, user1.address);

        const rewards = await aRew.getLifetimeRewards(rew.address);
        expect(rewards).gte('0', 'Rewards should be greater than zero');
      });
    });
    describe('getRewardsToken', () => {
      it('The getter should return the current token reward address', async () => {
        const { aRew, rew } = testEnv;
        const rewardToken = await aRew.getRewardsTokenAddress(0);
        expect(rewardToken).to.be.equal(rew.address);
      });
    });
  });
});
