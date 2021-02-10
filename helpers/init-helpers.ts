import {
  eContractid,
  eEthereumNetwork,
  iMultiPoolsAssets,
  IReserveParams,
  tEthereumAddress,
} from './types';
import { AaveProtocolDataProvider } from '../types/AaveProtocolDataProvider';
import { chunk, DRE, getDb, waitForTx } from './misc-utils';
import {
  getAaveProtocolDataProvider,
  getAToken,
  getATokensAndRatesHelper,
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
  getStableAndVariableTokensHelper,
} from './contracts-getters';
import { rawInsertContractAddressInDb } from './contracts-helpers';
import { BigNumber, BigNumberish, Signer } from 'ethers';
import {
  deployDefaultReserveInterestRateStrategy,
  deployDelegationAwareAToken,
  deployDelegationAwareATokenImpl,
  deployGenericAToken,
  deployGenericATokenImpl,
  deployStableDebtToken,
  deployVariableDebtToken,
} from './contracts-deployments';
import { ZERO_ADDRESS } from './constants';
import { isZeroAddress } from 'ethereumjs-util';
import { DefaultReserveInterestRateStrategy, DelegationAwareAToken } from '../types';

export const chooseATokenDeployment = (id: eContractid) => {
  switch (id) {
    case eContractid.AToken:
      return deployGenericAToken;
    case eContractid.DelegationAwareAToken:
      return deployDelegationAwareAToken;
    default:
      throw Error(`Missing aToken deployment script for: ${id}`);
  }
};

