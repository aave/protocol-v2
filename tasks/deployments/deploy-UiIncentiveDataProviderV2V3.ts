import { task } from 'hardhat/config';
import { eContractid } from '../../helpers/types';
import { deployUiIncentiveDataProviderV2V3 } from '../../helpers/contracts-deployments';

task(
  `deploy-${eContractid.UiIncentiveDataProviderV2V3}`,
  `Deploys the UiIncentiveDataProviderV2V3 contract`
)
  .addFlag('verify', 'Verify UiIncentiveDataProviderV2V3 contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');
    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }
    console.log(`\n- UiIncentiveDataProviderV2V3 deployment`);

    const uiIncentiveDataProviderV2V3 = await deployUiIncentiveDataProviderV2V3(verify);

    console.log('UiIncentiveDataProviderV2V3 deployed at:', uiIncentiveDataProviderV2V3.address);
  });
