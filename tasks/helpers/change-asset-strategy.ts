import { task } from 'hardhat/config';
import { eEthereumNetwork, PoolConfiguration } from '../../helpers/types';
import { getLendingPoolConfiguratorProxy } from '../../helpers/contracts-getters';
import { setDRE } from '../../helpers/misc-utils';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { getReserveConfigs } from '../../helpers/init-helpers';

const isSymbolValid = (
  symbol: string,
  network: eEthereumNetwork,
  poolConfig: PoolConfiguration,
  reserveConfigs: any
) =>
  Object.keys(reserveConfigs).includes('strategy' + symbol.toUpperCase()) &&
  poolConfig.ReserveAssets[network][symbol] &&
  poolConfig.ReservesConfig[symbol] === reserveConfigs['strategy' + symbol.toUpperCase()];

task('external:change-asset-strategy', 'Change the assets strategy params')
  .addParam('symbol', `Asset symbol, needs to have configuration ready`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ symbol, pool }, localBRE) => {
    const poolConfig = loadPoolConfig(pool);
    const reserveConfigs = getReserveConfigs(pool);
    const network = process.env.FORK || localBRE.network.name;
    if (!isSymbolValid(symbol, network as eEthereumNetwork, poolConfig, reserveConfigs)) {
      throw new Error(
        `
WRONG RESERVE ASSET SETUP:
        The symbol ${symbol} has no reserve Config and/or reserve Asset setup.
        update /markets/sturdy/index.ts and add the asset address for ${network} network
        update /markets/sturdy/reservesConfigs.ts and add parameters for ${symbol}
        `
      );
    }

    setDRE(localBRE);
    const strategyParams = reserveConfigs['strategy' + symbol.toUpperCase()];
    const lendingPoolConf = await getLendingPoolConfiguratorProxy();
    await lendingPoolConf.configureReserveAsCollateral(
      poolConfig.ReserveAssets[network][symbol],
      strategyParams.baseLTVAsCollateral,
      strategyParams.liquidationThreshold,
      strategyParams.liquidationBonus
    );
  });
