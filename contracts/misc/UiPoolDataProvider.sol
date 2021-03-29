// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20Detailed} from '../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IAaveIncentivesController} from '../interfaces/IAaveIncentivesController.sol';
import {IUiPoolDataProvider} from './interfaces/IUiPoolDataProvider.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {IPriceOracleGetter} from '../interfaces/IPriceOracleGetter.sol';
import {IAToken} from '../interfaces/IAToken.sol';
import {IVariableDebtToken} from '../interfaces/IVariableDebtToken.sol';
import {IStableDebtToken} from '../interfaces/IStableDebtToken.sol';
import {WadRayMath} from '../protocol/libraries/math/WadRayMath.sol';
import {ReserveConfiguration} from '../protocol/libraries/configuration/ReserveConfiguration.sol';
import {UserConfiguration} from '../protocol/libraries/configuration/UserConfiguration.sol';
import {DataTypes} from '../protocol/libraries/types/DataTypes.sol';
import {
  DefaultReserveInterestRateStrategy
} from '../protocol/lendingpool/DefaultReserveInterestRateStrategy.sol';

contract UiPoolDataProvider is IUiPoolDataProvider {
  using WadRayMath for uint256;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using UserConfiguration for DataTypes.UserConfigurationMap;

  address public constant MOCK_USD_ADDRESS = 0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96;

  function getInterestRateStrategySlopes(DefaultReserveInterestRateStrategy interestRateStrategy)
    internal
    view
    returns (
      uint256,
      uint256,
      uint256,
      uint256
    )
  {
    return (
      interestRateStrategy.variableRateSlope1(),
      interestRateStrategy.variableRateSlope2(),
      interestRateStrategy.stableRateSlope1(),
      interestRateStrategy.stableRateSlope2()
    );
  }

  function getReservesData(
    ILendingPoolAddressesProvider provider,
    IAaveIncentivesController incentivesController,
    address user
  )
    external
    view
    override
    returns (
      AggregatedReserveData[] memory,
      UserReserveData[] memory,
      uint256,
      IncentivesDataUser memory
    )
  {
    ILendingPool lendingPool = ILendingPool(provider.getLendingPool());
    IPriceOracleGetter oracle = IPriceOracleGetter(provider.getPriceOracle());
    address[] memory reserves = lendingPool.getReservesList();
    DataTypes.UserConfigurationMap memory userConfig = lendingPool.getUserConfiguration(user);

    AggregatedReserveData[] memory reservesData = new AggregatedReserveData[](reserves.length);
    UserReserveData[] memory userReservesData =
      new UserReserveData[](user != address(0) ? reserves.length : 0);

    for (uint256 i = 0; i < reserves.length; i++) {
      AggregatedReserveData memory reserveData = reservesData[i];
      reserveData.underlyingAsset = reserves[i];

      // reserve current state
      DataTypes.ReserveData memory baseData =
        lendingPool.getReserveData(reserveData.underlyingAsset);
      reserveData.liquidityIndex = baseData.liquidityIndex;
      reserveData.variableBorrowIndex = baseData.variableBorrowIndex;
      reserveData.liquidityRate = baseData.currentLiquidityRate;
      reserveData.variableBorrowRate = baseData.currentVariableBorrowRate;
      reserveData.stableBorrowRate = baseData.currentStableBorrowRate;
      reserveData.lastUpdateTimestamp = baseData.lastUpdateTimestamp;
      reserveData.aTokenAddress = baseData.aTokenAddress;
      reserveData.stableDebtTokenAddress = baseData.stableDebtTokenAddress;
      reserveData.variableDebtTokenAddress = baseData.variableDebtTokenAddress;
      reserveData.interestRateStrategyAddress = baseData.interestRateStrategyAddress;
      reserveData.priceInEth = oracle.getAssetPrice(reserveData.underlyingAsset);

      reserveData.availableLiquidity = IERC20Detailed(reserveData.underlyingAsset).balanceOf(
        reserveData.aTokenAddress
      );
      (
        reserveData.totalPrincipalStableDebt,
        ,
        reserveData.averageStableRate,
        reserveData.stableDebtLastUpdateTimestamp
      ) = IStableDebtToken(reserveData.stableDebtTokenAddress).getSupplyData();
      reserveData.totalScaledVariableDebt = IVariableDebtToken(reserveData.variableDebtTokenAddress)
        .scaledTotalSupply();

      // reserve configuration

      // we're getting this info from the aToken, because some of assets can be not compliant with ETC20Detailed
      reserveData.symbol = IERC20Detailed(reserveData.aTokenAddress).symbol();
      reserveData.name = '';

      (
        reserveData.baseLTVasCollateral,
        reserveData.reserveLiquidationThreshold,
        reserveData.reserveLiquidationBonus,
        reserveData.decimals,
        reserveData.reserveFactor
      ) = baseData.configuration.getParamsMemory();
      (
        reserveData.isActive,
        reserveData.isFrozen,
        reserveData.borrowingEnabled,
        reserveData.stableBorrowRateEnabled
      ) = baseData.configuration.getFlagsMemory();
      reserveData.usageAsCollateralEnabled = reserveData.baseLTVasCollateral != 0;
      (
        reserveData.variableRateSlope1,
        reserveData.variableRateSlope2,
        reserveData.stableRateSlope1,
        reserveData.stableRateSlope2
      ) = getInterestRateStrategySlopes(
        DefaultReserveInterestRateStrategy(reserveData.interestRateStrategyAddress)
      );

      // incentives
      // IncentivesAssetData memory aTokenIncentives = incentivesController.assets(reserveData.aTokenAddress);
      reserveData.aEmissionPerSecond = incentivesController
        .assets(reserveData.aTokenAddress)
        .emissionPerSecond;
      reserveData.aIncentivesLastUpdateTimestamp = incentivesController
        .assets(reserveData.aTokenAddress)
        .lastUpdateTimestamp;
      reserveData.aTokenIncentivesIndex = incentivesController
        .assets(reserveData.aTokenAddress)
        .index;

      // IncentivesAssetData memory sTokenIncentives = incentivesController.assets(reserveData.stableDebtTokenAddress);
      reserveData.sEmissionPerSecond = incentivesController
        .assets(reserveData.stableDebtTokenAddress)
        .emissionPerSecond;
      reserveData.sIncentivesLastUpdateTimestamp = incentivesController
        .assets(reserveData.stableDebtTokenAddress)
        .lastUpdateTimestamp;
      reserveData.sTokenIncentivesIndex = incentivesController
        .assets(reserveData.stableDebtTokenAddress)
        .index;

      // IncentivesAssetData memory vTokenIncentives = incentivesController.assets(reserveData.variableDebtTokenAddress);
      reserveData.vEmissionPerSecond = incentivesController
        .assets(reserveData.variableDebtTokenAddress)
        .emissionPerSecond;
      reserveData.vIncentivesLastUpdateTimestamp = incentivesController
        .assets(reserveData.variableDebtTokenAddress)
        .lastUpdateTimestamp;
      reserveData.vTokenIncentivesIndex = incentivesController
        .assets(reserveData.variableDebtTokenAddress)
        .index;

      if (user != address(0)) {
        // incentives
        // userIncentives.incentivesLastUpdated =
        userReservesData[i].aTokenincentivesUserIndex = incentivesController.getUserAssetData(
          user,
          reserveData.aTokenAddress
        );
        userReservesData[i].sTokenincentivesUserIndex = incentivesController.getUserAssetData(
          user,
          reserveData.stableDebtTokenAddress
        );
        userReservesData[i].vTokenincentivesUserIndex = incentivesController.getUserAssetData(
          user,
          reserveData.variableDebtTokenAddress
        );
        // user reserve data
        userReservesData[i].underlyingAsset = reserveData.underlyingAsset;
        userReservesData[i].scaledATokenBalance = IAToken(reserveData.aTokenAddress)
          .scaledBalanceOf(user);
        userReservesData[i].usageAsCollateralEnabledOnUser = userConfig.isUsingAsCollateral(i);

        if (userConfig.isBorrowing(i)) {
          userReservesData[i].scaledVariableDebt = IVariableDebtToken(
            reserveData
              .variableDebtTokenAddress
          )
            .scaledBalanceOf(user);
          userReservesData[i].principalStableDebt = IStableDebtToken(
            reserveData
              .stableDebtTokenAddress
          )
            .principalBalanceOf(user);
          if (userReservesData[i].principalStableDebt != 0) {
            userReservesData[i].stableBorrowRate = IStableDebtToken(
              reserveData
                .stableDebtTokenAddress
            )
              .getUserStableRate(user);
            userReservesData[i].stableBorrowLastUpdateTimestamp = IStableDebtToken(
              reserveData
                .stableDebtTokenAddress
            )
              .getUserLastUpdated(user);
          }
        }
      }
    }

    IncentivesDataUser memory incentivesDataUser;
    if (user != address(0)) {
      incentivesDataUser.userUnclaimedRewards = incentivesController.getUserUnclaimedRewards(user);
      incentivesDataUser.rewardToken = incentivesController.REWARD_TOKEN();
      incentivesDataUser.precision = incentivesController.PRECISION();
      incentivesDataUser.rewardTokenDecimals = IERC20Detailed(incentivesDataUser.rewardToken)
        .decimals();
      incentivesDataUser.rewardTokenPriceEth = oracle.getAssetPrice(incentivesDataUser.rewardToken);
    }

    return (
      reservesData,
      userReservesData,
      oracle.getAssetPrice(MOCK_USD_ADDRESS),
      incentivesDataUser
    );
  }
}
