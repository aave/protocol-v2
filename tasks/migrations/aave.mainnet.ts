import {task} from 'hardhat/config';
import {ExternalProvider} from '@ethersproject/providers';
import {checkVerification} from '../../helpers/etherscan-verification';
import {ConfigNames} from '../../helpers/configuration';
import {EthereumNetworkNames} from '../../helpers/types';
import {printContracts} from '../../helpers/misc-utils';

task('aave:mainnet', 'Deploy development enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({verify}, DRE) => {
    const POOL_NAME = ConfigNames.Aave;
    const network = <EthereumNetworkNames>DRE.network.name;
    await DRE.run('set-DRE');

    // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
    if (verify) {
      checkVerification();
    }

    if (network.includes('tenderly')) {
      console.log('- Setting up Tenderly provider');
      await DRE.tenderlyRPC.initializeFork();
      const provider = new DRE.ethers.providers.Web3Provider(DRE.tenderlyRPC as any);
      DRE.ethers.provider = provider;
    }

    console.log('Migration started\n');

    console.log('1. Deploy address provider');
    await DRE.run('full:deploy-address-provider', {pool: POOL_NAME});

    console.log('2. Deploy lending pool');
    await DRE.run('full:deploy-lending-pool');

    console.log('3. Deploy oracles');
    await DRE.run('full:deploy-oracles', {pool: POOL_NAME});

    console.log('4. Deploy Data Provider');
    await DRE.run('full:data-provider', {pool: POOL_NAME});

    console.log('5. Initialize lending pool');
    await DRE.run('full:initialize-lending-pool', {pool: POOL_NAME});

    if (verify) {
      printContracts();
      console.log('4. Veryfing contracts');
      await DRE.run('verify:general', {all: true, pool: POOL_NAME});

      console.log('5. Veryfing aTokens and debtTokens');
      await DRE.run('verify:tokens', {pool: POOL_NAME});
    }

    if (network.includes('tenderly')) {
      const postDeployHead = DRE.tenderlyRPC.getHead();
      console.log('Tenderly UUID', postDeployHead);
    }
    console.log('\nFinished migrations');
    printContracts();
  });
