// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IAaveIncentivesController} from '../interfaces/IAaveIncentivesController.sol';
import {IUiIncentiveDataProviderV3} from './interfaces/IUiIncentiveDataProviderV3.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {IAToken} from '../interfaces/IAToken.sol';
import {IVariableDebtToken} from '../interfaces/IVariableDebtToken.sol';
import {IStableDebtToken} from '../interfaces/IStableDebtToken.sol';
import {UserConfiguration} from '../protocol/libraries/configuration/UserConfiguration.sol';
import {DataTypes} from '../protocol/libraries/types/DataTypes.sol';
import {IERC20Detailed} from '../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {IERC20DetailedBytes} from './interfaces/IERC20DetailedBytes.sol';

contract UiIncentiveDataProviderV2V3 is IUiIncentiveDataProviderV3 {
  using UserConfiguration for DataTypes.UserConfigurationMap;

  address public constant MKRAddress = 0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2;

  constructor() public {}

  function getFullReservesIncentiveData(ILendingPoolAddressesProvider provider, address user)
    external
    view
    override
    returns (AggregatedReserveIncentiveData[] memory, UserReserveIncentiveData[] memory)
  {
    return (_getReservesIncentivesData(provider), _getUserReservesIncentivesData(provider, user));
  }

  function getReservesIncentivesData(ILendingPoolAddressesProvider provider)
    external
    view
    override
    returns (AggregatedReserveIncentiveData[] memory)
  {
    return _getReservesIncentivesData(provider);
  }

  function _getReservesIncentivesData(ILendingPoolAddressesProvider provider)
    private
    view
    returns (AggregatedReserveIncentiveData[] memory)
  {
    ILendingPool lendingPool = ILendingPool(provider.getLendingPool());
    address[] memory reserves = lendingPool.getReservesList();
    AggregatedReserveIncentiveData[] memory reservesIncentiveData =
      new AggregatedReserveIncentiveData[](reserves.length);

    for (uint256 i = 0; i < reserves.length; i++) {
      AggregatedReserveIncentiveData memory reserveIncentiveData = reservesIncentiveData[i];
      reserveIncentiveData.underlyingAsset = reserves[i];

      DataTypes.ReserveData memory baseData = lendingPool.getReserveData(reserves[i]);

      try IAToken(baseData.aTokenAddress).getIncentivesController() returns (
        IAaveIncentivesController aTokenIncentiveController
      ) {
        RewardInfo[] memory aRewardsInformation = new RewardInfo[](1);
        if (address(aTokenIncentiveController) != address(0)) {
          address aRewardToken = aTokenIncentiveController.REWARD_TOKEN();

          try aTokenIncentiveController.getAssetData(baseData.aTokenAddress) returns (
            uint256 aTokenIncentivesIndex,
            uint256 aEmissionPerSecond,
            uint256 aIncentivesLastUpdateTimestamp
          ) {
            aRewardsInformation[0] = RewardInfo(
              getSymbol(aRewardToken),
              aRewardToken,
              address(0),
              aEmissionPerSecond,
              aIncentivesLastUpdateTimestamp,
              aTokenIncentivesIndex,
              aTokenIncentiveController.DISTRIBUTION_END(),
              0,
              IERC20Detailed(aRewardToken).decimals(),
              aTokenIncentiveController.PRECISION(),
              0
            );
            reserveIncentiveData.aIncentiveData = IncentiveData(
              baseData.aTokenAddress,
              address(aTokenIncentiveController),
              aRewardsInformation
            );
          } catch (
            bytes memory /*lowLevelData*/
          ) {
            (
              uint256 aEmissionPerSecond,
              uint256 aIncentivesLastUpdateTimestamp,
              uint256 aTokenIncentivesIndex
            ) = aTokenIncentiveController.assets(baseData.aTokenAddress);
            aRewardsInformation[0] = RewardInfo(
              getSymbol(aRewardToken),
              aRewardToken,
              address(0),
              aEmissionPerSecond,
              aIncentivesLastUpdateTimestamp,
              aTokenIncentivesIndex,
              aTokenIncentiveController.DISTRIBUTION_END(),
              0,
              IERC20Detailed(aRewardToken).decimals(),
              aTokenIncentiveController.PRECISION(),
              0
            );

            reserveIncentiveData.aIncentiveData = IncentiveData(
              baseData.aTokenAddress,
              address(aTokenIncentiveController),
              aRewardsInformation
            );
          }
        }
      } catch (
        bytes memory /*lowLevelData*/
      ) {
        // Will not get here
      }

      try IStableDebtToken(baseData.stableDebtTokenAddress).getIncentivesController() returns (
        IAaveIncentivesController sTokenIncentiveController
      ) {
        RewardInfo[] memory sRewardsInformation = new RewardInfo[](1);
        if (address(sTokenIncentiveController) != address(0)) {
          address sRewardToken = sTokenIncentiveController.REWARD_TOKEN();
          try sTokenIncentiveController.getAssetData(baseData.stableDebtTokenAddress) returns (
            uint256 sTokenIncentivesIndex,
            uint256 sEmissionPerSecond,
            uint256 sIncentivesLastUpdateTimestamp
          ) {
            sRewardsInformation[0] = RewardInfo(
              getSymbol(sRewardToken),
              sRewardToken,
              address(0),
              sEmissionPerSecond,
              sIncentivesLastUpdateTimestamp,
              sTokenIncentivesIndex,
              sTokenIncentiveController.DISTRIBUTION_END(),
              0,
              IERC20Detailed(sRewardToken).decimals(),
              sTokenIncentiveController.PRECISION(),
              0
            );

            reserveIncentiveData.sIncentiveData = IncentiveData(
              baseData.stableDebtTokenAddress,
              address(sTokenIncentiveController),
              sRewardsInformation
            );
          } catch (
            bytes memory /*lowLevelData*/
          ) {
            (
              uint256 sEmissionPerSecond,
              uint256 sIncentivesLastUpdateTimestamp,
              uint256 sTokenIncentivesIndex
            ) = sTokenIncentiveController.assets(baseData.stableDebtTokenAddress);

            sRewardsInformation[0] = RewardInfo(
              getSymbol(sRewardToken),
              sRewardToken,
              address(0),
              sEmissionPerSecond,
              sIncentivesLastUpdateTimestamp,
              sTokenIncentivesIndex,
              sTokenIncentiveController.DISTRIBUTION_END(),
              0,
              IERC20Detailed(sRewardToken).decimals(),
              sTokenIncentiveController.PRECISION(),
              0
            );

            reserveIncentiveData.sIncentiveData = IncentiveData(
              baseData.stableDebtTokenAddress,
              address(sTokenIncentiveController),
              sRewardsInformation
            );
          }
        }
      } catch (
        bytes memory /*lowLevelData*/
      ) {
        // Will not get here
      }

      try IVariableDebtToken(baseData.variableDebtTokenAddress).getIncentivesController() returns (
        IAaveIncentivesController vTokenIncentiveController
      ) {
        RewardInfo[] memory vRewardsInformation = new RewardInfo[](1);
        if (address(vTokenIncentiveController) != address(0)) {
          address vRewardToken = vTokenIncentiveController.REWARD_TOKEN();

          try vTokenIncentiveController.getAssetData(baseData.variableDebtTokenAddress) returns (
            uint256 vTokenIncentivesIndex,
            uint256 vEmissionPerSecond,
            uint256 vIncentivesLastUpdateTimestamp
          ) {
            vRewardsInformation[0] = RewardInfo(
              getSymbol(vRewardToken),
              vRewardToken,
              address(0),
              vEmissionPerSecond,
              vIncentivesLastUpdateTimestamp,
              vTokenIncentivesIndex,
              vTokenIncentiveController.DISTRIBUTION_END(),
              0,
              IERC20Detailed(vRewardToken).decimals(),
              vTokenIncentiveController.PRECISION(),
              0
            );

            reserveIncentiveData.vIncentiveData = IncentiveData(
              baseData.variableDebtTokenAddress,
              address(vTokenIncentiveController),
              vRewardsInformation
            );
          } catch (
            bytes memory /*lowLevelData*/
          ) {
            (
              uint256 vEmissionPerSecond,
              uint256 vIncentivesLastUpdateTimestamp,
              uint256 vTokenIncentivesIndex
            ) = vTokenIncentiveController.assets(baseData.variableDebtTokenAddress);

            vRewardsInformation[0] = RewardInfo(
              getSymbol(vRewardToken),
              vRewardToken,
              address(0),
              vEmissionPerSecond,
              vIncentivesLastUpdateTimestamp,
              vTokenIncentivesIndex,
              vTokenIncentiveController.DISTRIBUTION_END(),
              0,
              IERC20Detailed(vRewardToken).decimals(),
              vTokenIncentiveController.PRECISION(),
              0
            );

            reserveIncentiveData.vIncentiveData = IncentiveData(
              baseData.variableDebtTokenAddress,
              address(vTokenIncentiveController),
              vRewardsInformation
            );
          }
        }
      } catch (
        bytes memory /*lowLevelData*/
      ) {
        // Will not get here
      }
    }
    return (reservesIncentiveData);
  }

  function getUserReservesIncentivesData(ILendingPoolAddressesProvider provider, address user)
    external
    view
    override
    returns (UserReserveIncentiveData[] memory)
  {
    return _getUserReservesIncentivesData(provider, user);
  }

  function _getUserReservesIncentivesData(ILendingPoolAddressesProvider provider, address user)
    private
    view
    returns (UserReserveIncentiveData[] memory)
  {
    ILendingPool lendingPool = ILendingPool(provider.getLendingPool());
    address[] memory reserves = lendingPool.getReservesList();

    UserReserveIncentiveData[] memory userReservesIncentivesData =
      new UserReserveIncentiveData[](user != address(0) ? reserves.length : 0);

    for (uint256 i = 0; i < reserves.length; i++) {
      DataTypes.ReserveData memory baseData = lendingPool.getReserveData(reserves[i]);

      // user reserve data
      userReservesIncentivesData[i].underlyingAsset = reserves[i];

      try IAToken(baseData.aTokenAddress).getIncentivesController() returns (
        IAaveIncentivesController aTokenIncentiveController
      ) {
        if (address(aTokenIncentiveController) != address(0)) {
          UserRewardInfo[] memory aUserRewardsInformation = new UserRewardInfo[](1);

          address aRewardToken = aTokenIncentiveController.REWARD_TOKEN();

          aUserRewardsInformation[0] = UserRewardInfo(
            getSymbol(aRewardToken),
            address(0),
            aRewardToken,
            aTokenIncentiveController.getUserUnclaimedRewards(user),
            aTokenIncentiveController.getUserAssetData(user, baseData.aTokenAddress),
            0,
            0,
            IERC20Detailed(aRewardToken).decimals()
          );

          userReservesIncentivesData[i].aTokenIncentivesUserData = UserIncentiveData(
            baseData.aTokenAddress,
            address(aTokenIncentiveController),
            aUserRewardsInformation
          );
        }
      } catch (
        bytes memory /*lowLevelData*/
      ) {}

      try IVariableDebtToken(baseData.variableDebtTokenAddress).getIncentivesController() returns (
        IAaveIncentivesController vTokenIncentiveController
      ) {
        if (address(vTokenIncentiveController) != address(0)) {
          UserRewardInfo[] memory vUserRewardsInformation = new UserRewardInfo[](1);

          address vRewardToken = vTokenIncentiveController.REWARD_TOKEN();

          vUserRewardsInformation[0] = UserRewardInfo(
            getSymbol(vRewardToken),
            address(0),
            vRewardToken,
            vTokenIncentiveController.getUserUnclaimedRewards(user),
            vTokenIncentiveController.getUserAssetData(user, baseData.variableDebtTokenAddress),
            0,
            0,
            IERC20Detailed(vRewardToken).decimals()
          );

          userReservesIncentivesData[i].vTokenIncentivesUserData = UserIncentiveData(
            baseData.variableDebtTokenAddress,
            address(vTokenIncentiveController),
            vUserRewardsInformation
          );
        }
      } catch (
        bytes memory /*lowLevelData*/
      ) {}

      try IStableDebtToken(baseData.stableDebtTokenAddress).getIncentivesController() returns (
        IAaveIncentivesController sTokenIncentiveController
      ) {
        if (address(sTokenIncentiveController) != address(0)) {
          UserRewardInfo[] memory sUserRewardsInformation = new UserRewardInfo[](1);

          address sRewardToken = sTokenIncentiveController.REWARD_TOKEN();

          sUserRewardsInformation[0] = UserRewardInfo(
            getSymbol(sRewardToken),
            address(0),
            sRewardToken,
            sTokenIncentiveController.getUserUnclaimedRewards(user),
            sTokenIncentiveController.getUserAssetData(user, baseData.stableDebtTokenAddress),
            0,
            0,
            IERC20Detailed(sRewardToken).decimals()
          );

          userReservesIncentivesData[i].sTokenIncentivesUserData = UserIncentiveData(
            baseData.stableDebtTokenAddress,
            address(sTokenIncentiveController),
            sUserRewardsInformation
          );
        }
      } catch (
        bytes memory /*lowLevelData*/
      ) {}
    }

    return (userReservesIncentivesData);
  }

  function getSymbol(address rewardToken) public view returns (string memory) {
    if (address(rewardToken) == address(MKRAddress)) {
      bytes32 symbol = IERC20DetailedBytes(rewardToken).symbol();
      return bytes32ToString(symbol);
    } else {
      return IERC20Detailed(rewardToken).symbol();
    }
  }

  function bytes32ToString(bytes32 _bytes32) public pure returns (string memory) {
    uint8 i = 0;
    while (i < 32 && _bytes32[i] != 0) {
      i++;
    }
    bytes memory bytesArray = new bytes(i);
    for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
      bytesArray[i] = _bytes32[i];
    }
    return string(bytesArray);
  }
}
