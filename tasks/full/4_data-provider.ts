import { task } from 'hardhat/config';
import { deploySturdyProtocolDataProvider } from '../../helpers/contracts-deployments';
import { exit } from 'process';
import { getLendingPoolAddressesProvider } from '../../helpers/contracts-getters';

task('full:data-provider', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    try {
      await localBRE.run('set-DRE');

      const addressesProvider = await getLendingPoolAddressesProvider();

      await deploySturdyProtocolDataProvider(addressesProvider.address, verify);
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });
