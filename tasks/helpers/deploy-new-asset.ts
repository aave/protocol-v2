import { task } from 'hardhat/config';
import { eContractid, eEthereumNetwork, PoolConfiguration } from '../../helpers/types';
import { getTreasuryAddress, loadPoolConfig } from '../../helpers/configuration';
import { getReserveConfigs } from '../../helpers/init-helpers';
import {
  getATokensAndRatesHelper,
  getCollateralAdapter,
  getCollateralATokenImpl,
  getGenericATokenImpl,
  getLendingPool,
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
  getPriceOracle,
  getStableDebtToken,
  getSturdyIncentivesController,
  getSturdyOracle,
  getVariableDebtToken,
} from './../../helpers/contracts-getters';
import { deployDefaultReserveInterestRateStrategy } from './../../helpers/contracts-deployments';
import { setDRE, waitForTx } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from './../../helpers/constants';
import { getParamPerNetwork, rawInsertContractAddressInDb } from '../../helpers/contracts-helpers';

const isSymbolValid = (
  symbol: string,
  network: eEthereumNetwork,
  poolConfig: PoolConfiguration,
  reserveConfigs: any
) =>
  Object.keys(reserveConfigs).includes('strategy' + symbol.toUpperCase()) &&
  poolConfig.ReserveAssets[network][symbol] &&
  poolConfig.ReservesConfig[symbol] === reserveConfigs['strategy' + symbol.toUpperCase()];

