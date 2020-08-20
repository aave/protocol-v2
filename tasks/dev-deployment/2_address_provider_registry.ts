import {task} from '@nomiclabs/buidler/config';
import {
  deployLendingPoolAddressesProvider,
  deployLendingPoolAddressesProviderRegistry,
  deployFeeProvider,
  getFeeProvider,
  insertContractAddressInDb,
} from '../../helpers/contracts-helpers';
import {eContractid} from '../../helpers/types';
import {waitForTx} from '../../helpers/misc-utils';

task(
  'deploy-address-provider',
  'Deploy address provider, registry and fee provider for dev enviroment'
)
  .addOptionalParam('verify', 'Verify contracts at Etherscan')
  .setAction(async ({verify}, localBRE) => {
    await localBRE.run('set-bre');

    const lendingPoolManager = await (await localBRE.ethers.getSigners())[0].getAddress();

    const addressesProvider = await deployLendingPoolAddressesProvider(verify);
    await waitForTx(await addressesProvider.setLendingPoolManager(lendingPoolManager));

    const addressesProviderRegistry = await deployLendingPoolAddressesProviderRegistry(verify);
    await waitForTx(
      await addressesProviderRegistry.registerAddressesProvider(addressesProvider.address, 0)
    );

    const feeProviderImpl = await deployFeeProvider(verify);
    await waitForTx(await addressesProvider.setFeeProviderImpl(feeProviderImpl.address));

    const feeProviderProxy = await getFeeProvider(await addressesProvider.getFeeProvider());
    await insertContractAddressInDb(eContractid.FeeProvider, feeProviderProxy.address);
  });
