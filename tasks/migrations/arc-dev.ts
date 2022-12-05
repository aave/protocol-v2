import { task } from 'hardhat/config';
import { checkVerification } from '../../helpers/etherscan-verification';
import { printContracts } from '../../helpers/misc-utils';

task('arc-dev', 'Deploy arc development environment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', '')
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
    if (verify) {
      checkVerification();
    }

    console.log('Migration started\n');

    console.log('1. Deploy mock tokens');
    await localBRE.run('dev:deploy-mock-tokens', { verify, pool });

    console.log('2. Deploy address provider');
    await localBRE.run('dev:deploy-address-provider', { verify, skipRegistry: true });

    console.log('3. Deploy permissions manager');
    await localBRE.run('deploy-permission-manager', { pool, verify });

    console.log('4. Deploy lending pool');
    await localBRE.run('dev:deploy-lending-pool', { verify, pool });

    console.log('5. Deploy oracles');
    await localBRE.run('dev:deploy-oracles', { verify, pool });

    console.log('6. Deploy Permissioned WETH Gateway');
    await localBRE.run('full-deploy-permissioned-weth-gateway', { pool });

    console.log('7. Initialize lending pool');
    await localBRE.run('dev:initialize-lending-pool', { verify, pool });

    await localBRE.run('deploy-UiPoolDataProviderV2', { verify });
    await localBRE.run('deploy-UiPoolDataProviderV2V3', { verify });
    await localBRE.run('deploy-UiIncentiveDataProviderV2', { verify });
    await localBRE.run('deploy-UiIncentiveDataProviderV2V3', { verify });

    console.log('\nFinished migration');
    printContracts();
  });