export const initReservesByHelper = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  admin: tEthereumAddress,
  treasuryAddress: tEthereumAddress,
  incentivesController: tEthereumAddress,
  verify: boolean
): Promise<BigNumber> => {
  let gasUsage = BigNumber.from('0');
  const stableAndVariableDeployer = await getStableAndVariableTokensHelper();
  const atokenAndRatesDeployer = await getATokensAndRatesHelper();

  const addressProvider = await getLendingPoolAddressesProvider();
  const poolAddress = await addressProvider.getLendingPool();

  // Set aTokenAndRatesDeployer as temporal admin
  await waitForTx(await addressProvider.setPoolAdmin(atokenAndRatesDeployer.address));
  console.log("Got deployer address");
  // CHUNK CONFIGURATION
  const tokensChunks = 2;
  const initChunks = 4;

  // Initialize variables for future reserves initialization
  let deployedStableTokens: string[] = [];
  let deployedVariableTokens: string[] = [];
  let deployedATokens: string[] = [];
  let deployedRates: string[] = [];
  let reserveTokens: string[] = [];
  let reserveInitDecimals: string[] = [];
  let reserveSymbols: string[] = [];

  let initInputParams: {
    aTokenImpl: string,
    stableDebtTokenImpl: string,
    variableDebtTokenImpl: string,
    underlyingAssetDecimals: BigNumberish,
    interestRateStrategyAddress: string,
    underlyingAsset: string,
    treasury: string,
    incentivesController: string,
    underlyingAssetName: string,
    aTokenName: string,
    aTokenSymbol: string,
    variableDebtTokenName: string,
    variableDebtTokenSymbol: string,
    stableDebtTokenName: string,
    stableDebtTokenSymbol: string,
  }[] = [];

  //let lastStrategy: string = "";
  let strategyRates: [
    string, // addresses provider
    string,
    string,
    string,
    string,
    string,
    string
  ];
  // TEST - replacing with two maps, like a mapping to mapping in solidity
  let rateStrategies: Record<string, typeof strategyRates> = {};
  let strategyAddresses: Record<string, tEthereumAddress> = {};
  let strategyAddressPerAsset: Record<string, string> = {};
  let aTokenType: Record<string, string> = {};
  let delegationAwareATokenImplementationAddress = "";
  let aTokenImplementationAddress = "";
  let stableDebtTokenImplementationAddress = "";
  let variableDebtTokenImplementationAddress = "";
  // --TEST

  const tx1 = await waitForTx(
    await stableAndVariableDeployer.initDeployment([ZERO_ADDRESS], ["1"])
  );
  tx1.events?.forEach((event, index) => {
    stableDebtTokenImplementationAddress = event?.args?.stableToken;
    variableDebtTokenImplementationAddress = event?.args?.variableToken;
    rawInsertContractAddressInDb(`stableDebtTokenImpl`, stableDebtTokenImplementationAddress);
    rawInsertContractAddressInDb(`variableDebtTokenImpl`, variableDebtTokenImplementationAddress);
  });


  const aTokenImplementation = await deployGenericATokenImpl(verify);
  aTokenImplementationAddress = aTokenImplementation.address;
  rawInsertContractAddressInDb(`aTokenImpl`, aTokenImplementationAddress);
  // Deploy delegated aware reserves tokens
  const delegatedAwareReserves = Object.entries(reservesParams).filter(
    ([_, { aTokenImpl }]) => aTokenImpl === eContractid.DelegationAwareAToken
  ) as [string, IReserveParams][];

  if (delegatedAwareReserves.length > 0) {
    const delegationAwareATokenImplementation = await deployDelegationAwareATokenImpl(verify);
    delegationAwareATokenImplementationAddress = delegationAwareATokenImplementation.address;
    rawInsertContractAddressInDb(`delegationAwareATokenImpl`, delegationAwareATokenImplementationAddress);
  }

  // Deploy tokens and rates that uses common aToken in chunks
  const reservesChunks = chunk(
    Object.entries(reservesParams).filter(
      ([_, { aTokenImpl }]) => aTokenImpl === eContractid.AToken
    ) as [string, IReserveParams][],
    tokensChunks
  );

  // const reserves = Object.entries(reservesParams).filter(
  //   ([_, { aTokenImpl }]) => aTokenImpl === eContractid.AToken
  // ) as [string, IReserveParams][];
  

  console.log(
    `- Token deployments in ${reservesChunks.length * 2} txs instead of ${
      Object.entries(reservesParams).length * 4
    } txs`
  );
  // All of these use the same aToken implementation
  // but they might use different rate strategy implementations,
  // it is better to simply iterate through every reserve instead of chunks later
  for (let reservesChunk of reservesChunks) {

    // Prepare data
    const tokens: string[] = [];
    const symbols: string[] = [];

    const reservesDecimals: string[] = [];

    for (let [assetSymbol, { reserveDecimals }] of reservesChunk) {

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
          strategy,
          optimalUtilizationRate,
          baseVariableBorrowRate,
          variableRateSlope1,
          variableRateSlope2,
          stableRateSlope1,
          stableRateSlope2,
        },
      ] = (Object.entries(reservesParams) as [string, IReserveParams][])[reserveParamIndex];
      // Add to lists

      tokens.push(tokenAddress);
      symbols.push(assetSymbol);

      if (!strategyAddresses[strategy]) { 
        // Strategy does not exist, create a new one
        rateStrategies[strategy] = [
          addressProvider.address,
          optimalUtilizationRate,
          baseVariableBorrowRate,
          variableRateSlope1,
          variableRateSlope2,
          stableRateSlope1,
          stableRateSlope2,
        ];
        //lastStrategy = strategy;
        strategyAddresses[strategy] = (await deployDefaultReserveInterestRateStrategy(
          rateStrategies[strategy],
          verify
        )).address;
      }
      strategyAddressPerAsset[assetSymbol] = strategyAddresses[strategy];
      console.log("Strategy address for asset %s: %s", assetSymbol, strategyAddressPerAsset[assetSymbol])

      reservesDecimals.push(reserveDecimals);
      aTokenType[assetSymbol] = "generic";
      // inputParams.push({ 
      //   asset: tokenAddress,
      //   rates: [
      //     optimalUtilizationRate,
      //     baseVariableBorrowRate,
      //     variableRateSlope1,
      //     variableRateSlope2,
      //     stableRateSlope1,
      //     stableRateSlope2
      //   ] 
      // });
    }
    reserveInitDecimals = [...reserveInitDecimals, ...reservesDecimals];
    reserveTokens = [...reserveTokens, ...tokens];
    reserveSymbols = [...reserveSymbols, ...symbols];
  }



  for (let [symbol, params] of delegatedAwareReserves) {
    console.log(`  - Deploy ${symbol} delegation aware aToken, debts tokens, and strategy`);
    const {
      strategy,
      optimalUtilizationRate,
      baseVariableBorrowRate,
      variableRateSlope1,
      variableRateSlope2,
      stableRateSlope1,
      stableRateSlope2,
    } = params;

    if (!strategyAddresses[strategy]) { 
      // Strategy does not exist, create a new one
      rateStrategies[strategy] = [
        addressProvider.address,
        optimalUtilizationRate,
        baseVariableBorrowRate,
        variableRateSlope1,
        variableRateSlope2,
        stableRateSlope1,
        stableRateSlope2,
      ];
      //lastStrategy = strategy;
      strategyAddresses[strategy] = (await deployDefaultReserveInterestRateStrategy(
        rateStrategies[strategy],
        verify
      )).address;
    }
    strategyAddressPerAsset[symbol] = strategyAddresses[strategy];
    console.log("Strategy address for asset %s: %s", symbol, strategyAddressPerAsset[symbol])

    aTokenType[symbol] = "delegation aware";
    reserveInitDecimals.push(params.reserveDecimals);
    reserveTokens.push(tokenAddresses[symbol]);
    reserveSymbols.push(symbol);
  }

  //gasUsage = gasUsage.add(tx1.gasUsed);

  for (let i = 0; i < reserveSymbols.length; i ++) {
    let aTokenToUse: string;
    if (aTokenType[reserveSymbols[i]] === 'generic') {
      aTokenToUse = aTokenImplementationAddress;
    } else {
      aTokenToUse = delegationAwareATokenImplementationAddress;
    }

    initInputParams.push({
      aTokenImpl: aTokenToUse,
      stableDebtTokenImpl: stableDebtTokenImplementationAddress, 
      variableDebtTokenImpl: variableDebtTokenImplementationAddress,
      underlyingAssetDecimals: reserveInitDecimals[i],
      interestRateStrategyAddress: strategyAddressPerAsset[reserveSymbols[i]],
      underlyingAsset: reserveTokens[i],
      treasury: treasuryAddress,
      incentivesController: ZERO_ADDRESS,
      underlyingAssetName: reserveSymbols[i],
      aTokenName: `Aave interest bearing ${reserveSymbols[i]}`,
      aTokenSymbol: `a${reserveSymbols[i]}`,
      variableDebtTokenName: `Aave variable debt bearing ${reserveSymbols[i]}`,
      variableDebtTokenSymbol: `variableDebt${reserveSymbols[i]}`,
      stableDebtTokenName: `Aave stable debt bearing ${reserveSymbols[i]}`,
      stableDebtTokenSymbol: `stableDebt${reserveSymbols[i]}`
    });
  }

  // Deploy init reserves per chunks
  const chunkedSymbols = chunk(reserveSymbols, initChunks);
  const chunkedInitInputParams = chunk(initInputParams, initChunks);

  const configurator = await getLendingPoolConfiguratorProxy();
  await waitForTx(await addressProvider.setPoolAdmin(admin));

  console.log(`- Reserves initialization in ${chunkedInitInputParams.length} txs`);
  for (let chunkIndex = 0; chunkIndex < chunkedInitInputParams.length; chunkIndex++) {
    const tx3 = await waitForTx(
      await configurator.batchInitReserve(chunkedInitInputParams[chunkIndex])
    );

    console.log(`  - Reserve ready for: ${chunkedSymbols[chunkIndex].join(', ')}`);
    console.log('    * gasUsed', tx3.gasUsed.toString());
    gasUsage = gasUsage.add(tx3.gasUsed);
  }


  // Set deployer back as admin
  await waitForTx(await addressProvider.setPoolAdmin(admin));
  return gasUsage;
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
      const [, aggregatorAddress] = (Object.entries(aggregatorsAddresses) as [
        string,
        tEthereumAddress
      ][])[aggregatorAddressIndex];
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
  helpers: AaveProtocolDataProvider,
  admin: tEthereumAddress
) => {
  const addressProvider = await getLendingPoolAddressesProvider();
  const atokenAndRatesDeployer = await getATokensAndRatesHelper();
  const tokens: string[] = [];
  const symbols: string[] = [];
  const baseLTVA: string[] = [];
  const liquidationThresholds: string[] = [];
  const liquidationBonuses: string[] = [];
  const reserveFactors: string[] = [];
  const stableRatesEnabled: boolean[] = [];

  const inputParams : {
    asset: string;
    baseLTV: BigNumberish;
    liquidationThreshold: BigNumberish;
    liquidationBonus: BigNumberish;
    reserveFactor: BigNumberish;
    stableBorrowingEnabled: boolean;
  }[] = [];

  for (const [
    assetSymbol,
    {
      baseLTVAsCollateral,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
    },
  ] of Object.entries(reservesParams) as [string, IReserveParams][]) {
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
      stableBorrowingEnabled: stableBorrowRateEnabled
    });

    tokens.push(tokenAddress);
    symbols.push(assetSymbol);
    baseLTVA.push(baseLTVAsCollateral);
    liquidationThresholds.push(liquidationThreshold);
    liquidationBonuses.push(liquidationBonus);
    reserveFactors.push(reserveFactor);
    stableRatesEnabled.push(stableBorrowRateEnabled);
  }
  if (tokens.length) {
    // Set aTokenAndRatesDeployer as temporal admin
    await waitForTx(await addressProvider.setPoolAdmin(atokenAndRatesDeployer.address));

    // Deploy init per chunks
    const enableChunks = 20;
    const chunkedSymbols = chunk(symbols, enableChunks);
    const chunkedInputParams = chunk(inputParams, enableChunks);

    console.log(`- Configure reserves in ${chunkedInputParams.length} txs`);
    for (let chunkIndex = 0; chunkIndex < chunkedInputParams.length; chunkIndex++) {
      await waitForTx(
        await atokenAndRatesDeployer.configureReserves(
          chunkedInputParams[chunkIndex],
          { gasLimit: 12000000 }
        )
      );
      console.log(`  - Init for: ${chunkedSymbols[chunkIndex].join(', ')}`);
    }
    // Set deployer back as admin
    await waitForTx(await addressProvider.setPoolAdmin(admin));
  }
};

