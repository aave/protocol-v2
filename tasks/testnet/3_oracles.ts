import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import {
  deploySturdyOracle,
  deployLendingRateOracle,
  deployPriceOracle,
} from '../../helpers/contracts-deployments';
import {
  setInitialAssetPricesInOracle,
  setInitialMarketRatesInRatesOracleByHelper,
  deployAllMockAggregators,
} from '../../helpers/oracles-helpers';
import { ICommonConfiguration, eNetwork, tEthereumAddress } from '../../helpers/types';
import { waitForTx, notFalsyOrZeroAddress } from '../../helpers/misc-utils';
import {
  ConfigNames,
  loadPoolConfig,
  getGenesisPoolAdmin,
  getQuoteCurrency,
} from '../../helpers/configuration';
import {
  getSturdyOracle,
  getLendingPoolAddressesProvider,
  getLendingRateOracle,
  getPairsTokenAggregator,
} from '../../helpers/contracts-getters';
import { SturdyOracle, LendingRateOracle } from '../../types';

task('testnet:deploy-oracles', 'Deploy oracles for dev enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    try {
      await DRE.run('set-DRE');
      const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const {
        ProtocolGlobalParams: { UsdAddress, MockUsdPriceInWei },
        ReserveAssets,
        LendingRateOracleRatesCommon,
        Mocks: { AllAssetsInitialPrices },
        OracleQuoteCurrency,
        OracleQuoteUnit,
      } = poolConfig as ICommonConfiguration;
      const addressesProvider = await getLendingPoolAddressesProvider();
      const admin = await getGenesisPoolAdmin(poolConfig);
      const sturdyOracleAddress = getParamPerNetwork(poolConfig.SturdyOracle, network);
      const lendingRateOracleAddress = getParamPerNetwork(poolConfig.LendingRateOracle, network);
      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);

      const fallbackOracle = await deployPriceOracle();
      await waitForTx(await fallbackOracle.setEthUsdPrice(MockUsdPriceInWei));

      await setInitialAssetPricesInOracle(
        AllAssetsInitialPrices,
        {
          DAI: reserveAssets.DAI,
          USDC: reserveAssets.USDC,
          fUSDT: reserveAssets.fUSDT,
          USDT: reserveAssets.USDT,
          stETH: reserveAssets.stETH,
          WETH: reserveAssets.WETH,
          yvWFTM: reserveAssets.yvWFTM,
          yvWETH: reserveAssets.yvWETH,
          yvWBTC: reserveAssets.yvWBTC,
          yvBOO: reserveAssets.yvBOO,
          mooTOMB_FTM: reserveAssets.mooTOMB_FTM,
          mooTOMB_MIMATIC: reserveAssets.mooTOMB_MIMATIC,
          mooBASED_MIMATIC: reserveAssets.mooBASED_MIMATIC,
          yvfBEETS: reserveAssets.yvfBEETS,
          yvLINK: reserveAssets.yvLINK,
          yvCRV: reserveAssets.yvCRV,
          yvSPELL: reserveAssets.yvSPELL,
          mooWETH: reserveAssets.mooWETH,
          yvRETH_WSTETH: reserveAssets.yvRETH_WSTETH,
          cvxRETH_WSTETH: reserveAssets.cvxRETH_WSTETH,
          cvxFRAX_3CRV: reserveAssets.cvxFRAX_3CRV,
          cvxSTECRV: reserveAssets.cvxSTECRV,
          cvxDOLA_3CRV: reserveAssets.cvxDOLA_3CRV,
          USD: UsdAddress,
        },
        fallbackOracle
      );

      // const mockAggregators = await deployAllMockAggregators(AllAssetsInitialPrices);
      // console.log('Mock aggs deployed');

      // const allAggregatorsAddresses = Object.entries(mockAggregators).reduce(
      //   (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, aggregator]) => ({
      //     ...accum,
      //     [tokenSymbol]: aggregator.address,
      //   }),
      //   {}
      // );

      // const [tokens, aggregators] = getPairsTokenAggregator(
      //   reserveAssets,
      //   allAggregatorsAddresses,
      //   OracleQuoteCurrency
      // );

      // let sturdyOracle: SturdyOracle;
      let lendingRateOracle: LendingRateOracle;

      // if (notFalsyOrZeroAddress(sturdyOracleAddress)) {
      //   sturdyOracle = await await getSturdyOracle(sturdyOracleAddress);
      // } else {
      //   sturdyOracle = await deploySturdyOracle(
      //     [
      //       tokens,
      //       aggregators,
      //       fallbackOracle.address,
      //       await getQuoteCurrency(poolConfig),
      //       OracleQuoteUnit,
      //     ],
      //     verify
      //   );
      //   await waitForTx(await sturdyOracle.setAssetSources(tokens, aggregators));
      // }

      if (notFalsyOrZeroAddress(lendingRateOracleAddress)) {
        lendingRateOracle = await getLendingRateOracle(lendingRateOracleAddress);
      } else {
        lendingRateOracle = await deployLendingRateOracle(verify);
        await setInitialMarketRatesInRatesOracleByHelper(
          LendingRateOracleRatesCommon,
          reserveAssets,
          lendingRateOracle,
          admin
        );
      }

      // console.log('Sturdy Oracle: %s', sturdyOracle.address);
      console.log('Lending Rate Oracle: %s', lendingRateOracle.address);

      // Register the proxy price provider on the addressesProvider
      await waitForTx(await addressesProvider.setPriceOracle(fallbackOracle.address));
      await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));
    } catch (error) {
      if (DRE.network.name.includes('tenderly')) {
        const transactionLink = `https://dashboard.tenderly.co/${DRE.config.tenderly.username}/${
          DRE.config.tenderly.project
        }/fork/${DRE.tenderlyNetwork.getFork()}/simulation/${DRE.tenderlyNetwork.getHead()}`;
        console.error('Check tx error:', transactionLink);
      }
      throw error;
    }
  });
