import {
  eContractid,
  eNetwork,
  iMultiPoolsAssets,
  IReserveParams,
  tEthereumAddress,
} from './types';
import { SturdyProtocolDataProvider } from '../types/SturdyProtocolDataProvider';
import { chunk, DRE, getDb, waitForTx } from './misc-utils';
import {
  getAToken,
  getATokensAndRatesHelper,
  getLendingPool,
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
  getStableAndVariableTokensHelper,
  getSturdyIncentivesController,
} from './contracts-getters';
import { rawInsertContractAddressInDb } from './contracts-helpers';
import { BigNumber, BigNumberish, Signer } from 'ethers';
import {
  deployCollateralAToken,
  deployCollateralATokenImpl,
  deployDefaultReserveInterestRateStrategy,
  deployGenericAToken,
  deployGenericATokenImpl,
  deployGenericStableDebtToken,
  deployGenericVariableDebtToken,
} from './contracts-deployments';
import { ZERO_ADDRESS } from './constants';
import * as sturdyReserveConfigs from '../markets/sturdy/reservesConfigs';
import * as fantomReserveConfigs from '../markets/ftm/reservesConfigs';
import { ConfigNames } from './configuration';

export const chooseATokenDeployment = (id: eContractid) => {
  switch (id) {
    case eContractid.AToken:
      return deployGenericAToken;
    case eContractid.ATokenForCollateral:
      return deployCollateralAToken;
    default:
      throw Error(`Missing aToken deployment script for: ${id}`);
  }
};

export const getReserveConfigs = (pool: string) => {
  switch (pool) {
    case ConfigNames.Sturdy:
      return sturdyReserveConfigs;
    case ConfigNames.Fantom:
      return fantomReserveConfigs;
    default:
      throw Error(`Not exist reserveConfigs`);
  }
};