const getAddressById = async (
  id: string,
  network: eEthereumNetwork
): Promise<tEthereumAddress | undefined> =>
  (await getDb().get(`${id}.${network}`).value())?.address || undefined;

export const initTokenReservesByHelper = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  admin: tEthereumAddress,
  addressesProviderAddress: tEthereumAddress,
  ratesHelperAddress: tEthereumAddress,
  dataProviderAddress: tEthereumAddress,
  signer: Signer,
  treasuryAddress: tEthereumAddress,
  verify: boolean
) => {
  let gasUsage = BigNumber.from('0');
  const atokenAndRatesDeployer = await (await getATokensAndRatesHelper(ratesHelperAddress)).connect(
    signer
  );

  const addressProvider = await (
    await getLendingPoolAddressesProvider(addressesProviderAddress)
  ).connect(signer);
  const protocolDataProvider = await (
    await getAaveProtocolDataProvider(dataProviderAddress)
  ).connect(signer);
  const poolAddress = await addressProvider.getLendingPool();

  // Set aTokenAndRatesDeployer as temporal admin
  await waitForTx(await addressProvider.setPoolAdmin(atokenAndRatesDeployer.address));

  // CHUNK CONFIGURATION
  const initChunks = 4;

  // Initialize variables for future reserves initialization
  let deployedStableTokens: string[] = [];
  let deployedVariableTokens: string[] = [];
  let deployedATokens: string[] = [];
  let deployedRates: string[] = [];
  let reserveTokens: string[] = [];
  let reserveInitDecimals: string[] = [];
  let reserveSymbols: string[] = [];

  let initInputParams: {
    aTokenImpl: string,
    stableDebtTokenImpl: string,
    variableDebtTokenImpl: string,
    underlyingAssetDecimals: BigNumberish,
    interestRateStrategyAddress: string,
    underlyingAsset: string,
    treasury: string,
    incentivesController: string,
    underlyingAssetName: string,
    aTokenName: string,
    aTokenSymbol: string,
    variableDebtTokenName: string,
    variableDebtTokenSymbol: string,
    stableDebtTokenName: string,
    stableDebtTokenSymbol: string,
  }[] = [];

  const network =
    process.env.MAINNET_FORK === 'true'
      ? eEthereumNetwork.main
      : (DRE.network.name as eEthereumNetwork);
  // Grab config from DB
  for (const [symbol, address] of Object.entries(tokenAddresses)) {
    const { aTokenAddress } = await protocolDataProvider.getReserveTokensAddresses(address);
    const reserveParamIndex = Object.keys(reservesParams).findIndex((value) => value === symbol);
    const [, { reserveDecimals: decimals }] = (Object.entries(reservesParams) as [
      string,
      IReserveParams
    ][])[reserveParamIndex];

    if (!isZeroAddress(aTokenAddress)) {
      console.log(`- Skipping ${symbol} due already initialized`);
      continue;
    }
    let stableTokenImpl = await getAddressById(`stableDebt${symbol}`, network);
    let variableTokenImpl = await getAddressById(`variableDebt${symbol}`, network);
    let aTokenImplementation = await getAddressById(`a${symbol}`, network);
    let strategyImpl = await getAddressById(`strategy${symbol}`, network);

    if (!stableTokenImpl) {
      const stableDebt = await deployStableDebtToken(
        [
          poolAddress,
          tokenAddresses[symbol],
          ZERO_ADDRESS, // Incentives controller
          `Aave stable debt bearing ${symbol}`,
          `stableDebt${symbol}`
        ],
        verify
      );
      stableTokenImpl = stableDebt.address;
    }
    if (!variableTokenImpl) {
      const variableDebt = await deployVariableDebtToken(
        [
          poolAddress,
          tokenAddresses[symbol],
          ZERO_ADDRESS, // Incentives Controller
          `Aave variable debt bearing ${symbol}`,
          `variableDebt${symbol}`
        ],
        verify
      );
      variableTokenImpl = variableDebt.address;
    }
    if (!aTokenImplementation) {
      const [, { aTokenImpl }] = (Object.entries(reservesParams) as [string, IReserveParams][])[
        reserveParamIndex
      ];
      const deployCustomAToken = chooseATokenDeployment(aTokenImpl);
      const aToken = await deployCustomAToken(
        [
          poolAddress,
          tokenAddresses[symbol],
          treasuryAddress,
          ZERO_ADDRESS,
          `Aave interest bearing ${symbol}`,
          `a${symbol}`
        ],
        verify
      );
      aTokenImplementation = aToken.address;
    }
    if (!strategyImpl) {
      const [
        ,
        {
          optimalUtilizationRate,
          baseVariableBorrowRate,
          variableRateSlope1,
          variableRateSlope2,
          stableRateSlope1,
          stableRateSlope2,
        },
      ] = (Object.entries(reservesParams) as [string, IReserveParams][])[reserveParamIndex];
      const rates = await deployDefaultReserveInterestRateStrategy(
        [
          tokenAddresses[symbol],
          optimalUtilizationRate,
          baseVariableBorrowRate,
          variableRateSlope1,
          variableRateSlope2,
          stableRateSlope1,
          stableRateSlope2,
        ],
        verify
      );
      strategyImpl = rates.address;
    }
    const symbols = [`a${symbol}`, `variableDebt${symbol}`, `stableDebt${symbol}`];
    const tokens = [aTokenImplementation, variableTokenImpl, stableTokenImpl];
    for (let index = 0; index < symbols.length; index++) {
      if (!(await isErc20SymbolCorrect(tokens[index], symbols[index]))) {
        console.error(`${symbol} and implementation does not match: ${tokens[index]}`);
        throw Error('Symbol does not match implementation.');
      }
    }
    console.log(`- Added ${symbol} to the initialize batch`);
    deployedStableTokens.push(stableTokenImpl);
    deployedVariableTokens.push(variableTokenImpl);
    deployedATokens.push(aTokenImplementation);
    reserveTokens.push();
    deployedRates.push(strategyImpl);
    reserveInitDecimals.push(decimals.toString());
    reserveSymbols.push(symbol);
  }

  for (let i = 0; i < deployedATokens.length; i ++) {
    initInputParams.push({
      aTokenImpl: deployedATokens[i],
      stableDebtTokenImpl: deployedStableTokens[i], 
      variableDebtTokenImpl: deployedVariableTokens[i],
      underlyingAssetDecimals: reserveInitDecimals[i],
      interestRateStrategyAddress: deployedRates[i],
      underlyingAsset: tokenAddresses[reserveSymbols[i]],
      treasury: treasuryAddress,
      incentivesController: ZERO_ADDRESS,
      underlyingAssetName: reserveSymbols[i],
      aTokenName: `Aave interest bearing ${reserveSymbols[i]}`,
      aTokenSymbol: `a${reserveSymbols[i]}`,
      variableDebtTokenName: `Aave variable debt bearing ${reserveSymbols[i]}`,
      variableDebtTokenSymbol: `variableDebt${reserveSymbols[i]}`,
      stableDebtTokenName: `Aave stable debt bearing ${reserveSymbols[i]}`,
      stableDebtTokenSymbol: `stableDebt${reserveSymbols[i]}`
    });
  }

  // Deploy init reserves per chunks
  const chunkedSymbols = chunk(reserveSymbols, initChunks);
  const chunkedInitInputParams = chunk(initInputParams, initChunks);

  const configurator = await getLendingPoolConfiguratorProxy();
  await waitForTx(await addressProvider.setPoolAdmin(admin));

  console.log(`- Reserves initialization in ${chunkedInitInputParams.length} txs`);
  for (let chunkIndex = 0; chunkIndex < chunkedInitInputParams.length; chunkIndex++) {
    const tx3 = await waitForTx(
      await configurator.batchInitReserve(chunkedInitInputParams[chunkIndex])
    );

    console.log(`  - Reserve ready for: ${chunkedSymbols[chunkIndex].join(', ')}`);
    console.log('    * gasUsed', tx3.gasUsed.toString());
  }

  // Set deployer back as admin
  await waitForTx(await addressProvider.setPoolAdmin(admin));
  return gasUsage;
};

const isErc20SymbolCorrect = async (token: tEthereumAddress, symbol: string) => {
  const erc20 = await getAToken(token); // using aToken for ERC20 interface
  const erc20Symbol = await erc20.symbol();
  return symbol === erc20Symbol;
};
