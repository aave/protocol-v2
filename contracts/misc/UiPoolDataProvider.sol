// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IUiPoolDataProvider} from './IUiPoolDataProvider.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {IERC20Detailed} from '../interfaces/IERC20Detailed.sol';
import {IPriceOracleGetter} from '../interfaces/IPriceOracleGetter.sol';
import {IAToken} from '../tokenization/interfaces/IAToken.sol';
import {IVariableDebtToken} from '../tokenization/interfaces/IVariableDebtToken.sol';
import {IStableDebtToken} from '../tokenization/interfaces/IStableDebtToken.sol';

import {WadRayMath} from '../libraries/math/WadRayMath.sol';
import {ReserveConfiguration} from '../libraries/configuration/ReserveConfiguration.sol';
import {UserConfiguration} from '../libraries/configuration/UserConfiguration.sol';
import '../lendingpool/DefaultReserveInterestRateStrategy.sol';

contract UiPoolDataProvider is IUiPoolDataProvider {
  using WadRayMath for uint256;
  using ReserveConfiguration for ReserveConfiguration.Map;
  using UserConfiguration for UserConfiguration.Map;

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

  function getReservesData(ILendingPoolAddressesProvider provider, address user)
    external
    override
    view
    returns (
      AggregatedReserveData[] memory,
      UserReserveData[] memory,
      uint256
    )
  {
    ILendingPool lendingPool = ILendingPool(provider.getLendingPool());
    IPriceOracleGetter oracle = IPriceOracleGetter(provider.getPriceOracle());
    address[] memory reserves = lendingPool.getReservesList();
    UserConfiguration.Map memory userConfig = lendingPool.getUserConfiguration(user);

    AggregatedReserveData[] memory reservesData = new AggregatedReserveData[](reserves.length);
    UserReserveData[] memory userReservesData = new UserReserveData[](
      user != address(0) ? reserves.length : 0
    );

    for (uint256 i = 0; i < reserves.length; i++) {
      AggregatedReserveData memory reserveData = reservesData[i];
      reserveData.underlyingAsset = reserves[i];

      // reserve current state
      reserveData.baseData = lendingPool.getReserveData(reserveData.underlyingAsset);
      reserveData.priceInEth = oracle.getAssetPrice(reserveData.underlyingAsset);

      reserveData.availableLiquidity = IERC20Detailed(reserveData.underlyingAsset).balanceOf(
        reserveData.baseData.aTokenAddress
      );
      (, reserveData.totalStableDebt, ) = IStableDebtToken(
        reserveData
          .baseData
          .stableDebtTokenAddress
      )
        .getSupplyData();
      reserveData.totalVariableDebt = IVariableDebtToken(
        reserveData
          .baseData
          .variableDebtTokenAddress
      )
        .totalSupply();
      uint256 totalBorrows = reserveData.totalStableDebt + reserveData.totalVariableDebt;
      reserveData.utilizationRate = totalBorrows == 0
        ? 0
        : totalBorrows.rayDiv(totalBorrows + reserveData.availableLiquidity);

      // reserve configuration

      // we're getting this info from the aToken, because some of assets can be not compliant with ETC20Detailed
      reserveData.symbol = IERC20Detailed(reserveData.baseData.aTokenAddress).symbol();
      reserveData.name = '';

      (
        reserveData.ltv,
        reserveData.liquidationThreshold,
        reserveData.liquidationBonus,
        reserveData.decimals,
        reserveData.reserveFactor
      ) = reserveData.baseData.configuration.getParamsMemory();
      (
        reserveData.isActive,
        reserveData.isFrozen,
        reserveData.borrowingEnabled,
        reserveData.stableBorrowRateEnabled
      ) = reserveData.baseData.configuration.getFlagsMemory();
      reserveData.usageAsCollateralEnabled = reserveData.ltv != 0;
      (
        reserveData.variableRateSlope1,
        reserveData.variableRateSlope2,
        reserveData.stableRateSlope1,
        reserveData.stableRateSlope2
      ) = getInterestRateStrategySlopes(
        DefaultReserveInterestRateStrategy(reserveData.baseData.interestRateStrategyAddress)
      );

      if (user != address(0)) {
        // user reserve data
        userReservesData[i].underlyingAsset = reserveData.underlyingAsset;
        userReservesData[i].scaledATokenBalance = IAToken(reserveData.baseData.aTokenAddress)
          .scaledBalanceOf(user);
        userReservesData[i].usageAsCollateralEnabledOnUser = userConfig.isUsingAsCollateral(i);

        if (userConfig.isBorrowing(i)) {
          userReservesData[i].scaledVariableDebt = IVariableDebtToken(
            reserveData
              .baseData
              .variableDebtTokenAddress
          )
            .scaledBalanceOf(user);
          userReservesData[i].principalStableDebt = IStableDebtToken(
            reserveData
              .baseData
              .stableDebtTokenAddress
          )
            .principalBalanceOf(user);
          if (userReservesData[i].principalStableDebt != 0) {
            userReservesData[i].stableBorrowRate = IStableDebtToken(
              reserveData
                .baseData
                .stableDebtTokenAddress
            )
              .getUserStableRate(user);
            userReservesData[i].stableBorrowLastUpdateTimestamp = IStableDebtToken(
              reserveData
                .baseData
                .stableDebtTokenAddress
            )
              .getUserLastUpdated(user);
          }
        }
      }
    }
    return (reservesData, userReservesData, oracle.getAssetPrice(MOCK_USD_ADDRESS));
  }
}
