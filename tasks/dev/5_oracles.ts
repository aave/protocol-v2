import {task} from 'hardhat/config';
import {
  deployPriceOracle,
  deployAaveOracle,
  deployLendingRateOracle,
} from '../../helpers/contracts-deployments';

import {
  setInitialAssetPricesInOracle,
  deployAllMockAggregators,
  setInitialMarketRatesInRatesOracleByHelper,
} from '../../helpers/oracles-helpers';
import {ICommonConfiguration, iAssetBase, TokenContractId} from '../../helpers/types';
import {waitForTx} from '../../helpers/misc-utils';
import {getAllAggregatorsAddresses, getAllTokenAddresses} from '../../helpers/mock-helpers';
import {ConfigNames, loadPoolConfig, getWethAddress} from '../../helpers/configuration';
import {
  getAllMockedTokens,
  getLendingPoolAddressesProvider,
  getPairsTokenAggregator,
} from '../../helpers/contracts-getters';

task('dev:deploy-oracles', 'Deploy oracles for dev enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({verify, pool}, localBRE) => {

    await localBRE.run('set-DRE');
    const poolConfig = loadPoolConfig(pool);

    console.log("Initialized pool config...");

    const {
      Mocks: {AllAssetsInitialPrices},
      ProtocolGlobalParams: {UsdAddress, MockUsdPriceInWei},
      LendingRateOracleRatesCommon,
    } = poolConfig as ICommonConfiguration;

    console.log("Initialized mocks, global params and lending rate oracle rates");

    const defaultTokenList = {
      ...Object.fromEntries(Object.keys(TokenContractId).map((symbol) => [symbol, ''])),
      USD: UsdAddress,
    } as iAssetBase<string>;
    
    console.log("Initialized defaultTokenList");

    const mockTokens = await getAllMockedTokens();

    console.log("Initialized mock tokens");

    const mockTokensAddress = Object.keys(mockTokens).reduce<iAssetBase<string>>((prev, curr) => {
      prev[curr as keyof iAssetBase<string>] = mockTokens[curr].address;
      return prev;
    }, defaultTokenList);
    console.log(mockTokensAddress);
    console.log("Initialized mock tokens addresses");

    const addressesProvider = await getLendingPoolAddressesProvider();

    console.log("Got the addresses provider");

    const admin = await addressesProvider.getPoolAdmin();

    console.log("Got the admin");

    const fallbackOracle = await deployPriceOracle(verify);

    console.log("Deployed fallback price oracle");

    await waitForTx(await fallbackOracle.setEthUsdPrice(MockUsdPriceInWei));

    console.log("set fallback ETH USD price");

    await setInitialAssetPricesInOracle(AllAssetsInitialPrices, mockTokensAddress, fallbackOracle);

    console.log("Set initial asset prices in oracle");

    const mockAggregators = await deployAllMockAggregators(AllAssetsInitialPrices, verify);

    console.log("Deployed mock aggregators");

    const allTokenAddresses = getAllTokenAddresses(mockTokens);

    console.log("Got all mock token addresses");

    const allAggregatorsAddresses = getAllAggregatorsAddresses(mockAggregators);

    console.log("Got all aggregator addresses");

    const [tokens, aggregators] = getPairsTokenAggregator(
      allTokenAddresses,
      allAggregatorsAddresses
    );
    
    console.log("Got \"pairsToken aggregator\"");

    await deployAaveOracle(
      [tokens, aggregators, fallbackOracle.address, await getWethAddress(poolConfig)],
      verify
    );

    console.log("Deployed Aave oracle");

    await waitForTx(await addressesProvider.setPriceOracle(fallbackOracle.address));

    console.log("Set price oracle in addresses provider");

    const lendingRateOracle = await deployLendingRateOracle(verify);

    console.log("Deployed lendingRateOracle");

    await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));

    console.log("Set lending rate oracle in addresses provider");

    const {USD, ...tokensAddressesWithoutUsd} = allTokenAddresses;

    console.log("Initialized object with token addresses & usd")

    const allReservesAddresses = {
      ...tokensAddressesWithoutUsd,
    };

    console.log("Initialized object with all reserve addresses, allReservesAddresses:");
    console.log(allReservesAddresses);

    await setInitialMarketRatesInRatesOracleByHelper(
      LendingRateOracleRatesCommon,
      allReservesAddresses,
      lendingRateOracle,
      admin
    );

    console.log("Task complete");
  });