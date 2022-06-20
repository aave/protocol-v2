import { task } from 'hardhat/config';
import { loadPoolConfig, ConfigNames, getEmergencyAdmin } from '../../helpers/configuration';
import { waitForTx } from '../../helpers/misc-utils';
import {
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
  getLendingPoolImpl,
} from './../../helpers/contracts-getters';
import { eNetwork } from '../../helpers/types';

// Note: replace below with actual deployed addresses.
const LENDING_POOL_ADDRESS_PROVIDER = {
  main: '',
};

task(
  'enable-lending-pool',
  'Enable or pause lending pool from operation. Note: only admin authorization can enable lending pool.'
)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    try {
      await DRE.run('set-DRE');
      const network = <eNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);

      const addressesProvider = await getLendingPoolAddressesProvider(
        LENDING_POOL_ADDRESS_PROVIDER[network]
      );

      const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy(
        await addressesProvider.getLendingPoolConfigurator()
      );

      const admin = await DRE.ethers.getSigner(await getEmergencyAdmin(poolConfig));
      // Pause market during deployment
      await waitForTx(await lendingPoolConfiguratorProxy.connect(admin).setPoolPause(false));

      // Get current state from lendingPool to confirm that the lending pool is enabled.
      const lendingPoolAddress = await addressesProvider.getLendingPool();
      console.log('Address of the lending pool to be enabled is:%s', lendingPoolAddress);

      const lendingPoolImpl = await getLendingPoolImpl(lendingPoolAddress);
      const is_paused = await lendingPoolImpl.connect(admin).paused();
      console.log('Lending pool: %s, is enabled=%s', lendingPoolAddress, !is_paused);
    } catch (error) {
      throw error;
    }
  });
