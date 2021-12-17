// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IAaveIncentivesController} from '../interfaces/IAaveIncentivesController.sol';
import {IUiIncentiveDataProviderV2} from './interfaces/IUiIncentiveDataProviderV2.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {IAToken} from '../interfaces/IAToken.sol';
import {IVariableDebtToken} from '../interfaces/IVariableDebtToken.sol';
import {IStableDebtToken} from '../interfaces/IStableDebtToken.sol';
import {UserConfiguration} from '../protocol/libraries/configuration/UserConfiguration.sol';
import {DataTypes} from '../protocol/libraries/types/DataTypes.sol';
import {IERC20Detailed} from '../dependencies/openzeppelin/contracts/IERC20Detailed.sol';

contract UiIncentiveDataProviderV2 is IUiIncentiveDataProviderV2 {
  using UserConfiguration for DataTypes.UserConfigurationMap;

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

      try IStableDebtToken(baseData.aTokenAddress).getIncentivesController() returns (IAaveIncentivesController aTokenIncentiveController) {
        if (address(aTokenIncentiveController) != address(0)) {
          address aRewardToken = aTokenIncentiveController.REWARD_TOKEN();

          try aTokenIncentiveController.getAssetData(baseData.aTokenAddress) returns (
            uint256 aTokenIncentivesIndex,
            uint256 aEmissionPerSecond,
            uint256 aIncentivesLastUpdateTimestamp
          ) {
            reserveIncentiveData.aIncentiveData = IncentiveData(
              aEmissionPerSecond,
              aIncentivesLastUpdateTimestamp,
              aTokenIncentivesIndex,
              aTokenIncentiveController.DISTRIBUTION_END(),
              baseData.aTokenAddress,
              aRewardToken,
              address(aTokenIncentiveController),
              IERC20Detailed(aRewardToken).decimals(),
              aTokenIncentiveController.PRECISION()
            );
          } catch (bytes memory /*lowLevelData*/) {
            (
              uint256 aEmissionPerSecond,
              uint256 aIncentivesLastUpdateTimestamp,
              uint256 aTokenIncentivesIndex
            ) = aTokenIncentiveController.assets(baseData.aTokenAddress);

            reserveIncentiveData.aIncentiveData = IncentiveData(
              aEmissionPerSecond,
              aIncentivesLastUpdateTimestamp,
              aTokenIncentivesIndex,
              aTokenIncentiveController.DISTRIBUTION_END(),
              baseData.aTokenAddress,
              aRewardToken,
              address(aTokenIncentiveController),
              IERC20Detailed(aRewardToken).decimals(),
              aTokenIncentiveController.PRECISION()
            );
          } 
        }
      } catch(bytes memory /*lowLevelData*/) {
        // Will not get here
      } 

      try IStableDebtToken(baseData.stableDebtTokenAddress).getIncentivesController() returns (IAaveIncentivesController sTokenIncentiveController) {
        if (address(sTokenIncentiveController) != address(0)) {

          address sRewardToken = sTokenIncentiveController.REWARD_TOKEN();
          try sTokenIncentiveController.getAssetData(baseData.stableDebtTokenAddress) returns (
            uint256 sTokenIncentivesIndex,
            uint256 sEmissionPerSecond,
            uint256 sIncentivesLastUpdateTimestamp
          ) {
            reserveIncentiveData.sIncentiveData = IncentiveData(
              sEmissionPerSecond,
              sIncentivesLastUpdateTimestamp,
              sTokenIncentivesIndex,
              sTokenIncentiveController.DISTRIBUTION_END(),
              baseData.stableDebtTokenAddress,
              sRewardToken,
              address(sTokenIncentiveController),
              IERC20Detailed(sRewardToken).decimals(),
              sTokenIncentiveController.PRECISION()
            );
          } catch (bytes memory /*lowLevelData*/) {
            (
              uint256 sEmissionPerSecond,
              uint256 sIncentivesLastUpdateTimestamp,
              uint256 sTokenIncentivesIndex
            ) = sTokenIncentiveController.assets(baseData.stableDebtTokenAddress);

            reserveIncentiveData.sIncentiveData = IncentiveData(
              sEmissionPerSecond,
              sIncentivesLastUpdateTimestamp,
              sTokenIncentivesIndex,
              sTokenIncentiveController.DISTRIBUTION_END(),
              baseData.stableDebtTokenAddress,
              sRewardToken,
              address(sTokenIncentiveController),
              IERC20Detailed(sRewardToken).decimals(),
              sTokenIncentiveController.PRECISION()
            );
          } 
        }
      } catch(bytes memory /*lowLevelData*/) {
        // Will not get here
      }

      try IStableDebtToken(baseData.variableDebtTokenAddress).getIncentivesController() returns (IAaveIncentivesController vTokenIncentiveController) {
        if (address(vTokenIncentiveController) != address(0)) {
          address vRewardToken = vTokenIncentiveController.REWARD_TOKEN();

          try vTokenIncentiveController.getAssetData(baseData.variableDebtTokenAddress) returns (
            uint256 vTokenIncentivesIndex,
            uint256 vEmissionPerSecond,
            uint256 vIncentivesLastUpdateTimestamp
          ) {
            reserveIncentiveData.vIncentiveData = IncentiveData(
              vEmissionPerSecond,
              vIncentivesLastUpdateTimestamp,
              vTokenIncentivesIndex,
              vTokenIncentiveController.DISTRIBUTION_END(),
              baseData.variableDebtTokenAddress,
              vRewardToken,
              address(vTokenIncentiveController),
              IERC20Detailed(vRewardToken).decimals(),
              vTokenIncentiveController.PRECISION()
            );
          } catch (bytes memory /*lowLevelData*/) {
            (
              uint256 vEmissionPerSecond,
              uint256 vIncentivesLastUpdateTimestamp,
              uint256 vTokenIncentivesIndex
            ) = vTokenIncentiveController.assets(baseData.variableDebtTokenAddress);

            reserveIncentiveData.vIncentiveData = IncentiveData(
              vEmissionPerSecond,
              vIncentivesLastUpdateTimestamp,
              vTokenIncentivesIndex,
              vTokenIncentiveController.DISTRIBUTION_END(),
              baseData.variableDebtTokenAddress,
              vRewardToken,
              address(vTokenIncentiveController),
              IERC20Detailed(vRewardToken).decimals(),
              vTokenIncentiveController.PRECISION()
            );
          }
        }
      } catch(bytes memory /*lowLevelData*/) {
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

      IUiIncentiveDataProviderV2.UserIncentiveData memory aUserIncentiveData;

      try IAToken(baseData.aTokenAddress).getIncentivesController() returns (IAaveIncentivesController aTokenIncentiveController) {
        if (address(aTokenIncentiveController) != address(0)) {
          address aRewardToken = aTokenIncentiveController.REWARD_TOKEN();
          aUserIncentiveData.tokenincentivesUserIndex = aTokenIncentiveController.getUserAssetData(
            user,
            baseData.aTokenAddress
          );
          aUserIncentiveData.userUnclaimedRewards = aTokenIncentiveController.getUserUnclaimedRewards(
            user
          );
          aUserIncentiveData.tokenAddress = baseData.aTokenAddress;
          aUserIncentiveData.rewardTokenAddress = aRewardToken;
          aUserIncentiveData.incentiveControllerAddress = address(aTokenIncentiveController);
          aUserIncentiveData.rewardTokenDecimals = IERC20Detailed(aRewardToken).decimals();
        }
      } catch (bytes memory /*lowLevelData*/) {

      }

      userReservesIncentivesData[i].aTokenIncentivesUserData = aUserIncentiveData;

      UserIncentiveData memory vUserIncentiveData;

      try IVariableDebtToken(baseData.variableDebtTokenAddress).getIncentivesController() returns(IAaveIncentivesController vTokenIncentiveController) {
        if (address(vTokenIncentiveController) != address(0)) {
          address vRewardToken = vTokenIncentiveController.REWARD_TOKEN();
          vUserIncentiveData.tokenincentivesUserIndex = vTokenIncentiveController.getUserAssetData(
            user,
            baseData.variableDebtTokenAddress
          );
          vUserIncentiveData.userUnclaimedRewards = vTokenIncentiveController.getUserUnclaimedRewards(
            user
          );
          vUserIncentiveData.tokenAddress = baseData.variableDebtTokenAddress;
          vUserIncentiveData.rewardTokenAddress = vRewardToken;
          vUserIncentiveData.incentiveControllerAddress = address(vTokenIncentiveController);
          vUserIncentiveData.rewardTokenDecimals = IERC20Detailed(vRewardToken).decimals();
        }
      } catch (bytes memory /*lowLevelData*/) {

      }

      userReservesIncentivesData[i].vTokenIncentivesUserData = vUserIncentiveData;

      UserIncentiveData memory sUserIncentiveData;

      try IStableDebtToken(baseData.stableDebtTokenAddress).getIncentivesController() returns (IAaveIncentivesController sTokenIncentiveController) {
        if (address(sTokenIncentiveController) != address(0)) {
          address sRewardToken = sTokenIncentiveController.REWARD_TOKEN();
          sUserIncentiveData.tokenincentivesUserIndex = sTokenIncentiveController.getUserAssetData(
            user,
            baseData.stableDebtTokenAddress
          );
          sUserIncentiveData.userUnclaimedRewards = sTokenIncentiveController.getUserUnclaimedRewards(
            user
          );
          sUserIncentiveData.tokenAddress = baseData.stableDebtTokenAddress;
          sUserIncentiveData.rewardTokenAddress = sRewardToken;
          sUserIncentiveData.incentiveControllerAddress = address(sTokenIncentiveController);
          sUserIncentiveData.rewardTokenDecimals = IERC20Detailed(sRewardToken).decimals();
        }
      } catch (bytes memory /*lowLevelData*/) {

      }

      userReservesIncentivesData[i].sTokenIncentivesUserData = sUserIncentiveData;
    }

    return (userReservesIncentivesData);
  }
}