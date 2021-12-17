// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';

interface IUiIncentiveDataProviderV3 {
  struct AggregatedReserveIncentiveData {
    address underlyingAsset;
    IncentiveData aIncentiveData;
    IncentiveData vIncentiveData;
    IncentiveData sIncentiveData;
  }

  struct IncentiveData {
    address tokenAddress;
    address incentiveControllerAddress;
    RewardInfo[] rewardsTokenInformation;
  }

  struct RewardInfo {
    string rewardTokenSymbol;
    address rewardTokenAddress;
    address rewardOracleAddress;
    uint256 emissionPerSecond;
    uint256 incentivesLastUpdateTimestamp;
    uint256 tokenIncentivesIndex;
    uint256 emissionEndTimestamp;
    int256 rewardPriceFeed;
    uint8 rewardTokenDecimals;
    uint8 precision;
    uint8 priceFeedDecimals;
  }

  struct UserReserveIncentiveData {
    address underlyingAsset;
    UserIncentiveData aTokenIncentivesUserData;
    UserIncentiveData vTokenIncentivesUserData;
    UserIncentiveData sTokenIncentivesUserData;
  }
  
  struct UserIncentiveData {
    address tokenAddress;
    address incentiveControllerAddress;
    UserRewardInfo[] userRewardsInformation;
  }
  
  struct UserRewardInfo {
    string rewardTokenSymbol;
    address rewardOracleAddress;
    address rewardTokenAddress;
    uint256 userUnclaimedRewards;
    uint256 tokenIncentivesUserIndex;
    int256 rewardPriceFeed;
    uint8 priceFeedDecimals;
    uint8 rewardTokenDecimals;

  }

  function getReservesIncentivesData(ILendingPoolAddressesProvider provider)
    external
    view
    returns (AggregatedReserveIncentiveData[] memory);

  function getUserReservesIncentivesData(ILendingPoolAddressesProvider provider, address user)
    external
    view
    returns (UserReserveIncentiveData[] memory);

  // generic method with full data
  function getFullReservesIncentiveData(ILendingPoolAddressesProvider provider, address user)
    external
    view
    returns (AggregatedReserveIncentiveData[] memory, UserReserveIncentiveData[] memory);
} 