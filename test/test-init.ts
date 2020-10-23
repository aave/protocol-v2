import {makeSuite, TestEnv} from './helpers/make-suite';
import {
  ProtocolErrors,
  TokenContractId,
  eContractid,
  AavePools,
  tEthereumAddress,
} from '../helpers/types';
import {getReservesConfigByPool} from '../helpers/configuration';
import {
  deployAllMockTokens,
  deployLendingPoolAddressesProvider,
  deployLendingPoolAddressesProviderRegistry,
  deployLendingPool,
  deployLendingPoolConfigurator,
  deployPriceOracle,
  deployChainlinkProxyPriceProvider,
  deployLendingRateOracle,
  deployAaveProtocolTestHelpers,
  deployMockTokens,
} from '../helpers/contracts-deployments';
import {
  getFirstSigner,
  getLendingPool,
  getLendingPoolConfiguratorProxy,
  getPairsTokenAggregator,
} from '../helpers/contracts-getters';
import {insertContractAddressInDb} from '../helpers/contracts-helpers';
import {waitForTx} from '../helpers/misc-utils';
import {
  setInitialAssetPricesInOracle,
  deployAllMockAggregators,
  setInitialMarketRatesInRatesOracle,
} from '../helpers/oracles-helpers';
import AaveConfig from '../config/aave';
import {DeployTokensFactory} from '../types';
import {initReservesByHelper} from '../helpers/init-helpers';
import {ZERO_ADDRESS} from '../helpers/constants';

const MOCK_USD_PRICE_IN_WEI = AaveConfig.ProtocolGlobalParams.MockUsdPriceInWei;
const ALL_ASSETS_INITIAL_PRICES = AaveConfig.Mocks.AllAssetsInitialPrices;
const USD_ADDRESS = AaveConfig.ProtocolGlobalParams.UsdAddress;
const MOCK_CHAINLINK_AGGREGATORS_PRICES = AaveConfig.Mocks.ChainlinkAggregatorPrices;
const LENDING_RATE_ORACLE_RATES_COMMON = AaveConfig.LendingRateOracleRatesCommon;

makeSuite('Init helper test', (testEnv: TestEnv) => {
  it('Check init', async () => {
    const {deployer: deployerGuy} = testEnv;
    const deployer = deployerGuy.signer;

    const aaveAdmin = await deployer.getAddress();

    const mockTokens = await deployAllMockTokens();

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

    const [tokens, aggregators] = getPairsTokenAggregator(
      allTokenAddresses,
      allAggregatorsAddresses
    );

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
  });
});
