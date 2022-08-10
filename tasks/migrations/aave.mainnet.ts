import { task } from 'hardhat/config';
import { checkVerification } from '../../helpers/etherscan-verification';
import { ConfigNames, getEmergencyAdmin, loadPoolConfig } from '../../helpers/configuration';
import { printContracts } from '../../helpers/misc-utils';
import { usingTenderly } from '../../helpers/tenderly-utils';
import { getLendingPoolConfiguratorProxy } from '../../helpers/contracts-getters';

task('aave:mainnet', 'Deploy development enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addFlag('skipRegistry', 'Skip addresses provider registration at Addresses Provider Registry')
  .setAction(async ({ verify, skipRegistry }, DRE) => {
    const POOL_NAME = ConfigNames.Aave;
    await DRE.run('set-DRE');

    // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
    if (verify) {
      checkVerification();
    }

    console.log('Migration started\n');

    console.log('0. Deploy address provider registry');
    await DRE.run('full:deploy-address-provider-registry', { pool: POOL_NAME });

    console.log('1. Deploy address provider');
    await DRE.run('full:deploy-address-provider', { pool: POOL_NAME, skipRegistry });

    console.log('2. Deploy lending pool');
    await DRE.run('full:deploy-lending-pool', { pool: POOL_NAME });

    console.log('3. Deploy oracles');
    await DRE.run('full:deploy-oracles', { pool: POOL_NAME });

    console.log('4. Deploy Data Provider');
    await DRE.run('full:data-provider', { pool: POOL_NAME });

    console.log('5. Deploy WETH Gateway');
    await DRE.run('full-deploy-weth-gateway', { pool: POOL_NAME });

    console.log('6. Initialize lending pool');
    await DRE.run('full:initialize-lending-pool', { pool: POOL_NAME });

    console.log('7. Deploy UI helpers');
    await DRE.run('deploy-UiPoolDataProviderV2V3', { verify });
    await DRE.run('deploy-UiIncentiveDataProviderV2V3', { verify });

    const poolConfig = loadPoolConfig(POOL_NAME);
    const emergencyAdmin = await DRE.ethers.getSigner(await getEmergencyAdmin(poolConfig));
    const poolConfigurator = await getLendingPoolConfiguratorProxy();
    await poolConfigurator.connect(emergencyAdmin).setPoolPause(false);
    console.log('Finished deployment, unpaused protocol');

    if (verify) {
      printContracts();
      console.log('8. Veryfing contracts');
      await DRE.run('verify:general', { all: true, pool: POOL_NAME });

      console.log('9. Veryfing aTokens and debtTokens');
      await DRE.run('verify:tokens', { pool: POOL_NAME });
    }

    if (usingTenderly()) {
      const postDeployHead = DRE.tenderlyNetwork.getHead();
      const postDeployFork = DRE.tenderlyNetwork.getFork();
      console.log('Tenderly Info');
      console.log('- Head', postDeployHead);
      console.log('- Fork', postDeployFork);
    }
    console.log('\nFinished migrations');
    printContracts();
  });
