import {task} from '@nomiclabs/buidler/config';
import {getParamPerNetwork} from '../../helpers/contracts-helpers';
import {
  deployLendingPoolAddressesProvider,
  deployLendingPoolAddressesProviderRegistry,
} from '../../helpers/contracts-deployments';
import {waitForTx} from '../../helpers/misc-utils';
import {
  ConfigNames,
  loadPoolConfig,
  getGenesisPoolAdmin,
  getEmergencyAdmin,
} from '../../helpers/configuration';
import {eEthereumNetwork} from '../../helpers/types';
import {getLendingPoolAddressesProviderRegistry} from '../../helpers/contracts-getters';

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
    await waitForTx(await addressesProvider.setPoolAdmin(await getGenesisPoolAdmin(poolConfig)));
    const admin = await getEmergencyAdmin(poolConfig);
    console.log('Admin is ', admin);

    await waitForTx(await addressesProvider.setEmergencyAdmin(admin));

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

    //register the proxy price provider on the addressesProvider
    const proxyProvider = getParamPerNetwork(poolConfig.ProxyPriceProvider, network);

    if (proxyProvider && proxyProvider !== '') {
      await waitForTx(await addressesProvider.setPriceOracle(proxyProvider));
    }
  });
