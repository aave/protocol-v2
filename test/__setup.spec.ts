import rawBRE from '@nomiclabs/buidler';
import {MockContract} from 'ethereum-waffle';
import {
  deployLendingPoolAddressesProvider,
  deployMintableErc20,
  deployLendingPoolAddressesProviderRegistry,
  deployLendingPoolConfigurator,
  deployLendingPool,
  deployPriceOracle,
  getLendingPoolConfiguratorProxy,
  deployMockAggregator,
  deployChainlinkProxyPriceProvider,
  deployLendingRateOracle,
  deployDefaultReserveInterestRateStrategy,
  deployLendingPoolCollateralManager,
  deployMockFlashLoanReceiver,
  deployWalletBalancerProvider,
  getLendingPool,
  insertContractAddressInDb,
  deployAaveProtocolTestHelpers,
  getEthersSigners,
  registerContractInJsonDb,
  deployStableDebtToken,
  deployVariableDebtToken,
  deployGenericAToken,
  deployMockSwapAdapter,
} from '../helpers/contracts-helpers';
import {LendingPoolAddressesProvider} from '../types/LendingPoolAddressesProvider';
import {ContractTransaction, Signer} from 'ethers';
import {
  TokenContractId,
  eContractid,
  iAssetBase,
  tEthereumAddress,
  iAssetAggregatorBase,
  IMarketRates,
  iMultiPoolsAssets,
  AavePools,
  IReserveParams,
} from '../helpers/types';
import {MintableErc20} from '../types/MintableErc20';
import {
  MOCK_USD_PRICE_IN_WEI,
  ALL_ASSETS_INITIAL_PRICES,
  USD_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  LENDING_RATE_ORACLE_RATES_COMMON,
  getReservesConfigByPool,
  getFeeDistributionParamsCommon,
  ZERO_ADDRESS,
} from '../helpers/constants';
import {PriceOracle} from '../types/PriceOracle';
import {MockAggregator} from '../types/MockAggregator';
import {LendingRateOracle} from '../types/LendingRateOracle';
import {LendingPool} from '../types/LendingPool';
import {LendingPoolConfigurator} from '../types/LendingPoolConfigurator';
import {initializeMakeSuite} from './helpers/make-suite';
import path from 'path';
import fs from 'fs';

['misc'].forEach((folder) => {
  const tasksPath = path.join(__dirname, '../', 'tasks', folder);
  fs.readdirSync(tasksPath).forEach((task) => require(`${tasksPath}/${task}`));
});

const deployAllMockTokens = async (deployer: Signer) => {
  const tokens: {[symbol: string]: MockContract | MintableErc20} = {};

  const protoConfigData = getReservesConfigByPool(AavePools.proto);
  const secondaryConfigData = getReservesConfigByPool(AavePools.secondary);

  for (const tokenSymbol of Object.keys(TokenContractId)) {
    let decimals = 18;

    let configData = (<any>protoConfigData)[tokenSymbol];

    if (!configData) {
      configData = (<any>secondaryConfigData)[tokenSymbol];
    }

    if (!configData) {
      decimals = 18;
    }

    tokens[tokenSymbol] = await deployMintableErc20([
      tokenSymbol,
      tokenSymbol,
      configData ? configData.reserveDecimals : 18,
    ]);
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
  }

  return tokens;
};

const setInitialAssetPricesInOracle = async (
  prices: iAssetBase<tEthereumAddress>,
  assetsAddresses: iAssetBase<tEthereumAddress>,
  priceOracleInstance: PriceOracle
) => {
  for (const [assetSymbol, price] of Object.entries(prices) as [string, string][]) {
    const assetAddressIndex = Object.keys(assetsAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, assetAddress] = (Object.entries(assetsAddresses) as [string, string][])[
      assetAddressIndex
    ];
    await waitForTx(await priceOracleInstance.setAssetPrice(assetAddress, price));
  }
};

const deployAllMockAggregators = async (initialPrices: iAssetAggregatorBase<string>) => {
  const aggregators: {[tokenSymbol: string]: MockAggregator} = {};
  for (const tokenContractName of Object.keys(initialPrices)) {
    if (tokenContractName !== 'ETH') {
      const priceIndex = Object.keys(initialPrices).findIndex(
        (value) => value === tokenContractName
      );
      const [, price] = (Object.entries(initialPrices) as [string, string][])[priceIndex];
      aggregators[tokenContractName] = await deployMockAggregator(price);
    }
  }
  return aggregators;
};

