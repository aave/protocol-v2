import { task } from 'hardhat/config';
import { ConfigNames } from '../../helpers/configuration';
import { deployLidoVault } from '../../helpers/contracts-deployments';
import { getLendingPoolConfiguratorProxy } from '../../helpers/contracts-getters';

const CONTRACT_NAME = 'LidoVault';

task(`testnet:deploy-lido-vault`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }
    const lidoVault = await deployLidoVault(verify);
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.registerVault(lidoVault.address);
    console.log(`${CONTRACT_NAME}.address`, lidoVault.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
