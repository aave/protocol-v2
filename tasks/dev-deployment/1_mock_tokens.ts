import {task} from '@nomiclabs/buidler/config';
import {deployAllMockTokens} from '../../helpers/contracts-helpers';

task('deploy-mock-tokens', 'Deploy mock tokens for dev enviroment')
  .addOptionalParam('verify', 'Verify contracts at Etherscan')
  .setAction(async ({verify}, localBRE) => {
    await localBRE.run('set-bre');
    await deployAllMockTokens(verify);
  });
