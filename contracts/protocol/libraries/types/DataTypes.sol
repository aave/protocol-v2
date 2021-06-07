// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

library DataTypes {
  // refer to the whitepaper, section 1.1 basic concepts for a formal description of these properties.
  struct ReserveData {
    //stores the reserve configuration
    ReserveConfigurationMap configuration;
    //the liquidity index. Expressed in ray
    uint128 liquidityIndex;
    //variable borrow index. Expressed in ray
    uint128 variableBorrowIndex;
    //the current supply rate. Expressed in ray
    uint128 currentLiquidityRate;
    //the current variable borrow rate. Expressed in ray
    uint128 currentVariableBorrowRate;
    //the current stable borrow rate. Expressed in ray
    uint128 currentStableBorrowRate;
    uint40 lastUpdateTimestamp;
    //tokens addresses
    address aTokenAddress;
    address stableDebtTokenAddress;
    address variableDebtTokenAddress;
    //address of the interest rate strategy
    address interestRateStrategyAddress;
    //the id of the reserve. Represents the position in the list of the active reserves
    uint8 id;
    //the current treasury balance, scaled
    uint256 accruedToTreasury;
  }

  struct ReserveConfigurationMap {
    //bit 0-15: LTV
    //bit 16-31: Liq. threshold
    //bit 32-47: Liq. bonus
    //bit 48-55: Decimals
    //bit 56: Reserve is active
    //bit 57: reserve is frozen
    //bit 58: borrowing is enabled
    //bit 59: stable rate borrowing enabled
    //bit 60: asset is paused
    //bit 61-63: reserved
    //bit 64-79: reserve factor
    //bit 80-115 borrow cap, borrowCap == 0 => disabled
    //bit 116-152 supply cap, supplyCap == 0 => disabled
    uint256 data;
  }

  struct UserConfigurationMap {
    uint256 data;
  }

  enum InterestRateMode {NONE, STABLE, VARIABLE}

  struct ReserveCache {
    uint256 oldScaledVariableDebt;
    uint256 oldTotalVariableDebt;
    uint256 newScaledVariableDebt;
    uint256 newTotalVariableDebt;
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
    uint40 stableDebtLastUpdateTimestamp;
  }
}