// hardhat external:deploy-new-asset --pool Fantom --symbol mooTOMB_MIMATIC --yieldaddress 0x3C0238B16dBA2D11Af549954abA9bfd75A074236 --externalcollateraladdress 0x45f4682B560d4e3B8FF1F1b3A38FDBe775C7177b --network ftm
task('external:deploy-new-asset', 'Deploy A token, Debt Tokens, Risk Parameters')
  .addParam('pool', `Pool name to retrieve configuration`)
  .addParam('symbol', `Asset symbol, needs to have configuration ready`)
  .addParam('yieldaddress', `Yield address, needs for collateral asset`)
  .addParam('externalcollateraladdress', `External collateral address`)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(
    async ({ pool, verify, symbol, yieldaddress, externalcollateraladdress }, localBRE) => {
      const poolConfig = loadPoolConfig(pool);
      const reserveConfigs = getReserveConfigs(pool);
      const network = process.env.FORK || localBRE.network.name;
      if (!isSymbolValid(symbol, network as eEthereumNetwork, poolConfig, reserveConfigs)) {
        throw new Error(
          `
WRONG RESERVE ASSET SETUP:
        The symbol ${symbol} has no reserve Config and/or reserve Asset setup.
        update /markets/${pool}/index.ts and add the asset address for ${network} network
        update /markets/${pool}/reservesConfigs.ts and add parameters for ${symbol}
        `
        );
      }
      setDRE(localBRE);
      const {
        Mocks: { AllAssetsInitialPrices },
        ATokenNamePrefix,
        SymbolPrefix,
        StableDebtTokenNamePrefix,
        VariableDebtTokenNamePrefix,
      } = poolConfig;
      const strategyParams = reserveConfigs['strategy' + symbol.toUpperCase()];
      const reserveAssetAddress = poolConfig.ReserveAssets[network][symbol];
      const addressProvider = await getLendingPoolAddressesProvider();
      const lendingPool = await getLendingPool();
      const treasuryAddress = await getTreasuryAddress(poolConfig);
      const incentivesController = await getSturdyIncentivesController();
      const rates = await deployDefaultReserveInterestRateStrategy(
        [
          addressProvider.address,
          strategyParams.strategy.optimalUtilizationRate,
          strategyParams.strategy.baseVariableBorrowRate,
          strategyParams.strategy.variableRateSlope1,
          strategyParams.strategy.variableRateSlope2,
          strategyParams.strategy.stableRateSlope1,
          strategyParams.strategy.stableRateSlope2,
        ],
        verify
      );
      rawInsertContractAddressInDb(strategyParams.strategy.name, rates.address);

      const configurator = await getLendingPoolConfiguratorProxy();
      let aTokenToUse: string;

      if (strategyParams.aTokenImpl === eContractid.AToken) {
        aTokenToUse = (await getGenericATokenImpl()).address;
      } else {
        aTokenToUse = (await getCollateralATokenImpl()).address;
      }

      await waitForTx(
        await configurator.batchInitReserve([
          {
            aTokenImpl: aTokenToUse,
            stableDebtTokenImpl: (await getStableDebtToken()).address,
            variableDebtTokenImpl: (await getVariableDebtToken()).address,
            underlyingAssetDecimals: strategyParams.reserveDecimals,
            interestRateStrategyAddress: rates.address,
            yieldAddress: yieldaddress || ZERO_ADDRESS,
            underlyingAsset: reserveAssetAddress,
            treasury: treasuryAddress,
            incentivesController: incentivesController.address,
            underlyingAssetName: symbol,
            aTokenName: `${ATokenNamePrefix} ${symbol}`,
            aTokenSymbol: `s${SymbolPrefix}${symbol}`,
            variableDebtTokenName: `${VariableDebtTokenNamePrefix} ${SymbolPrefix}${symbol}`,
            variableDebtTokenSymbol: `variableDebt${SymbolPrefix}${symbol}`,
            stableDebtTokenName: `${StableDebtTokenNamePrefix} ${symbol}`,
            stableDebtTokenSymbol: `stableDebt${SymbolPrefix}${symbol}`,
            params: '0x10',
          },
        ])
      );

      const response = await lendingPool.getReserveData(reserveAssetAddress);

      await incentivesController.configureAssets(
        [response.aTokenAddress, response.variableDebtTokenAddress],
        [strategyParams.emissionPerSecond, strategyParams.emissionPerSecond]
      );

      const atokenAndRatesDeployer = await getATokensAndRatesHelper();
      const admin = await addressProvider.getPoolAdmin();
      await waitForTx(await addressProvider.setPoolAdmin(atokenAndRatesDeployer.address));
      await waitForTx(
        await atokenAndRatesDeployer.configureReserves(
          [
            {
              asset: reserveAssetAddress,
              baseLTV: strategyParams.baseLTVAsCollateral,
              liquidationThreshold: strategyParams.liquidationThreshold,
              liquidationBonus: strategyParams.liquidationBonus,
              reserveFactor: strategyParams.reserveFactor,
              stableBorrowingEnabled: strategyParams.stableBorrowRateEnabled,
              borrowingEnabled: strategyParams.borrowingEnabled,
              collateralEnabled: strategyParams.collateralEnabled,
            },
          ],
          {
            gasLimit: 7900000,
          }
        )
      );
      await waitForTx(await addressProvider.setPoolAdmin(admin));

      // set asset price
      // if (network === 'ftm_test') {
      //   const priceOracleInstance = await getPriceOracle();
      //   await waitForTx(
      //     await priceOracleInstance.setAssetPrice(
      //       reserveAssetAddress,
      //       AllAssetsInitialPrices[symbol]
      //     )
      //   );
      // } else {
      //   const oracleSource = poolConfig.ChainlinkAggregator[network][symbol];
      //   const sturdyOracle = await getSturdyOracle();
      //   await waitForTx(await sturdyOracle.setAssetSources([reserveAssetAddress], [oracleSource]));
      //   console.log((await sturdyOracle.getAssetPrice(reserveAssetAddress)).toString());
      // }

      // add collateral adapter
      const collateralAdapter = await getCollateralAdapter();
      await waitForTx(
        await collateralAdapter.addCollateralAsset(
          externalcollateraladdress,
          reserveAssetAddress,
          yieldaddress
        )
      );

      console.log(`
    New interest bearing asset deployed on ${network}:
    Interest bearing a${symbol} address: ${response.aTokenAddress}
    Variable Debt variableDebt${symbol} address: ${response.variableDebtTokenAddress}
    Stable Debt stableDebt${symbol} address: ${response.stableDebtTokenAddress}
    Strategy Implementation for ${symbol} address: ${rates.address}
    `);
    }
  );
