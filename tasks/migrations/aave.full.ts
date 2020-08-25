import {task} from '@nomiclabs/buidler/config';
import {checkVerification} from '../../helpers/etherscan-verification';

task('aave:full', 'Deploy development enviroment')
  .addOptionalParam('verify', 'Verify contracts at Etherscan')
  .setAction(async ({verify}, localBRE) => {
    await localBRE.run('set-bre');
    // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
    if (verify) {
      checkVerification();
    }
    console.log('TODO: Pending to migrate');
  });
