import {task} from '@nomiclabs/buidler/config';
import {
  deployLendingPoolAddressesProvider,
  deployLendingPoolAddressesProviderRegistry,
} from '../../helpers/contracts-deployments';
import {waitForTx} from '../../helpers/misc-utils';

task(
  'dev:deploy-address-provider',
  'Deploy address provider, registry and fee provider for dev enviroment'
)
  .addOptionalParam('verify', 'Verify contracts at Etherscan')
  .setAction(async ({verify}, localBRE) => {
    await localBRE.run('set-bre');

    const admin = await (await localBRE.ethers.getSigners())[0].getAddress();

    const addressesProvider = await deployLendingPoolAddressesProvider(verify);
    await waitForTx(await addressesProvider.setPoolAdmin(admin));

    const addressesProviderRegistry = await deployLendingPoolAddressesProviderRegistry(verify);
    await waitForTx(
      await addressesProviderRegistry.registerAddressesProvider(addressesProvider.address, 1)
    );
  });
