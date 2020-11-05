import {task} from 'hardhat/config';
import {deployWalletBalancerProvider} from '../../helpers/contracts-deployments';

import {getLendingPoolAddressesProvider} from '../../helpers/contracts-getters';

task('dev:wallet-balance-provider', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({verify}, localBRE) => {
    await localBRE.run('set-bre');

    const addressesProvider = await getLendingPoolAddressesProvider();
    await deployWalletBalancerProvider(addressesProvider.address, verify);
  });
