pragma solidity 0.6.12;

pragma experimental ABIEncoderV2;

import {DataTypes} from '../types/DataTypes.sol';
import {IVariableDebtToken} from '../../../interfaces/IVariableDebtToken.sol';

library CachingHelper {
  struct CachedData {
    uint256 oldScaledVariableDebt;
    uint256 oldTotalVariableDebt;
    uint256 newSscaledVariableDebt;
    uint256 newTtotalVariableDebt;
    uint256 oldPrincipalStableDebt;
    uint256 oldAvgStableBorrowRate;
    uint256 oldTotalStableDebt;
    uint256 newPrincipalStableDebt;
    uint256 newAvgStableBorrowRate;
    uint256 newTotalStableDebt;
    uint256 oldLiquidityIndex;
    uint256 newLiquidityIndex;
    uint256 oldVariableBorrowIndex;
    uint256 newVariableBorrowIndex;
    uint256 oldLiquidityRate;
    uint256 oldVariableBorrowRate;
    DataTypes.ReserveConfigurationMap reserveConfiguration;
    address aTokenAddress;
    address stableDebtTokenAddress;
    address variableDebtTokenAddress;
    uint40 reserveLastUpdateTimestamp;
  }

  function fetchData(DataTypes.ReserveData storage reserveData)
    internal
    view
    returns (CachingHelper.CachedData memory)
  {
    CachedData memory cachedData;

    cachedData.oldLiquidityIndex = reserveData.liquidityIndex;
    cachedData.oldVariableBorrowIndex = reserveData.variableBorrowIndex;

    cachedData.aTokenAddress = reserveData.aTokenAddress;
    cachedData.stableDebtTokenAddress = reserveData.stableDebtTokenAddress;
    cachedData.variableDebtTokenAddress = reserveData.variableDebtTokenAddress;

    cachedData.reserveConfiguration = reserveData.configuration;

    cachedData.oldLiquidityRate = reserveData.currentLiquidityRate;
    cachedData.oldVariableBorrowRate = reserveData.currentVariableBorrowRate;

    cachedData.reserveLastUpdateTimestamp = reserveData.lastUpdateTimestamp;

    cachedData.oldScaledVariableDebt = IVariableDebtToken(cachedData.variableDebtTokenAddress)
      .scaledTotalSupply();
    
    return cachedData;
  }
}
