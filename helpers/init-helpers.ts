import {AavePools, iMultiPoolsAssets, IReserveParams, tEthereumAddress} from './types';
import {LendingPool} from '../types/LendingPool';
import {LendingPoolConfigurator} from '../types/LendingPoolConfigurator';
import {AaveProtocolTestHelpers} from '../types/AaveProtocolTestHelpers';
import {LendingPoolAddressesProvider} from '../types/LendingPoolAddressesProvider';
import {
  deployDefaultReserveInterestRateStrategy,
  deployStableDebtToken,
  deployVariableDebtToken,
  deployGenericAToken,
} from './contracts-deployments';
import {getEthersSigners} from './contracts-helpers';

export const enableReservesToBorrow = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: {[symbol: string]: tEthereumAddress},
  helpers: AaveProtocolTestHelpers,
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
      const {borrowingEnabled: borrowingAlreadyEnabled} = await helpers.getReserveConfigurationData(
        tokenAddress
      );

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
  helpers: AaveProtocolTestHelpers,
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
    const {usageAsCollateralEnabled: alreadyEnabled} = await helpers.getReserveConfigurationData(
      tokenAddress
    );

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

export const initReserves = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: {[symbol: string]: tEthereumAddress},
  lendingPoolAddressesProvider: LendingPoolAddressesProvider,
  lendingPool: LendingPool,
  helpers: AaveProtocolTestHelpers,
  lendingPoolConfigurator: LendingPoolConfigurator,
  aavePool: AavePools,
  incentivesController: tEthereumAddress,
  verify: boolean
) => {
  if (aavePool !== AavePools.proto && aavePool !== AavePools.secondary) {
    console.log(`Invalid Aave pool ${aavePool}`);
    process.exit(1);
  }

  for (let [assetSymbol, {reserveDecimals}] of Object.entries(reservesParams) as [
    string,
    IReserveParams
  ][]) {
    const assetAddressIndex = Object.keys(tokenAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, tokenAddress] = (Object.entries(tokenAddresses) as [string, string][])[
      assetAddressIndex
    ];

    const {isActive: reserveInitialized} = await helpers.getReserveConfigurationData(tokenAddress);

    if (reserveInitialized) {
      console.log(`Reserve ${assetSymbol} is already active, skipping configuration`);
      continue;
    }

    try {
      const reserveParamIndex = Object.keys(reservesParams).findIndex(
        (value) => value === assetSymbol
      );
      const [
        ,
        {
          baseVariableBorrowRate,
          variableRateSlope1,
          variableRateSlope2,
          stableRateSlope1,
          stableRateSlope2,
        },
      ] = (Object.entries(reservesParams) as [string, IReserveParams][])[reserveParamIndex];
      console.log('- Deploy def reserve');
      const rateStrategyContract = await deployDefaultReserveInterestRateStrategy(
        [
          lendingPoolAddressesProvider.address,
          baseVariableBorrowRate,
          variableRateSlope1,
          variableRateSlope2,
          stableRateSlope1,
          stableRateSlope2,
        ],
        verify
      );

      console.log('- Deploy stable deb totken ', assetSymbol);
      const stableDebtToken = await deployStableDebtToken(
        [
          lendingPool.address,
          tokenAddress,
          `Aave stable debt bearing ${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
          `stableDebt${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
          incentivesController,
        ],
        verify
      );

      console.log('- Deploy var deb totken ', assetSymbol);
      const variableDebtToken = await deployVariableDebtToken(
        [
          lendingPool.address,
          tokenAddress,
          `Aave variable debt bearing ${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
          `variableDebt${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
          incentivesController,
        ],
        verify
      );

      console.log('- Deploy a token ', assetSymbol);
      const aToken = await deployGenericAToken(
        [
          lendingPool.address,
          tokenAddress,
          `Aave interest bearing ${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
          `a${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
          incentivesController,
        ],
        verify
      );

      if (process.env.POOL === AavePools.secondary) {
        if (assetSymbol.search('UNI') === -1) {
          assetSymbol = `Uni${assetSymbol}`;
        } else {
          assetSymbol = assetSymbol.replace(/_/g, '').replace('UNI', 'Uni');
        }
      }

      console.log('- init reserve currency ', assetSymbol);
      await lendingPoolConfigurator.initReserve(
        tokenAddress,
        aToken.address,
        stableDebtToken.address,
        variableDebtToken.address,
        reserveDecimals,
        rateStrategyContract.address
      );
    } catch (e) {
      console.log(`Reserve initialization for ${assetSymbol} failed with error ${e}. Skipped.`);
    }
  }
};
