import {task} from 'hardhat/config';
import {getParamPerNetwork} from '../../helpers/contracts-helpers';
import {
  deployChainlinkProxyPriceProvider,
  deployLendingRateOracle,
} from '../../helpers/contracts-deployments';
import {setInitialMarketRatesInRatesOracleByHelper} from '../../helpers/oracles-helpers';
import {ICommonConfiguration, eEthereumNetwork, SymbolMap} from '../../helpers/types';
import {waitForTx, filterMapBy} from '../../helpers/misc-utils';
import {ConfigNames, loadPoolConfig} from '../../helpers/configuration';
import {exit} from 'process';
import {
  getLendingPoolAddressesProvider,
  getPairsTokenAggregator,
} from '../../helpers/contracts-getters';

task('full:deploy-oracles', 'Deploy oracles for dev enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({verify, pool}, localBRE) => {
    try {
      await localBRE.run('set-bre');
      const network = <eEthereumNetwork>localBRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const {
        ProtocolGlobalParams: {UsdAddress},
        LendingRateOracleRatesCommon,
        ReserveAssets,
        FallbackOracle,
        ChainlinkAggregator,
      } = poolConfig as ICommonConfiguration;
      const lendingRateOracles = filterMapBy(LendingRateOracleRatesCommon, (key) =>
        Object.keys(ReserveAssets[network]).includes(key)
      );
      const addressesProvider = await getLendingPoolAddressesProvider();
      const admin = await addressesProvider.getAaveAdmin();

      const fallbackOracle = await getParamPerNetwork(FallbackOracle, network);
      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
      const chainlinkAggregators = await getParamPerNetwork(ChainlinkAggregator, network);

      const tokensToWatch: SymbolMap<string> = {
        ...reserveAssets,
        USD: UsdAddress,
      };
      const [tokens, aggregators] = getPairsTokenAggregator(tokensToWatch, chainlinkAggregators);

      const chainlinkProviderPriceProvider = await deployChainlinkProxyPriceProvider(
        [tokens, aggregators, fallbackOracle],
        verify
      );
      await waitForTx(
        await addressesProvider.setPriceOracle(chainlinkProviderPriceProvider.address)
      );

      const lendingRateOracle = await deployLendingRateOracle(verify);
      await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));

      const {USD, ...tokensAddressesWithoutUsd} = tokensToWatch;
      await setInitialMarketRatesInRatesOracleByHelper(
        lendingRateOracles,
        tokensAddressesWithoutUsd,
        lendingRateOracle,
        admin
      );
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });
