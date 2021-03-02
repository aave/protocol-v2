import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { deployAaveOracle, deployLendingRateOracle } from '../../helpers/contracts-deployments';
import { setInitialMarketRatesInRatesOracleByHelper } from '../../helpers/oracles-helpers';
import { ICommonConfiguration, eNetwork, SymbolMap } from '../../helpers/types';
import { waitForTx, notFalsyOrZeroAddress } from '../../helpers/misc-utils';
import {
  ConfigNames,
  loadPoolConfig,
  getWethAddress,
  getGenesisPoolAdmin,
  getLendingRateOracles,
} from '../../helpers/configuration';
import {
  getAaveOracle,
  getLendingPoolAddressesProvider,
  getLendingRateOracle,
  getPairsTokenAggregator,
} from '../../helpers/contracts-getters';
import { AaveOracle } from '../../types';

task('full:deploy-oracles', 'Deploy oracles for dev enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    try {
      await DRE.run('set-DRE');
      const network = <eNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const {
        ProtocolGlobalParams: { UsdAddress },
        ReserveAssets,
        FallbackOracle,
        ChainlinkAggregator,
      } = poolConfig as ICommonConfiguration;
      const lendingRateOracles = getLendingRateOracles(poolConfig);
      const addressesProvider = await getLendingPoolAddressesProvider();
      const admin = await getGenesisPoolAdmin(poolConfig);
      const aaveOracleAddress = getParamPerNetwork(poolConfig.AaveOracle, network);
      const lendingRateOracleAddress = getParamPerNetwork(poolConfig.LendingRateOracle, network);
      const fallbackOracleAddress = await getParamPerNetwork(FallbackOracle, network);
      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
      const chainlinkAggregators = await getParamPerNetwork(ChainlinkAggregator, network);

      const tokensToWatch: SymbolMap<string> = {
        ...reserveAssets,
        USD: UsdAddress,
      };
      const [tokens, aggregators] = getPairsTokenAggregator(tokensToWatch, chainlinkAggregators);

      let aaveOracle: AaveOracle;
      if (notFalsyOrZeroAddress(aaveOracleAddress)) {
        aaveOracle = await await getAaveOracle(aaveOracleAddress);
        const owner = await aaveOracle.owner();
        const signer = DRE.ethers.provider.getSigner(owner);

        aaveOracle = await (await getAaveOracle(aaveOracleAddress)).connect(signer);
        await waitForTx(await aaveOracle.setAssetSources(tokens, aggregators));
      } else {
        aaveOracle = await deployAaveOracle(
          [tokens, aggregators, fallbackOracleAddress, await getWethAddress(poolConfig)],
          verify
        );
      }

      let lendingRateOracle = notFalsyOrZeroAddress(lendingRateOracleAddress)
        ? await getLendingRateOracle(lendingRateOracleAddress)
        : await deployLendingRateOracle(verify);
      const { USD, ...tokensAddressesWithoutUsd } = tokensToWatch;

      lendingRateOracle = lendingRateOracle.connect(
        DRE.ethers.provider.getSigner(await lendingRateOracle.owner())
      );
      // This must be done any time a new market is created I believe
      //if (!lendingRateOracleAddress) {
      await setInitialMarketRatesInRatesOracleByHelper(
        lendingRateOracles,
        tokensAddressesWithoutUsd,
        lendingRateOracle,
        admin
      );
      //}
      console.log('ORACLES: %s and %s', aaveOracle.address, lendingRateOracle.address);
      // Register the proxy price provider on the addressesProvider
      await waitForTx(await addressesProvider.setPriceOracle(aaveOracle.address));
      await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));
    } catch (error) {
      if (DRE.network.name.includes('tenderly')) {
        const transactionLink = `https://dashboard.tenderly.co/${DRE.config.tenderly.username}/${
          DRE.config.tenderly.project
        }/fork/${DRE.tenderlyRPC.getFork()}/simulation/${DRE.tenderlyRPC.getHead()}`;
        console.error('Check tx error:', transactionLink);
      }
      throw error;
    }
  });
