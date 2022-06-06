import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { deployTombFTMBeefyVault } from '../../helpers/contracts-deployments';
import { getLendingPoolConfiguratorProxy, getPriceOracle } from '../../helpers/contracts-getters';
import { waitForTx } from '../../helpers/misc-utils';
import { eNetwork, IFantomConfiguration } from '../../helpers/types';

const CONTRACT_NAME = 'TombFtmBeefyVault';

task(`testnet:deploy-tomb-ftm-beefy-vault`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool) as IFantomConfiguration;

    const tombFtmBeefyVault = await deployTombFTMBeefyVault(verify);
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.registerVault(tombFtmBeefyVault.address);

    const priceOracleInstance = await getPriceOracle();
    await waitForTx(
      await priceOracleInstance.setAssetPrice(
        poolConfig.TOMB[network],
        poolConfig.Mocks.AllAssetsInitialPrices['TOMB']
      )
    );
    await waitForTx(
      await priceOracleInstance.setAssetPrice(
        poolConfig.ReserveAssets[network]['mooTOMB_FTM'],
        poolConfig.Mocks.AllAssetsInitialPrices['mooTOMB_FTM']
      )
    );

    console.log(`${CONTRACT_NAME}.address`, tombFtmBeefyVault.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