export const initReservesByHelper = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  aTokenNamePrefix: string,
  stableDebtTokenNamePrefix: string,
  variableDebtTokenNamePrefix: string,
  symbolPrefix: string,
  admin: tEthereumAddress,
  treasuryAddress: tEthereumAddress,
  yieldAddresses: Object, // TODO @bshevchenko: refactor
  verify: boolean
): Promise<BigNumber> => {
  let gasUsage = BigNumber.from('0');
  const stableAndVariableDeployer = await getStableAndVariableTokensHelper();

  const addressProvider = await getLendingPoolAddressesProvider();

  // CHUNK CONFIGURATION
  const initChunks = 4;

  // Initialize variables for future reserves initialization
  let reserveTokens: string[] = [];
  let reserveInitDecimals: string[] = [];
  let reserveSymbols: string[] = [];
  let emissionsPerSecond: string[] = [];

  let initInputParams: {
    aTokenImpl: string;
    stableDebtTokenImpl: string;
    variableDebtTokenImpl: string;
    underlyingAssetDecimals: BigNumberish;
    interestRateStrategyAddress: string;
    yieldAddress: string;
    underlyingAsset: string;
    treasury: string;
    incentivesController: string;
    underlyingAssetName: string;
    aTokenName: string;
    aTokenSymbol: string;
    variableDebtTokenName: string;
    variableDebtTokenSymbol: string;
    stableDebtTokenName: string;
    stableDebtTokenSymbol: string;
    params: string;
  }[] = [];

  let tokensForIncentive: string[] = [];
  let emissionPerSeconds: string[] = [];

  let strategyRates: [
    string, // addresses provider
    string,
    string,
    string,
    string,
    string,
    string
  ];
  let rateStrategies: Record<string, typeof strategyRates> = {};
  let strategyAddresses: Record<string, tEthereumAddress> = {};
  let strategyAddressPerAsset: Record<string, string> = {};
  let aTokenType: Record<string, string> = {};
  let collateralATokenImplementationAddress = '';
  let aTokenImplementationAddress = '';
  let stableDebtTokenImplementationAddress = '';
  let variableDebtTokenImplementationAddress = '';

  // NOT WORKING ON MATIC, DEPLOYING INDIVIDUAL IMPLs INSTEAD
  // const tx1 = await waitForTx(
  //   await stableAndVariableDeployer.initDeployment([ZERO_ADDRESS], ["1"])
  // );
  // console.log(tx1.events);
  // tx1.events?.forEach((event, index) => {
  //   stableDebtTokenImplementationAddress = event?.args?.stableToken;
  //   variableDebtTokenImplementationAddress = event?.args?.variableToken;
  //   rawInsertContractAddressInDb(`stableDebtTokenImpl`, stableDebtTokenImplementationAddress);
  //   rawInsertContractAddressInDb(`variableDebtTokenImpl`, variableDebtTokenImplementationAddress);
  // });
  //gasUsage = gasUsage.add(tx1.gasUsed);
  stableDebtTokenImplementationAddress = (await deployGenericStableDebtToken()).address;
  variableDebtTokenImplementationAddress = (await deployGenericVariableDebtToken()).address;

  const incentives = await getSturdyIncentivesController();

  const aTokenImplementation = await deployGenericATokenImpl(verify);
  aTokenImplementationAddress = aTokenImplementation.address;
  rawInsertContractAddressInDb(`aTokenImpl`, aTokenImplementationAddress);

  const collateralATokenImplementation = await deployCollateralATokenImpl(verify);
  collateralATokenImplementationAddress = collateralATokenImplementation.address;
  rawInsertContractAddressInDb(`aTokenForCollateralImpl`, collateralATokenImplementationAddress);

  const reserves = Object.entries(reservesParams).filter(
    ([_, { aTokenImpl }]) =>
      aTokenImpl === eContractid.AToken || aTokenImpl === eContractid.ATokenForCollateral
  ) as [string, IReserveParams][];

  for (let [symbol, params] of reserves) {
    if (!tokenAddresses[symbol]) {
      console.log(`- Skipping init of ${symbol} due token address is not set at markets config`);
      continue;
    }
    const { strategy, aTokenImpl, reserveDecimals, emissionPerSecond } = params;
    const {
      optimalUtilizationRate,
      baseVariableBorrowRate,
      variableRateSlope1,
      variableRateSlope2,
      stableRateSlope1,
      stableRateSlope2,
    } = strategy;
    if (!strategyAddresses[strategy.name]) {
      // Strategy does not exist, create a new one
      rateStrategies[strategy.name] = [
        addressProvider.address,
        optimalUtilizationRate,
        baseVariableBorrowRate,
        variableRateSlope1,
        variableRateSlope2,
        stableRateSlope1,
        stableRateSlope2,
      ];
      strategyAddresses[strategy.name] = (
        await deployDefaultReserveInterestRateStrategy(rateStrategies[strategy.name], verify)
      ).address;
      // This causes the last strategy to be printed twice, once under "DefaultReserveInterestRateStrategy"
      // and once under the actual `strategyASSET` key.
      rawInsertContractAddressInDb(strategy.name, strategyAddresses[strategy.name]);
    }
    strategyAddressPerAsset[symbol] = strategyAddresses[strategy.name];
    console.log('Strategy address for asset %s: %s', symbol, strategyAddressPerAsset[symbol]);

    if (aTokenImpl === eContractid.AToken) {
      aTokenType[symbol] = 'generic';
    } else if (aTokenImpl === eContractid.ATokenForCollateral) {
      aTokenType[symbol] = 'collateral';
    }

    reserveInitDecimals.push(reserveDecimals);
    reserveTokens.push(tokenAddresses[symbol]);
    reserveSymbols.push(symbol);
    emissionPerSeconds.push(emissionPerSecond);
  }

  for (let i = 0; i < reserveSymbols.length; i++) {
    let aTokenToUse: string;
    if (aTokenType[reserveSymbols[i]] === 'generic') {
      aTokenToUse = aTokenImplementationAddress;
    } else {
      aTokenToUse = collateralATokenImplementationAddress;
    }

    initInputParams.push({
      aTokenImpl: aTokenToUse,
      stableDebtTokenImpl: stableDebtTokenImplementationAddress,
      variableDebtTokenImpl: variableDebtTokenImplementationAddress,
      underlyingAssetDecimals: reserveInitDecimals[i],
      interestRateStrategyAddress: strategyAddressPerAsset[reserveSymbols[i]],
      yieldAddress: yieldAddresses[reserveSymbols[i]] || ZERO_ADDRESS,
      underlyingAsset: reserveTokens[i],
      treasury: treasuryAddress,
      incentivesController: incentives.address,
      underlyingAssetName: reserveSymbols[i],
      aTokenName: `${aTokenNamePrefix} ${reserveSymbols[i]}`,
      aTokenSymbol: `s${symbolPrefix}${reserveSymbols[i]}`,
      variableDebtTokenName: `${variableDebtTokenNamePrefix} ${symbolPrefix}${reserveSymbols[i]}`,
      variableDebtTokenSymbol: `variableDebt${symbolPrefix}${reserveSymbols[i]}`,
      stableDebtTokenName: `${stableDebtTokenNamePrefix} ${reserveSymbols[i]}`,
      stableDebtTokenSymbol: `stableDebt${symbolPrefix}${reserveSymbols[i]}`,
      params: '0x10',
    });
  }

  // Deploy init reserves per chunks
  const chunkedSymbols = chunk(reserveSymbols, initChunks);
  const chunkedInitInputParams = chunk(initInputParams, initChunks);

  const configurator = await getLendingPoolConfiguratorProxy();
  const pool = await getLendingPool();
  //await waitForTx(await addressProvider.setPoolAdmin(admin));

  console.log(`- Reserves initialization in ${chunkedInitInputParams.length} txs`);
  console.log(`----------chunkedSymbols---------------`, chunkedSymbols);
  for (let chunkIndex = 0; chunkIndex < chunkedInitInputParams.length; chunkIndex++) {
    //todo: this place should be checked before deploying on mainnet. dd gas limit as in comment pointed
    const tx3 = await waitForTx(
      //possibly for mainnet gas limit is required. On local node this transaction failed without gas limit
      // await configurator.batchInitReserve(chunkedInitInputParams[chunkIndex], { gasPrice: 1000000000, gasLimit:7850000})
      await configurator.batchInitReserve(chunkedInitInputParams[chunkIndex])
    );
    console.log(`  - Reserve ready for: ${chunkedSymbols[chunkIndex].join(', ')}`);
    console.log('    * gasUsed', tx3.gasUsed.toString());
    //gasUsage = gasUsage.add(tx3.gasUsed);

    for (let tokenIndex = 0; tokenIndex < chunkedInitInputParams[chunkIndex].length; tokenIndex++) {
      const response = await pool.getReserveData(
        chunkedInitInputParams[chunkIndex][tokenIndex].underlyingAsset
      );

      tokensForIncentive = tokensForIncentive.concat([
        response.aTokenAddress,
        response.variableDebtTokenAddress,
      ]);
      emissionsPerSecond = emissionsPerSecond.concat([
        emissionPerSeconds[chunkIndex * initChunks + tokenIndex],
        emissionPerSeconds[chunkIndex * initChunks + tokenIndex],
      ]);
    }
  }

  await incentives.configureAssets(tokensForIncentive, emissionsPerSecond);
  return gasUsage; // Deprecated
};

