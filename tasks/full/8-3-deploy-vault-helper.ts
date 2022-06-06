import { task } from 'hardhat/config';
import { ConfigNames } from '../../helpers/configuration';
import { deployVaultHelper } from '../../helpers/contracts-deployments';
import { getLendingPoolAddressesProvider } from '../../helpers/contracts-getters';

const CONTRACT_NAME = 'DeployVaultHelper';

task(`full:deploy-vault-helper`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const addressesProvider = await getLendingPoolAddressesProvider();
    const vaultHelper = await deployVaultHelper([addressesProvider.address], verify);

    console.log(`${CONTRACT_NAME}.address`, vaultHelper.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
