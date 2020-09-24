import {task} from '@nomiclabs/buidler/config';
import {
  deployLendingPoolAddressesProvider,
  deployLendingPoolAddressesProviderRegistry,
  getParamPerNetwork,
  getLendingPoolAddressesProviderRegistry,
} from '../../helpers/contracts-helpers';
import {waitForTx} from '../../helpers/misc-utils';
import {ConfigNames, loadPoolConfig, getGenesisAaveAdmin} from '../../helpers/configuration';
import {eEthereumNetwork} from '../../helpers/types';

task(
  'full:deploy-address-provider',
  'Deploy address provider, registry and fee provider for dev enviroment'
)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({verify, pool}, localBRE) => {
    await localBRE.run('set-bre');
    const network = <eEthereumNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const {ProviderId} = poolConfig;

    const providerRegistryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);
    // Deploy address provider and set genesis manager
    const addressesProvider = await deployLendingPoolAddressesProvider(verify);
    await waitForTx(await addressesProvider.setAaveAdmin(await getGenesisAaveAdmin(poolConfig)));

    // If no provider registry is set, deploy lending pool address provider registry and register the address provider
    const addressesProviderRegistry = !providerRegistryAddress
      ? await deployLendingPoolAddressesProviderRegistry(verify)
      : await getLendingPoolAddressesProviderRegistry(providerRegistryAddress);

    await waitForTx(
      await addressesProviderRegistry.registerAddressesProvider(
        addressesProvider.address,
        ProviderId
      )
    );
  });
