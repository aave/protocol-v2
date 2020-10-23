import rawBRE from '@nomiclabs/buidler';
import {MockContract} from 'ethereum-waffle';
import {
  insertContractAddressInDb,
  getEthersSigners,
  registerContractInJsonDb,
} from '../helpers/contracts-helpers';
import {
  deployLendingPoolAddressesProvider,
  deployMintableERC20,
  deployLendingPoolAddressesProviderRegistry,
  deployLendingPoolConfigurator,
  deployLendingPool,
  deployPriceOracle,
  deployChainlinkProxyPriceProvider,
  deployLendingPoolCollateralManager,
  deployMockFlashLoanReceiver,
  deployWalletBalancerProvider,
  deployAaveProtocolTestHelpers,
  deployLendingRateOracle,
} from '../helpers/contracts-deployments';
import {Signer} from 'ethers';
import {TokenContractId, eContractid, tEthereumAddress, AavePools} from '../helpers/types';
import {MintableErc20 as MintableERC20} from '../types/MintableErc20';
import {getReservesConfigByPool} from '../helpers/configuration';
import {initializeMakeSuite} from './helpers/make-suite';

import {
  setInitialAssetPricesInOracle,
  setInitialMarketRatesInRatesOracle,
  deployAllMockAggregators,
} from '../helpers/oracles-helpers';
import {waitForTx} from '../helpers/misc-utils';
import {
  enableReservesToBorrow,
  enableReservesAsCollateral,
  initReserves,
  initReservesByHelper,
} from '../helpers/init-helpers';
import {AaveConfig} from '../config/aave';
import {ZERO_ADDRESS} from '../helpers/constants';
import {
  getLendingPool,
  getLendingPoolConfiguratorProxy,
  getPairsTokenAggregator,
} from '../helpers/contracts-getters';

const MOCK_USD_PRICE_IN_WEI = AaveConfig.ProtocolGlobalParams.MockUsdPriceInWei;
const ALL_ASSETS_INITIAL_PRICES = AaveConfig.Mocks.AllAssetsInitialPrices;
const USD_ADDRESS = AaveConfig.ProtocolGlobalParams.UsdAddress;
const MOCK_CHAINLINK_AGGREGATORS_PRICES = AaveConfig.Mocks.ChainlinkAggregatorPrices;
const LENDING_RATE_ORACLE_RATES_COMMON = AaveConfig.LendingRateOracleRatesCommon;

const deployAllMockTokens = async (deployer: Signer) => {
  const tokens: {[symbol: string]: MockContract | MintableERC20} = {};

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

    tokens[tokenSymbol] = await deployMintableERC20([
      tokenSymbol,
      tokenSymbol,
      configData ? configData.reserveDecimals : 18,
    ]);
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
  }

  return tokens;
};

const buildTestEnv = async (deployer: Signer, secondaryWallet: Signer) => {
  console.time('setup');
  const aaveAdmin = await deployer.getAddress();

  const mockTokens = await deployAllMockTokens(deployer);

  const addressesProvider = await deployLendingPoolAddressesProvider();
  await waitForTx(await addressesProvider.setAaveAdmin(aaveAdmin));

  const addressesProviderRegistry = await deployLendingPoolAddressesProviderRegistry();
  await waitForTx(
    await addressesProviderRegistry.registerAddressesProvider(addressesProvider.address, 1)
  );

  const lendingPoolImpl = await deployLendingPool();

  await waitForTx(await addressesProvider.setLendingPoolImpl(lendingPoolImpl.address));

  const address = await addressesProvider.getLendingPool();
  const lendingPoolProxy = await getLendingPool(address);

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

  const testHelpers = await deployAaveProtocolTestHelpers(addressesProvider.address);

  await insertContractAddressInDb(eContractid.AaveProtocolTestHelpers, testHelpers.address);

  console.log('Initialize configuration');
  await initReservesByHelper(
    lendingPoolProxy.address,
    addressesProvider.address,
    lendingPoolConfiguratorProxy.address,
    reservesParams,
    protoPoolReservesAddresses,
    testHelpers,
    await deployer.getAddress(),
    ZERO_ADDRESS
  );
  await enableReservesToBorrow(
    reservesParams,
    protoPoolReservesAddresses,
    testHelpers,
    lendingPoolConfiguratorProxy
  );
  await enableReservesAsCollateral(
    reservesParams,
    protoPoolReservesAddresses,
    testHelpers,
    lendingPoolConfiguratorProxy
  );

  const collateralManager = await deployLendingPoolCollateralManager();
  await waitForTx(
    await addressesProvider.setLendingPoolCollateralManager(collateralManager.address)
  );

  const mockFlashLoanReceiver = await deployMockFlashLoanReceiver(addressesProvider.address);
  await insertContractAddressInDb(eContractid.MockFlashLoanReceiver, mockFlashLoanReceiver.address);

  await deployWalletBalancerProvider(addressesProvider.address);

  console.log('END');
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