const getPairsTokenAggregator = (
  allAssetsAddresses: {
    [tokenSymbol: string]: tEthereumAddress;
  },
  aggregatorsAddresses: {[tokenSymbol: string]: tEthereumAddress}
): [string[], string[]] => {
  const {ETH, ...assetsAddressesWithoutEth} = allAssetsAddresses;

  const pairs = Object.entries(assetsAddressesWithoutEth).map(([tokenSymbol, tokenAddress]) => {
    if (tokenSymbol !== 'ETH') {
      const aggregatorAddressIndex = Object.keys(aggregatorsAddresses).findIndex(
        (value) => value === tokenSymbol
      );
      const [, aggregatorAddress] = (Object.entries(aggregatorsAddresses) as [
        string,
        tEthereumAddress
      ][])[aggregatorAddressIndex];
      return [tokenAddress, aggregatorAddress];
    }
  });

  const mappedPairs = pairs.map(([asset]) => asset);
  const mappedAggregators = pairs.map(([, source]) => source);

  return [mappedPairs, mappedAggregators];
};

const setInitialMarketRatesInRatesOracle = async (
  marketRates: iMultiPoolsAssets<IMarketRates>,
  assetsAddresses: {[x: string]: tEthereumAddress},
  lendingRateOracleInstance: LendingRateOracle
) => {
  for (const [assetSymbol, {borrowRate}] of Object.entries(marketRates) as [
    string,
    IMarketRates
  ][]) {
    const assetAddressIndex = Object.keys(assetsAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, assetAddress] = (Object.entries(assetsAddresses) as [string, string][])[
      assetAddressIndex
    ];
    await lendingRateOracleInstance.setMarketBorrowRate(assetAddress, borrowRate);
  }
};

