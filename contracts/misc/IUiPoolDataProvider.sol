// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {ReserveLogic} from '../libraries/logic/ReserveLogic.sol';

interface IUiPoolDataProvider {
  struct AggregatedReserveData {
    address underlyingAsset;
    string name;
    string symbol;
    uint256 decimals;
    uint256 ltv;
    uint256 liquidationThreshold;
    uint256 liquidationBonus;
    uint256 reserveFactor;
    bool usageAsCollateralEnabled;
    bool borrowingEnabled;
    bool stableBorrowRateEnabled;
    bool isActive;
    bool isFrozen;
    ReserveLogic.ReserveData baseData;
    uint256 availableLiquidity;
    uint256 totalStableDebt;
    uint256 totalVariableDebt;
    uint256 utilizationRate;
    uint256 priceInEth;
    uint256 variableRateSlope1;
    uint256 variableRateSlope2;
    uint256 stableRateSlope1;
    uint256 stableRateSlope2;
  }
  //
  //  struct ReserveData {
  //    uint256 averageStableBorrowRate;
  //    uint256 totalLiquidity;
  //  }

  struct UserReserveData {
    address underlyingAsset;
    uint256 scaledATokenBalance;
    bool usageAsCollateralEnabledOnUser;
    uint256 stableBorrowRate;
    uint256 scaledVariableDebt;
    uint256 principalStableDebt;
    uint256 stableBorrowLastUpdateTimestamp;
  }

  //
  //  struct ATokenSupplyData {
  //    string name;
  //    string symbol;
  //    uint8 decimals;
  //    uint256 totalSupply;
  //    address aTokenAddress;
  //  }

  function getReservesData(ILendingPoolAddressesProvider provider, address user)
    external
    view
    returns (
      AggregatedReserveData[] memory,
      UserReserveData[] memory,
      uint256
    );

  //  function getUserReservesData(ILendingPoolAddressesProvider provider, address user)
  //    external
  //    view
  //    returns (UserReserveData[] memory);
  //
  //  function getAllATokenSupply(ILendingPoolAddressesProvider provider)
  //    external
  //    view
  //    returns (ATokenSupplyData[] memory);
  //
  //  function getATokenSupply(address[] calldata aTokens)
  //    external
  //    view
  //    returns (ATokenSupplyData[] memory);
}
