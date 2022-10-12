import { MockAggregator } from './../../types/MockAggregator.d';
import { deployPriceOracle, deployMockAggregator } from './../../helpers/contracts-deployments';
import { getLendingRateOracle, getAaveOracle } from './../../helpers/contracts-getters';
import { task } from 'hardhat/config';
import { deployAaveOracle, deployLendingRateOracle } from '../../helpers/contracts-deployments';
import {
  setInitialAssetPricesInOracle,
  deployAllMockAggregators,
  setInitialMarketRatesInRatesOracleByHelper,
} from '../../helpers/oracles-helpers';
import { ICommonConfiguration, iAssetBase, TokenContractId } from '../../helpers/types';
import { waitForTx } from '../../helpers/misc-utils';
import { getAllTokenAddresses } from '../../helpers/mock-helpers';
import { ConfigNames, loadPoolConfig, getQuoteCurrency } from '../../helpers/configuration';
import {
  getLendingPoolAddressesProvider,
  getMockedTokens,
  getPairsTokenAggregator,
  getPriceOracle,
} from '../../helpers/contracts-getters';

task('dev:deploy-oracles', 'Deploy oracles for dev environment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const poolConfig = loadPoolConfig(pool);
    const {
      Mocks: { AllAssetsInitialPrices },
      ProtocolGlobalParams: { UsdAddress, MockUsdPriceInWei },
      LendingRateOracleRatesCommon,
      OracleQuoteUnit,
      OracleQuoteCurrency,
    } = poolConfig as ICommonConfiguration;
    const assetPrices = Object.fromEntries(
      Object.entries(AllAssetsInitialPrices).filter(([key]) =>
        Object.keys(poolConfig.ReservesConfig).includes(key)
      )
    );

    const defaultTokenList: { [key: string]: string } = {
      ...Object.fromEntries(Object.keys(poolConfig.ReservesConfig).map((symbol) => [symbol, ''])),
      USD: UsdAddress,
    };
    const mockTokens = await getMockedTokens(poolConfig);
    const mockTokensAddress = Object.keys(mockTokens).reduce<{ [key: string]: string }>(
      (prev, curr) => {
        prev[curr] = mockTokens[curr].address;
        return prev;
      },
      defaultTokenList
    );
    const addressesProvider = await getLendingPoolAddressesProvider();
    const admin = await addressesProvider.getPoolAdmin();
    const allTokenAddresses = getAllTokenAddresses(mockTokens);
    const fallbackOracle = await deployPriceOracle(verify);
    await waitForTx(await fallbackOracle.setEthUsdPrice(MockUsdPriceInWei));
    await setInitialAssetPricesInOracle(assetPrices, mockTokensAddress, fallbackOracle);
    const mockAggregators = await deployAllMockAggregators(assetPrices, verify);
    const [tokens, aggregators] = getPairsTokenAggregator(
      allTokenAddresses,
      mockAggregators,
      OracleQuoteCurrency
    );

    const aaveOracle = await deployAaveOracle(
      [
        tokens,
        aggregators,
        fallbackOracle.address,
        await getQuoteCurrency(poolConfig),
        OracleQuoteUnit,
      ],
      verify
    );

    const lendingRateOracle = await deployLendingRateOracle(verify);
    await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));
    const { USD, ...tokensAddressesWithoutUsd } = allTokenAddresses;

    const allReservesAddresses = {
      ...tokensAddressesWithoutUsd,
    };
    await setInitialMarketRatesInRatesOracleByHelper(
      LendingRateOracleRatesCommon,
      allReservesAddresses,
      lendingRateOracle,
      admin
    );
    // Register the proxy price provider on the addressesProvider
    await waitForTx(await addressesProvider.setPriceOracle(aaveOracle.address));
    await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));
  });
