import rawBRE from '@nomiclabs/buidler';
import {MockContract} from 'ethereum-waffle';
import {
  deployLendingPoolAddressesProvider,
  deployMintableErc20,
  deployLendingPoolAddressesProviderRegistry,
  deployFeeProvider,
  deployLendingPoolConfigurator,
  deployLendingPool,
  deployPriceOracle,
  getLendingPoolConfiguratorProxy,
  deployChainlinkProxyPriceProvider,
  deployLendingRateOracle,
  deployDefaultReserveInterestRateStrategy,
  deployLendingPoolLiquidationManager,
  deployTokenDistributor,
  deployInitializableAdminUpgradeabilityProxy,
  deployMockFlashLoanReceiver,
  deployWalletBalancerProvider,
  getFeeProvider,
  getLendingPool,
  insertContractAddressInDb,
  deployAaveProtocolTestHelpers,
  getEthersSigners,
  registerContractInJsonDb,
  deployStableDebtToken,
  deployVariableDebtToken,
  deployGenericAToken,
  getPairsTokenAggregator,
} from '../helpers/contracts-helpers';
import {LendingPoolAddressesProvider} from '../types/LendingPoolAddressesProvider';
import {Signer} from 'ethers';
import {
  TokenContractId,
  eContractid,
  tEthereumAddress,
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
import {LendingPool} from '../types/LendingPool';
import {LendingPoolConfigurator} from '../types/LendingPoolConfigurator';
import {initializeMakeSuite} from './helpers/make-suite';

import {
  setInitialAssetPricesInOracle,
  setInitialMarketRatesInRatesOracle,
  deployAllMockAggregators,
} from '../helpers/oracles-helpers';
import {waitForTx} from '../helpers/misc-utils';

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

const buildTestEnv = async (deployer: Signer, secondaryWallet: Signer) => {
  console.time('setup');
  const lendingPoolManager = await deployer.getAddress();

  const mockTokens = await deployAllMockTokens(deployer);

  const addressesProvider = await deployLendingPoolAddressesProvider();
  await waitForTx(await addressesProvider.setLendingPoolManager(lendingPoolManager));

  const addressesProviderRegistry = await deployLendingPoolAddressesProviderRegistry();
  await waitForTx(
    await addressesProviderRegistry.registerAddressesProvider(addressesProvider.address, 0)
  );

  const feeProviderImpl = await deployFeeProvider();
  await waitForTx(await addressesProvider.setFeeProviderImpl(feeProviderImpl.address));
  const feeProviderProxy = await getFeeProvider(await addressesProvider.getFeeProvider());
  await insertContractAddressInDb(eContractid.FeeProvider, feeProviderProxy.address);

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

  const liquidationManager = await deployLendingPoolLiquidationManager();
  await waitForTx(
    await addressesProvider.setLendingPoolLiquidationManager(liquidationManager.address)
  );

  const {receivers, percentages} = getFeeDistributionParamsCommon(lendingPoolManager);

  const tokenDistributorImpl = await deployTokenDistributor();
  const tokenDistributorProxy = await deployInitializableAdminUpgradeabilityProxy();
  const implementationParams = tokenDistributorImpl.interface.encodeFunctionData('initialize', [
    ZERO_ADDRESS,
    tokensAddressesWithoutUsd.LEND,
    '0x0000000000000000000000000000000000000000', // TODO: finish removal
    receivers,
    percentages,
    Object.values(tokensAddressesWithoutUsd),
  ]);
  await waitForTx(
    await tokenDistributorProxy['initialize(address,address,bytes)'](
      tokenDistributorImpl.address,
      await secondaryWallet.getAddress(),
      implementationParams
    )
  );
  await waitForTx(await addressesProvider.setTokenDistributor(tokenDistributorProxy.address));

  await insertContractAddressInDb(eContractid.TokenDistributor, tokenDistributorProxy.address);

  const mockFlashLoanReceiver = await deployMockFlashLoanReceiver(addressesProvider.address);
  await insertContractAddressInDb(eContractid.MockFlashLoanReceiver, mockFlashLoanReceiver.address);

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
