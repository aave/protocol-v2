import { task } from 'hardhat/config';
import { eContractid, eEthereumNetwork, eNetwork, ePolygonNetwork } from '../../helpers/types';
import { deployUiIncentiveDataProvider } from '../../helpers/contracts-deployments';
import { exit } from 'process';

task(
  `deploy-${eContractid.UiIncentiveDataProvider}`,
  `Deploys the UiIncentiveDataProvider contract`
)
  .addFlag('verify', 'Verify UiIncentiveDataProvider contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');
    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    console.log(`\n- UiIncentiveDataProvider deployment`);

    const uiIncentiveDataProvider = await deployUiIncentiveDataProvider(verify);

    console.log('UiPoolDataProvider deployed at:', uiIncentiveDataProvider.address);
    console.log(`\tFinished UiPoolDataProvider deployment`);
  });
