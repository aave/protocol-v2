import { task } from 'hardhat/config';
import { EthereumNetwork } from '../../helpers/types';
import { getTreasuryAddress } from '../../helpers/configuration';
import * as marketConfigs from '../../markets/aave';
import * as reserveConfigs from '../../markets/aave/reservesConfigs';
import { chooseATokenDeployment } from '../../helpers/init-helpers';
import { getLendingPoolAddressesProvider } from './../../helpers/contracts-getters';
import {
  deployDefaultReserveInterestRateStrategy,
  deployStableDebtToken,
  deployVariableDebtToken,
} from './../../helpers/contracts-deployments';
import { ZERO_ADDRESS } from './../../helpers/constants';

const isSymbolValid = (symbol: string, network: EthereumNetwork) =>
  Object.keys(reserveConfigs).includes('strategy' + symbol) &&
  marketConfigs.AaveConfig.ReserveAssets[network][symbol] &&
  marketConfigs.AaveConfig.ReservesConfig[symbol] === reserveConfigs['strategy' + symbol];

task('external:deploy-new-asset', 'Deploy A token, Debt Token, Risk Parameters')
  .addParam('symbol', `Asset symbol, needs `)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify, symbol }, localBRE) => {
    if (!isSymbolValid(symbol, localBRE.network.name as EthereumNetwork)) {
      throw new Error(
        `
WRONG RESERVE ASSET SETUP:
        The symbol ${symbol} has no reserve Config and/or reserve Asset setup.
        update /markets/aave/index.ts and add the asset address for ${localBRE.network.name} network
        update /markets/aave/reservesConfigs.ts and add parameters for ${symbol}
        `
      );
    }
    const strategyParams = reserveConfigs['strategy' + symbol];
    const reserveAssetAddress =
      marketConfigs.AaveConfig.ReserveAssets[localBRE.network.name][symbol];
    const deployCustomAToken = chooseATokenDeployment(strategyParams.aTokenImpl);
    const addressProvider = await getLendingPoolAddressesProvider();
    const poolAddress = await addressProvider.getLendingPool();
    const treasuryAddress = await getTreasuryAddress(marketConfigs.AaveConfig);
    const aToken = await deployCustomAToken(
      [
        poolAddress,
        reserveAssetAddress,
        treasuryAddress,
        `Aave interest bearing ${symbol}`,
        `a${symbol}`,
        ZERO_ADDRESS,
      ],
      verify
    );
    const stableDebt = await deployStableDebtToken(
      [
        poolAddress,
        reserveAssetAddress,
        `Aave stable debt bearing ${symbol}`,
        `stableDebt${symbol}`,
        ZERO_ADDRESS,
      ],
      verify
    );
    const variableDebt = await deployVariableDebtToken(
      [
        poolAddress,
        reserveAssetAddress,
        `Aave variable debt bearing ${symbol}`,
        `variableDebt${symbol}`,
        ZERO_ADDRESS,
      ],
      verify
    );
    const rates = await deployDefaultReserveInterestRateStrategy(
      [
        reserveAssetAddress,
        strategyParams.optimalUtilizationRate,
        strategyParams.baseVariableBorrowRate,
        strategyParams.variableRateSlope1,
        strategyParams.variableRateSlope2,
        strategyParams.stableRateSlope1,
        strategyParams.stableRateSlope2,
      ],
      verify
    );
    console.log(`
    New interest bearing asset deployed on ${localBRE.network}:
    Interest bearing a${symbol} address: ${aToken.address}
    Variable Debt variableDebt${symbol} address: ${variableDebt.address}
    Stable Debt stableDebt${symbol} address: ${stableDebt.address}
    Strategy Implementation for ${symbol} address: ${rates}
    `);
  });
