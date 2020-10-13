import {iMultiPoolsAssets, IReserveParams, tEthereumAddress} from './types';
import {LendingPool} from '../types/LendingPool';
import {LendingPoolConfigurator} from '../types/LendingPoolConfigurator';

export const enableReservesToBorrow = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: {[symbol: string]: tEthereumAddress},
  lendingPool: LendingPool,
  lendingPoolConfigurator: LendingPoolConfigurator
) => {
  for (const [assetSymbol, {borrowingEnabled, stableBorrowRateEnabled}] of Object.entries(
    reservesParams
  ) as [string, IReserveParams][]) {
    if (!borrowingEnabled) continue;
    try {
      const assetAddressIndex = Object.keys(tokenAddresses).findIndex(
        (value) => value === assetSymbol
      );
      const [, tokenAddress] = (Object.entries(tokenAddresses) as [string, string][])[
        assetAddressIndex
      ];
      const {
        borrowingEnabled: borrowingAlreadyEnabled,
      } = await lendingPool.getReserveConfigurationData(tokenAddress);

      if (borrowingAlreadyEnabled) {
        console.log(`Reserve ${assetSymbol} is already enabled for borrowing, skipping`);
        continue;
      }

      await lendingPoolConfigurator.enableBorrowingOnReserve(tokenAddress, stableBorrowRateEnabled);
    } catch (e) {
      console.log(
        `Enabling reserve for borrowings for ${assetSymbol} failed with error ${e}. Skipped.`
      );
    }
  }
};

export const enableReservesAsCollateral = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: {[symbol: string]: tEthereumAddress},
  lendingPool: LendingPool,
  lendingPoolConfigurator: LendingPoolConfigurator
) => {
  for (const [
    assetSymbol,
    {baseLTVAsCollateral, liquidationBonus, liquidationThreshold},
  ] of Object.entries(reservesParams) as [string, IReserveParams][]) {
    if (baseLTVAsCollateral === '-1') continue;

    const assetAddressIndex = Object.keys(tokenAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, tokenAddress] = (Object.entries(tokenAddresses) as [string, string][])[
      assetAddressIndex
    ];
    const {
      usageAsCollateralEnabled: alreadyEnabled,
    } = await lendingPool.getReserveConfigurationData(tokenAddress);

    if (alreadyEnabled) {
      console.log(`Reserve ${assetSymbol} is already enabled as collateral, skipping`);
      continue;
    }

    try {
      await lendingPoolConfigurator.enableReserveAsCollateral(
        tokenAddress,
        baseLTVAsCollateral,
        liquidationThreshold,
        liquidationBonus
      );
    } catch (e) {
      console.log(
        `Enabling reserve as collateral for ${assetSymbol} failed with error ${e}. Skipped.`
      );
    }
  }
};
