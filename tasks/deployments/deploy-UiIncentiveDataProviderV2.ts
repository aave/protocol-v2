import { task } from 'hardhat/config';
import { eContractid, eEthereumNetwork, eNetwork, ePolygonNetwork } from '../../helpers/types';
import { deployUiIncentiveDataProviderV2 } from '../../helpers/contracts-deployments';
import { exit } from 'process';

task(
  `deploy-${eContractid.UiIncentiveDataProviderV2}`,
  `Deploys the UiIncentiveDataProviderV2 contract`
)
  .addFlag('verify', 'Verify UiIncentiveDataProviderV2 contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');
    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    console.log(`\n- UiIncentiveDataProviderV2 deployment`);

    const UiIncentiveDataProviderV2 = await deployUiIncentiveDataProviderV2(verify);

    console.log('UiIncentiveDataProviderV2 deployed at:', UiIncentiveDataProviderV2.address);
    console.log(`\tFinished UiIncentiveDataProviderV2 deployment`);
  });
