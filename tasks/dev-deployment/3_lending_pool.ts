import {task} from '@nomiclabs/buidler/config';
import {
  deployLendingPool,
  getLendingPoolAddressesProvider,
  getLendingPool,
  insertContractAddressInDb,
  deployLendingPoolConfigurator,
  getLendingPoolConfiguratorProxy,
} from '../../helpers/contracts-helpers';
import {eContractid} from '../../helpers/types';
import {waitForTx} from '../../helpers/misc-utils';

task('deploy-lending-pool', 'Deploy lending pool for dev enviroment')
  .addOptionalParam('verify', 'Verify contracts at Etherscan')
  .setAction(async ({verify}, localBRE) => {
    await localBRE.run('set-bre');

    const addressesProvider = await getLendingPoolAddressesProvider();

    const lendingPoolImpl = await deployLendingPool(verify);

    // Set lending pool impl to Address Provider
    await waitForTx(await addressesProvider.setLendingPoolImpl(lendingPoolImpl.address));

    const address = await addressesProvider.getLendingPool();
    const lendingPoolProxy = await getLendingPool(address);

    await insertContractAddressInDb(eContractid.LendingPool, lendingPoolProxy.address);

    const lendingPoolConfiguratorImpl = await deployLendingPoolConfigurator(verify);

    // Set lending pool conf impl to Address Provider
    await waitForTx(
      await addressesProvider.setLendingPoolConfiguratorImpl(lendingPoolConfiguratorImpl.address)
    );

    const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy(
      await addressesProvider.getLendingPoolConfigurator()
    );
    await insertContractAddressInDb(
      eContractid.LendingPoolConfigurator,
      lendingPoolConfiguratorProxy.address
    );
  });
