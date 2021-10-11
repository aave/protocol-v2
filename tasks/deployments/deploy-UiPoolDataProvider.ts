import { task } from 'hardhat/config';
import { eContractid } from '../../helpers/types';
import { deployUiPoolDataProvider } from '../../helpers/contracts-deployments';

task(`deploy-${eContractid.UiPoolDataProvider}`, `Deploys the UiPoolDataProvider contract`)
  .addFlag('verify', 'Verify UiPoolDataProvider contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');
    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    console.log(`\n- UiPoolDataProvider deployment`);

    const uiPoolDataProvider = await deployUiPoolDataProvider(verify);

    console.log('UiPoolDataProvider deployed at:', uiPoolDataProvider.address);
    console.log(`\tFinished UiPoolDataProvider deployment`);
  });
