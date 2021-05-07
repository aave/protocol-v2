import { task } from 'hardhat/config';
import { deployLendingPoolAddressesProvider } from '../../helpers/contracts-deployments';
import { waitForTx } from '../../helpers/misc-utils';
import {
  ConfigNames,
  loadPoolConfig,
  getGenesisPoolAdmin,
  getEmergencyAdmin,
} from '../../helpers/configuration';
//import BigNumber from 'bignumber.js';

task(
  'full:deploy-address-provider',
  'Deploy address provider, registry and fee provider for dev enviroment'
)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');
    const poolConfig = loadPoolConfig(pool);
    const { MarketId } = poolConfig;

    // 1. Deploy address provider and set genesis manager
    const addressesProvider = await deployLendingPoolAddressesProvider(MarketId, verify);

    // 2. Set pool admins

    await waitForTx(await addressesProvider.setPoolAdmin(await getGenesisPoolAdmin(poolConfig)));
    await waitForTx(await addressesProvider.setEmergencyAdmin(await getEmergencyAdmin(poolConfig)));

    console.log('Pool Admin', await addressesProvider.getPoolAdmin());
    console.log('Emergency Admin', await addressesProvider.getEmergencyAdmin());
  });
