import { expect } from 'chai';
import { calcExpectedRewards } from '../utils/calculations';
import { SignerWithAddress } from '../make-suite';
import { ZERO_ADDRESS } from '../../../../helpers/constants';
import { tEthereumAddress } from '../../../../helpers/types';
import { IERC20Factory } from '../../../../types/IERC20Factory';
import { getRewardsAToken } from '../../../../helpers/contracts-getters';
import { BigNumber as EthersBigNumber } from '@ethersproject/bignumber';
import BigNumber from 'bignumber.js';
import '../utils/math';

export const checkRewards = async (
  user: SignerWithAddress,
  aToken: tEthereumAddress,
  block: number,
  shouldReward?: boolean,
  claimedToken?: tEthereumAddress,
  beforeBalanceClaimedToken?: EthersBigNumber
) => {
  const rewardAwareToken = await getRewardsAToken(aToken);
  const rewardsAvailable = await rewardAwareToken.getRewardsTokenAddressList();
  const userBalance = await rewardAwareToken.balanceOf(user.address, { blockTag: block - 1 });
  const totalRewardsBefore = new Array(rewardsAvailable.length);
  const userRewardsBefore = new Array(rewardsAvailable.length);
  const userIndexesBefore = new Array(rewardsAvailable.length);

  const totalRewardsAfter = new Array(rewardsAvailable.length);
  const userRewardsAfter = new Array(rewardsAvailable.length);
  const userIndexesAfter = new Array(rewardsAvailable.length);
  const userExpectedRewards = new Array(rewardsAvailable.length);

  for (let i = 0; i < rewardsAvailable.length; i++) {
    if (rewardsAvailable[i] == ZERO_ADDRESS) break;
    // Before action

    totalRewardsBefore[i] = await rewardAwareToken.getLifetimeRewards(rewardsAvailable[i], {
      blockTag: block - 1,
    });

    userRewardsBefore[i] = await rewardAwareToken.getUserRewardsAccrued(
      rewardsAvailable[i],
      user.address,
      {
        blockTag: block - 1,
      }
    );

    userIndexesBefore[i] = await rewardAwareToken.getUserIndex(rewardsAvailable[i], user.address, {
      blockTag: block - 1,
    });
    // After action
    totalRewardsAfter[i] = await rewardAwareToken.getLifetimeRewards(rewardsAvailable[i], {
      blockTag: block,
    });

    userRewardsAfter[i] = await rewardAwareToken.getUserRewardsAccrued(
      rewardsAvailable[i],
      user.address,
      {
        blockTag: block,
      }
    );

    userIndexesAfter[i] = await rewardAwareToken.getUserIndex(rewardsAvailable[i], user.address, {
      blockTag: block,
    });

    userExpectedRewards[i] = calcExpectedRewards(
      userBalance,
      userIndexesAfter[i],
      userIndexesBefore[i]
    );

    // Explicit check rewards when the test case expects rewards to the user
    if (shouldReward) {
      expect(userRewardsAfter[i]).to.be.gt('0');
      expect(userRewardsAfter[i]).to.eq(
        userRewardsBefore[i].add(userExpectedRewards[i]),
        `User rewards for token ${rewardsAvailable[i]} does not match`
      );
      if (beforeBalanceClaimedToken && rewardsAvailable[i] === claimedToken) {
        const reserveFactor = await rewardAwareToken.getRewardsReserveFactor();
        const totalRewards = userRewardsBefore[i].add(userExpectedRewards[i]);
        const priorClaimed = await rewardAwareToken.getUserClaimedRewards(
          claimedToken,
          user.address,
          {
            blockTag: block - 1,
          }
        );
        const totalClaim = totalRewards.sub(priorClaimed);
        const treasureRewards = EthersBigNumber.from(
          new BigNumber(totalClaim.toString())
            .percentMul(new BigNumber(reserveFactor.toString()))
            .toString()
        );
        const userRewards = totalClaim.sub(treasureRewards);

        const afterBalance = await IERC20Factory.connect(claimedToken, user.signer).balanceOf(
          user.address
        );

        expect(afterBalance).to.be.eq(beforeBalanceClaimedToken.add(userRewards));
      }
    } else {
      expect(userExpectedRewards[i]).to.be.eq('0', 'This action should not reward');
      expect(userRewardsBefore[i]).to.be.eq(userRewardsAfter[i], 'Rewards should stay the same');
    }
  }
};
