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
import {waitForTx} from './misc-utils';
import {DeployTokens} from '../types/DeployTokens';
import {ZERO_ADDRESS} from './constants';
import {getFirstSigner} from './contracts-getters';
import {DeployATokensAndRatesFactory} from '../types/DeployATokensAndRatesFactory';
import {DeployStableAndVariableTokensFactory} from '../types/DeployStableAndVariableTokensFactory';
import {getDefaultSettings} from 'http2';

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

      console.log('Enabling borrowing on reserve ', assetSymbol);

      await waitForTx(
        await lendingPoolConfigurator.enableBorrowingOnReserve(
          tokenAddress,
          stableBorrowRateEnabled
        )
      );
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
      console.log(`Enabling reserve ${assetSymbol} as collateral`);

      await waitForTx(
        await lendingPoolConfigurator.enableReserveAsCollateral(
          tokenAddress,
          baseLTVAsCollateral,
          liquidationThreshold,
          liquidationBonus
        )
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
      await waitForTx(
        await lendingPoolConfigurator.initReserve(
          tokenAddress,
          aToken.address,
          stableDebtToken.address,
          variableDebtToken.address,
          reserveDecimals,
          rateStrategyContract.address
        )
      );
    } catch (e) {
      console.log(`Reserve initialization for ${assetSymbol} failed with error ${e}. Skipped.`);
    }
  }
};

export const initReservesByHelper = async (
  lendingPoolProxy: tEthereumAddress,
  addressesProvider: tEthereumAddress,
  lendingPoolConfigurator: tEthereumAddress,
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: {[symbol: string]: tEthereumAddress},
  helpers: AaveProtocolTestHelpers
) => {
  const stableAndVariableDeployer = await new DeployStableAndVariableTokensFactory(
    await getFirstSigner()
  ).deploy(lendingPoolProxy, addressesProvider);
  const stableTx = await waitForTx(stableAndVariableDeployer.deployTransaction);
  console.log('GAS', stableTx.gasUsed.toString());
  console.log('- Deployed StableAndVariableDeployer');
  const atokenAndRatesDeployer = await new DeployATokensAndRatesFactory(
    await getFirstSigner()
  ).deploy(lendingPoolProxy, addressesProvider, lendingPoolConfigurator);
  const atokenTx = await waitForTx(atokenAndRatesDeployer.deployTransaction);
  console.log('GAS', atokenTx.gasUsed.toString());
  console.log('- Deployed ATokenAndRatesDeployer');
  console.log('doing calls');
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
    assetSymbol = assetSymbol === 'WETH' ? 'ETH' : assetSymbol;
    const tx1 = await waitForTx(
      await stableAndVariableDeployer.initDeployment([tokenAddress], [assetSymbol], ZERO_ADDRESS, {
        gasLimit: 9000000,
      })
    );
    console.log('call 1', tx1.gasUsed.toString());

    const stableTokens: string[] = tx1.events?.map((e) => e.args?.stableToken) || [];
    const variableTokens: string[] = tx1.events?.map((e) => e.args?.variableToken) || [];

    const tx2 = await waitForTx(
      await atokenAndRatesDeployer.initDeployment(
        [tokenAddress],
        [assetSymbol],
        [
          [
            baseVariableBorrowRate,
            variableRateSlope1,
            variableRateSlope2,
            stableRateSlope1,
            stableRateSlope2,
          ],
        ],
        ZERO_ADDRESS
      )
    );
    const aTokens: string[] = tx2.events?.map((e) => e.args?.aToken) || [];
    const strategies: string[] = tx2.events?.map((e) => e.args?.strategy) || [];
    console.log(aTokens.length, strategies.length, stableTokens.length, variableTokens.length);
    console.log('call 2', tx2.gasUsed.toString());
    const tx3 = await waitForTx(
      await atokenAndRatesDeployer.initReserve(
        [tokenAddress],
        stableTokens,
        variableTokens,
        aTokens,
        strategies,
        [reserveDecimals]
      )
    );
    console.log('call 3', tx3.gasUsed.toString());
  }
};
