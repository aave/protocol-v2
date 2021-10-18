import { task } from 'hardhat/config';
import { eEthereumNetwork } from '../../helpers/types';
import * as marketConfigs from '../../markets/matic';
import * as reserveConfigs from '../../markets/matic/reservesConfigs';
import { getLendingPoolAddressesProvider } from '../../helpers/contracts-getters';
import { deployDefaultReserveInterestRateStrategy } from '../../helpers/contracts-deployments';
import { setDRE } from '../../helpers/misc-utils';

const LENDING_POOL_ADDRESS_PROVIDER = {
  mumbai: '0x178113104fEcbcD7fF8669a0150721e231F0FD4B',
  matic: '0xd05e3E715d945B59290df0ae8eF85c1BdB684744',
};

const isSymbolValid = (symbol: string, network: eEthereumNetwork) =>
  Object.keys(reserveConfigs).includes('strategy' + symbol) &&
  marketConfigs.MaticConfig.ReserveAssets[network][symbol] &&
  marketConfigs.MaticConfig.ReservesConfig[symbol] === reserveConfigs['strategy' + symbol];

task('external:deploy-new-asset-matic', 'Deploy A token, Debt Tokens, Risk Parameters')
  .addParam('symbol', `Asset symbol, needs to have configuration ready`)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify, symbol }, localBRE) => {
    const network = localBRE.network.name;
    if (!isSymbolValid(symbol, network as eEthereumNetwork)) {
      throw new Error(
        `
WRONG RESERVE ASSET SETUP:
        The symbol ${symbol} has no reserve Config and/or reserve Asset setup.
        update /markets/matic/index.ts and add the asset address for ${network} network
        update /markets/matic/reservesConfigs.ts and add parameters for ${symbol}
        `
      );
    }
    setDRE(localBRE);
    const strategyParams = reserveConfigs['strategy' + symbol];
    const addressProvider = await getLendingPoolAddressesProvider(
      LENDING_POOL_ADDRESS_PROVIDER[network]
    );

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
    console.log(`
    New interest bearing asset deployed on ${network}:
    Strategy Implementation for ${symbol} address: ${rates.address}
    `);
  });