export const getPairsTokenAggregator = (
  allAssetsAddresses: {
    [tokenSymbol: string]: tEthereumAddress;
  },
  aggregatorsAddresses: { [tokenSymbol: string]: tEthereumAddress }
): [string[], string[]] => {
  const { ETH, USD, WETH, ...assetsAddressesWithoutEth } = allAssetsAddresses;

  const pairs = Object.entries(assetsAddressesWithoutEth).map(([tokenSymbol, tokenAddress]) => {
    if (tokenSymbol !== 'WETH' && tokenSymbol !== 'ETH') {
      const aggregatorAddressIndex = Object.keys(aggregatorsAddresses).findIndex(
        (value) => value === tokenSymbol
      );
      const [, aggregatorAddress] = (
        Object.entries(aggregatorsAddresses) as [string, tEthereumAddress][]
      )[aggregatorAddressIndex];
      return [tokenAddress, aggregatorAddress];
    }
  }) as [string, string][];

  const mappedPairs = pairs.map(([asset]) => asset);
  const mappedAggregators = pairs.map(([, source]) => source);

  return [mappedPairs, mappedAggregators];
};

export const configureReservesByHelper = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  helpers: SturdyProtocolDataProvider,
  admin: tEthereumAddress
) => {
  const addressProvider = await getLendingPoolAddressesProvider();
  const atokenAndRatesDeployer = await getATokensAndRatesHelper();
  const tokens: string[] = [];
  const symbols: string[] = [];

  const inputParams: {
    asset: string;
    baseLTV: BigNumberish;
    liquidationThreshold: BigNumberish;
    liquidationBonus: BigNumberish;
    reserveFactor: BigNumberish;
    stableBorrowingEnabled: boolean;
    borrowingEnabled: boolean;
    collateralEnabled: boolean;
  }[] = [];
  for (const [
    assetSymbol,
    {
      baseLTVAsCollateral,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      collateralEnabled,
    },
  ] of Object.entries(reservesParams) as [string, IReserveParams][]) {
    if (!tokenAddresses[assetSymbol]) {
      console.log(
        `- Skipping init of ${assetSymbol} due token address is not set at markets config`
      );
      continue;
    }
    if (baseLTVAsCollateral === '-1') continue;
    const assetAddressIndex = Object.keys(tokenAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, tokenAddress] = (Object.entries(tokenAddresses) as [string, string][])[
      assetAddressIndex
    ];
    const { usageAsCollateralEnabled: alreadyEnabled } = await helpers.getReserveConfigurationData(
      tokenAddress
    );

    if (alreadyEnabled) {
      console.log(`- Reserve ${assetSymbol} is already enabled as collateral, skipping`);
      continue;
    }
    // Push data
    inputParams.push({
      asset: tokenAddress,
      baseLTV: baseLTVAsCollateral,
      liquidationThreshold: liquidationThreshold,
      liquidationBonus: liquidationBonus,
      reserveFactor: reserveFactor,
      stableBorrowingEnabled: stableBorrowRateEnabled,
      borrowingEnabled: borrowingEnabled,
      collateralEnabled: collateralEnabled,
    });

    tokens.push(tokenAddress);
    symbols.push(assetSymbol);
  }
  if (tokens.length) {
    // Set aTokenAndRatesDeployer as temporal admin
    await waitForTx(await addressProvider.setPoolAdmin(atokenAndRatesDeployer.address));

    // Deploy init per chunks
    const enableChunks = 20;
    const chunkedSymbols = chunk(symbols, enableChunks);
    const chunkedInputParams = chunk(inputParams, enableChunks);
    for (let chunkIndex = 0; chunkIndex < chunkedInputParams.length; chunkIndex++) {
      await waitForTx(
        await atokenAndRatesDeployer.configureReserves(chunkedInputParams[chunkIndex], {
          gasLimit: 7900000,
        })
      );
      console.log(`  - Init for: ${chunkedSymbols[chunkIndex].join(', ')}`);
    }

    // Set deployer back as admin
    await waitForTx(await addressProvider.setPoolAdmin(admin));
  }
};

const getAddressById = async (
  id: string,
  network: eNetwork
): Promise<tEthereumAddress | undefined> =>
  (await getDb().get(`${id}.${network}`).value())?.address || undefined;

// Function deprecated
const isErc20SymbolCorrect = async (token: tEthereumAddress, symbol: string) => {
  const erc20 = await getAToken(token); // using aToken for ERC20 interface
  const erc20Symbol = await erc20.symbol();
  return symbol === erc20Symbol;
};
