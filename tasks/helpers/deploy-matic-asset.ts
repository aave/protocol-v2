import { task } from 'hardhat/config';
import { eEthereumNetwork } from '../../helpers/types';
import { getTreasuryAddress } from '../../helpers/configuration';
import * as marketConfigs from '../../markets/matic';
import * as reserveConfigs from '../../markets/matic/reservesConfigs';
import { chooseATokenDeployment } from '../../helpers/init-helpers';
import { getLendingPoolAddressesProvider } from '../../helpers/contracts-getters';
import {
  deployDefaultReserveInterestRateStrategy,
  deployStableDebtToken,
  deployVariableDebtToken,
} from '../../helpers/contracts-deployments';
import { setDRE } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from '../../helpers/constants';

const LENDING_POOL_ADDRESS_PROVIDER = {
  matic: '0xd05e3E715d945B59290df0ae8eF85c1BdB684744',
};

const isSymbolValid = (symbol: string, network: eEthereumNetwork) =>
  Object.keys(reserveConfigs).includes('strategy' + symbol) &&
  marketConfigs.MaticConfig.ReserveAssets[network][symbol] &&
  marketConfigs.MaticConfig.ReservesConfig[symbol] === reserveConfigs['strategy' + symbol];

task('external:deploy-matic-asset', 'Deploy A token, Debt Tokens, Risk Parameters')
  .addParam('symbol', `Asset symbol, needs to have configuration ready`)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify, symbol }, localBRE) => {
    const network = localBRE.network.name;
    if (!isSymbolValid(symbol, network as eEthereumNetwork)) {
      throw new Error(
        `
WRONG RESERVE ASSET SETUP:
        The symbol ${symbol} has no reserve Config and/or reserve Asset setup.
        update /markets/aave/index.ts and add the asset address for ${network} network
        update /markets/aave/reservesConfigs.ts and add parameters for ${symbol}
        `
      );
    }
    setDRE(localBRE);
    const strategyParams = reserveConfigs['strategy' + symbol];
    // const reserveAssetAddress =
    // marketConfigs.MaticConfig.ReserveAssets[localBRE.network.name][symbol];
    // const deployCustomAToken = chooseATokenDeployment(strategyParams.aTokenImpl);
    const addressProvider = await getLendingPoolAddressesProvider(
      LENDING_POOL_ADDRESS_PROVIDER[network]
    );
    // const poolAddress = await addressProvider.getLendingPool();
    // const treasuryAddress = await getTreasuryAddress(marketConfigs.MaticConfig);

    console.log('Deploying asset to Matic!');

    /*
    const aToken = await deployCustomAToken(
      [
        poolAddress,
        reserveAssetAddress,
        treasuryAddress,
        ZERO_ADDRESS, // Incentives Controller
        `Aave interest bearing ${symbol}`,
        `a${symbol}`,
      ],
      verify
    );
    const stableDebt = await deployStableDebtToken(
      [
        poolAddress,
        reserveAssetAddress,
        ZERO_ADDRESS, // Incentives Controller
        `Aave stable debt bearing ${symbol}`,
        `stableDebt${symbol}`,
      ],
      verify
    );
    const variableDebt = await deployVariableDebtToken(
      [
        poolAddress,
        reserveAssetAddress,
        ZERO_ADDRESS, // Incentives Controller
        `Aave variable debt bearing ${symbol}`,
        `variableDebt${symbol}`,
      ],
      verify
    );
    */

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
      true
    );
    console.log(`
    New interest bearing asset deployed on ${network}:
    Strategy Implementation for ${symbol} address: ${rates.address}
    `);
  });
