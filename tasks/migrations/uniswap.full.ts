import {task} from 'hardhat/config';
import {checkVerification} from '../../helpers/etherscan-verification';
import {ConfigNames} from '../../helpers/configuration';

task('uniswap:full', 'Deploy development enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({verify}, localBRE) => {
    const POOL_NAME = ConfigNames.Uniswap;

    await localBRE.run('set-DRE');

    // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
    if (verify) {
      checkVerification();
    }

    console.log('Migration started\n');

    console.log('1. Deploy address provider');
    await localBRE.run('full:deploy-address-provider', {verify, pool: POOL_NAME});

    console.log('2. Deploy lending pool');
    await localBRE.run('full:deploy-lending-pool', {verify});

    console.log('3. Deploy oracles');
    await localBRE.run('full:deploy-oracles', {verify, pool: POOL_NAME});

    console.log('4. Initialize lending pool');
    await localBRE.run('full:initialize-lending-pool', {verify, pool: POOL_NAME});

    console.log('\nFinished migrations');
  });
