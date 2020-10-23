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
import {chunk, waitForTx} from './misc-utils';
import {getFirstSigner, getLendingPoolAddressesProvider} from './contracts-getters';
import {DeployATokensAndRatesFactory} from '../types/DeployATokensAndRatesFactory';
import {DeployStableAndVariableTokensFactory} from '../types/DeployStableAndVariableTokensFactory';

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
  helpers: AaveProtocolTestHelpers,
  admin: tEthereumAddress,
  incentivesController: tEthereumAddress
) => {
  const stableAndVariableDeployer = await new DeployStableAndVariableTokensFactory(
    await getFirstSigner()
  ).deploy(lendingPoolProxy, addressesProvider);
  await waitForTx(stableAndVariableDeployer.deployTransaction);
  const atokenAndRatesDeployer = await new DeployATokensAndRatesFactory(
    await getFirstSigner()
  ).deploy(lendingPoolProxy, addressesProvider, lendingPoolConfigurator);
  await waitForTx(atokenAndRatesDeployer.deployTransaction);
  const addressProvider = await getLendingPoolAddressesProvider(addressesProvider);

  // Set aTokenAndRatesDeployer as temporal admin
  await waitForTx(await addressProvider.setAaveAdmin(atokenAndRatesDeployer.address));

  // CHUNK CONFIGURATION
  const tokensChunks = 3;
  const initChunks = 6;

  // Deploy tokens and rates in chunks
  const reservesChunks = chunk(
    Object.entries(reservesParams) as [string, IReserveParams][],
    tokensChunks
  );
  // Initialize variables for future reserves initialization
  let deployedStableTokens: string[] = [];
  let deployedVariableTokens: string[] = [];
  let deployedATokens: string[] = [];
  let deployedRates: string[] = [];
  let reserveTokens: string[] = [];
  let reserveInitDecimals: string[] = [];

  console.log(
    `- Token deployments in ${reservesChunks.length * 2} txs instead of ${
      Object.entries(reservesParams).length * 4
    } txs`
  );
  for (let reservesChunk of reservesChunks) {
    // Prepare data
    const tokens: string[] = [];
    const symbols: string[] = [];
    const strategyRates: string[][] = [];
    const reservesDecimals: string[] = [];

    for (let [assetSymbol, {reserveDecimals}] of reservesChunk) {
      const assetAddressIndex = Object.keys(tokenAddresses).findIndex(
        (value) => value === assetSymbol
      );
      const [, tokenAddress] = (Object.entries(tokenAddresses) as [string, string][])[
        assetAddressIndex
      ];

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
      // Add to lists
      tokens.push(tokenAddress);
      symbols.push(assetSymbol === 'WETH' ? 'ETH' : assetSymbol);
      strategyRates.push([
        baseVariableBorrowRate,
        variableRateSlope1,
        variableRateSlope2,
        stableRateSlope1,
        stableRateSlope2,
      ]);
      reservesDecimals.push(reserveDecimals);
    }

    // Deploy stable and variable deployers
    const tx1 = await waitForTx(
      await stableAndVariableDeployer.initDeployment(tokens, symbols, incentivesController)
    );

    // Deploy atokens and rate strategies
    const tx2 = await waitForTx(
      await atokenAndRatesDeployer.initDeployment(
        tokens,
        symbols,
        strategyRates,
        incentivesController
      )
    );
    console.log(`  - Deployed aToken, DebtTokens and Strategy for: ${symbols.join(', ')} `);
    const stableTokens: string[] = tx1.events?.map((e) => e.args?.stableToken) || [];
    const variableTokens: string[] = tx1.events?.map((e) => e.args?.variableToken) || [];
    const aTokens: string[] = tx2.events?.map((e) => e.args?.aToken) || [];
    const strategies: string[] = tx2.events?.map((e) => e.args?.strategy) || [];

    deployedStableTokens = [...deployedStableTokens, ...stableTokens];
    deployedVariableTokens = [...deployedVariableTokens, ...variableTokens];
    deployedATokens = [...deployedATokens, ...aTokens];
    deployedRates = [...deployedRates, ...strategies];
    reserveInitDecimals = [...reserveInitDecimals, ...reservesDecimals];
    reserveTokens = [...reserveTokens, ...tokens];
  }

  // Deploy init reserves per chunks
  const chunkedTokens = chunk(reserveTokens, initChunks);
  const chunkedStableTokens = chunk(deployedStableTokens, initChunks);
  const chunkedVariableTokens = chunk(deployedVariableTokens, initChunks);
  const chunkedAtokens = chunk(deployedATokens, initChunks);
  const chunkedRates = chunk(deployedRates, initChunks);
  const chunkedDecimals = chunk(reserveInitDecimals, initChunks);
  const chunkedSymbols = chunk(Object.keys(tokenAddresses), initChunks);

  console.log(`- Reserves initialization in ${chunkedTokens.length} txs`);
  for (let chunkIndex = 0; chunkIndex < chunkedDecimals.length; chunkIndex++) {
    const tx3 = await waitForTx(
      await atokenAndRatesDeployer.initReserve(
        chunkedTokens[chunkIndex],
        chunkedStableTokens[chunkIndex],
        chunkedVariableTokens[chunkIndex],
        chunkedAtokens[chunkIndex],
        chunkedRates[chunkIndex],
        chunkedDecimals[chunkIndex]
      )
    );
    console.log(`  - Reserve ready for: ${chunkedSymbols[chunkIndex].join(', ')}`);
  }

  // Set deployer back as admin
  await waitForTx(await addressProvider.setAaveAdmin(admin));
};
