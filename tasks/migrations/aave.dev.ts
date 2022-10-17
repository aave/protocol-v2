import {
  chainlinkAggregatorProxy,
  chainlinkEthUsdAggregatorProxy,
  MOCK_CHAINLINK_AGGREGATORS_USD_PRICES,
} from './../../helpers/constants';
import { task } from 'hardhat/config';
import { checkVerification } from '../../helpers/etherscan-verification';
import { ConfigNames } from '../../helpers/configuration';
import { printContracts } from '../../helpers/misc-utils';
import {
  deployMockAggregator,
  deployUiPoolDataProviderV2V3,
} from '../../helpers/contracts-deployments';

task('aave:dev', 'Deploy development enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addOptionalParam('pool', `Market pool configuration, one of ${Object.keys(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    const POOL_NAME = pool || ConfigNames.Aave;
    await localBRE.run('set-DRE');
    const network = process.env.FORK ? process.env.FORK : localBRE.network.name;
    // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
    if (verify) {
      checkVerification();
    }

    console.log('Migration started\n');

    console.log('1. Deploy mock tokens');
    await localBRE.run('dev:deploy-mock-tokens', { verify, pool: POOL_NAME });

    console.log('2. Deploy address provider');
    await localBRE.run('dev:deploy-address-provider', { verify });

    console.log('3. Deploy lending pool');
    await localBRE.run('dev:deploy-lending-pool', { verify, pool: POOL_NAME });

    console.log('4. Deploy oracles');
    await localBRE.run('dev:deploy-oracles', { verify, pool: POOL_NAME });

    console.log('5. Deploy WETH Gateway');
    await localBRE.run('full-deploy-weth-gateway', { verify, pool: POOL_NAME });

    console.log('6. Initialize lending pool');
    await localBRE.run('dev:initialize-lending-pool', { verify, pool: POOL_NAME });

    console.log('7. Deploy UI helpers');
    const ethUsdMockOracle = await deployMockAggregator(
      MOCK_CHAINLINK_AGGREGATORS_USD_PRICES.WETH,
      verify
    );
    await deployUiPoolDataProviderV2V3(ethUsdMockOracle.address, ethUsdMockOracle.address, verify);
    await localBRE.run('deploy-UiIncentiveDataProviderV2V3', { verify });

    await localBRE.run('deploy-faucet', { verify });
    console.log('\nFinished migration');
    printContracts();
  });