const initReserves = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: {[symbol: string]: tEthereumAddress},
  lendingPoolAddressesProvider: LendingPoolAddressesProvider,
  lendingPool: LendingPool,
  lendingPoolConfigurator: LendingPoolConfigurator,
  aavePool: AavePools
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

    const {isActive: reserveInitialized} = await lendingPool.getReserveConfigurationData(
      tokenAddress
    );

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
      const rateStrategyContract = await deployDefaultReserveInterestRateStrategy([
        lendingPoolAddressesProvider.address,
        baseVariableBorrowRate,
        variableRateSlope1,
        variableRateSlope2,
        stableRateSlope1,
        stableRateSlope2,
      ]);

      const stableDebtToken = await deployStableDebtToken([
        `Aave stable debt bearing ${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
        `stableDebt${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
        tokenAddress,
        lendingPool.address,
      ]);

      const variableDebtToken = await deployVariableDebtToken([
        `Aave variable debt bearing ${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
        `variableDebt${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
        tokenAddress,
        lendingPool.address,
      ]);

      const aToken = await deployGenericAToken([
        lendingPool.address,
        tokenAddress,
        `Aave interest bearing ${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
        `a${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
      ]);

      if (process.env.POOL === AavePools.secondary) {
        if (assetSymbol.search('UNI') === -1) {
          assetSymbol = `Uni${assetSymbol}`;
        } else {
          assetSymbol = assetSymbol.replace(/_/g, '').replace('UNI', 'Uni');
        }
      }

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

const enableReservesToBorrow = async (
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

const enableReservesAsCollateral = async (
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

export const waitForTx = async (tx: ContractTransaction) => await tx.wait();

const buildTestEnv = async (deployer: Signer, secondaryWallet: Signer) => {
  console.time('setup');
  const aaveAdmin = await deployer.getAddress();

  const mockTokens = await deployAllMockTokens(deployer);

  const addressesProvider = await deployLendingPoolAddressesProvider();
  await waitForTx(await addressesProvider.setAaveAdmin(aaveAdmin));

  const addressesProviderRegistry = await deployLendingPoolAddressesProviderRegistry();
  await waitForTx(
    await addressesProviderRegistry.registerAddressesProvider(addressesProvider.address, 0)
  );

  const lendingPoolImpl = await deployLendingPool();

  console.log('Deployed lending pool, address:', lendingPoolImpl.address);
  await waitForTx(await addressesProvider.setLendingPoolImpl(lendingPoolImpl.address));

  console.log('Added pool to addresses provider');

  const address = await addressesProvider.getLendingPool();
  console.log('Address is ', address);
  const lendingPoolProxy = await getLendingPool(address);

  console.log('implementation set, address:', lendingPoolProxy.address);

  await insertContractAddressInDb(eContractid.LendingPool, lendingPoolProxy.address);

  const lendingPoolConfiguratorImpl = await deployLendingPoolConfigurator();
  await waitForTx(
    await addressesProvider.setLendingPoolConfiguratorImpl(lendingPoolConfiguratorImpl.address)
  );
  const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy(
    await addressesProvider.getLendingPoolConfigurator()
  );
  await insertContractAddressInDb(
    eContractid.LendingPoolConfigurator,
    lendingPoolConfiguratorProxy.address
  );

  const fallbackOracle = await deployPriceOracle();
  await waitForTx(await fallbackOracle.setEthUsdPrice(MOCK_USD_PRICE_IN_WEI));
  await setInitialAssetPricesInOracle(
    ALL_ASSETS_INITIAL_PRICES,
    {
      WETH: mockTokens.WETH.address,
      DAI: mockTokens.DAI.address,
      TUSD: mockTokens.TUSD.address,
      USDC: mockTokens.USDC.address,
      USDT: mockTokens.USDT.address,
      SUSD: mockTokens.SUSD.address,
      LEND: mockTokens.LEND.address,
      BAT: mockTokens.BAT.address,
      REP: mockTokens.REP.address,
      MKR: mockTokens.MKR.address,
      LINK: mockTokens.LINK.address,
      KNC: mockTokens.KNC.address,
      WBTC: mockTokens.WBTC.address,
      MANA: mockTokens.MANA.address,
      ZRX: mockTokens.ZRX.address,
      SNX: mockTokens.SNX.address,
      BUSD: mockTokens.BUSD.address,

      USD: USD_ADDRESS,

      UNI_DAI_ETH: mockTokens.UNI_DAI_ETH.address,
      UNI_USDC_ETH: mockTokens.UNI_USDC_ETH.address,
      UNI_SETH_ETH: mockTokens.UNI_SETH_ETH.address,
      UNI_LEND_ETH: mockTokens.UNI_LEND_ETH.address,
      UNI_MKR_ETH: mockTokens.UNI_MKR_ETH.address,
      UNI_LINK_ETH: mockTokens.UNI_LINK_ETH.address,
    },
    fallbackOracle
  );

  const mockAggregators = await deployAllMockAggregators(MOCK_CHAINLINK_AGGREGATORS_PRICES);

  const allTokenAddresses = Object.entries(mockTokens).reduce(
    (accum: {[tokenSymbol: string]: tEthereumAddress}, [tokenSymbol, tokenContract]) => ({
      ...accum,
      [tokenSymbol]: tokenContract.address,
    }),
    {}
  );
  const allAggregatorsAddresses = Object.entries(mockAggregators).reduce(
    (accum: {[tokenSymbol: string]: tEthereumAddress}, [tokenSymbol, aggregator]) => ({
      ...accum,
      [tokenSymbol]: aggregator.address,
    }),
    {}
  );

  const [tokens, aggregators] = getPairsTokenAggregator(allTokenAddresses, allAggregatorsAddresses);

  const chainlinkProxyPriceProvider = await deployChainlinkProxyPriceProvider([
    tokens,
    aggregators,
    fallbackOracle.address,
  ]);
  await waitForTx(await addressesProvider.setPriceOracle(fallbackOracle.address));

  const lendingRateOracle = await deployLendingRateOracle();
  await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));

  const {USD, ...tokensAddressesWithoutUsd} = allTokenAddresses;
  const allReservesAddresses = {
    ...tokensAddressesWithoutUsd,
  };
  await setInitialMarketRatesInRatesOracle(
    LENDING_RATE_ORACLE_RATES_COMMON,
    allReservesAddresses,
    lendingRateOracle
  );

  const {
    UNI_DAI_ETH,
    UNI_USDC_ETH,
    UNI_SETH_ETH,
    UNI_LINK_ETH,
    UNI_MKR_ETH,
    UNI_LEND_ETH,
    ...protoPoolReservesAddresses
  } = <{[symbol: string]: tEthereumAddress}>allReservesAddresses;

  const reservesParams = getReservesConfigByPool(AavePools.proto);

  console.log('Initialize configuration');
  await initReserves(
    reservesParams,
    protoPoolReservesAddresses,
    addressesProvider,
    lendingPoolProxy,
    lendingPoolConfiguratorProxy,
    AavePools.proto
  );
  await enableReservesToBorrow(
    reservesParams,
    protoPoolReservesAddresses,
    lendingPoolProxy,
    lendingPoolConfiguratorProxy
  );
  await enableReservesAsCollateral(
    reservesParams,
    protoPoolReservesAddresses,
    lendingPoolProxy,
    lendingPoolConfiguratorProxy
  );

  const collateralManager = await deployLendingPoolCollateralManager();
  await waitForTx(
    await addressesProvider.setLendingPoolCollateralManager(collateralManager.address)
  );

  const mockFlashLoanReceiver = await deployMockFlashLoanReceiver(addressesProvider.address);
  await insertContractAddressInDb(eContractid.MockFlashLoanReceiver, mockFlashLoanReceiver.address);

  const mockSwapAdapter = await deployMockSwapAdapter(addressesProvider.address);
  await insertContractAddressInDb(eContractid.MockSwapAdapter, mockSwapAdapter.address);

  await deployWalletBalancerProvider(addressesProvider.address);

  const testHelpers = await deployAaveProtocolTestHelpers(addressesProvider.address);

  await insertContractAddressInDb(eContractid.AaveProtocolTestHelpers, testHelpers.address);

  console.timeEnd('setup');
};

before(async () => {
  await rawBRE.run('set-bre');
  const [deployer, secondaryWallet] = await getEthersSigners();
  console.log('-> Deploying test environment...');
  await buildTestEnv(deployer, secondaryWallet);
  await initializeMakeSuite();
  console.log('\n***************');
  console.log('Setup and snapshot finished');
  console.log('***************\n');
});
