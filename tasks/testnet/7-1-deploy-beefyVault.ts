import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { deployBeefyETHVault } from '../../helpers/contracts-deployments';
import { getLendingPoolConfiguratorProxy, getPriceOracle } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { DRE, waitForTx } from '../../helpers/misc-utils';
import { eNetwork, IFantomConfiguration } from '../../helpers/types';

const CONTRACT_NAME = 'BeefyETHVault';

task(`testnet:deploy-beefy-eth-vault`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveAssets } = poolConfig as IFantomConfiguration;

    const beefyETHVault = await deployBeefyETHVault(verify);
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.registerVault(beefyETHVault.address);

    const priceOracleInstance = await getPriceOracle();
    await waitForTx(
      await priceOracleInstance.setAssetPrice(
        poolConfig.ReserveAssets[network]['mooWETH'],
        poolConfig.Mocks.AllAssetsInitialPrices['mooWETH']
      )
    );
    console.log(
      (
        await priceOracleInstance.getAssetPrice(getParamPerNetwork(ReserveAssets, network).mooWETH)
      ).toString()
    );

    console.log(`${CONTRACT_NAME}.address`, beefyETHVault.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
