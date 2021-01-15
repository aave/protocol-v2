import { task } from 'hardhat/config';

import { UiPoolDataProviderFactory } from '../../types';
import { verifyContract } from '../../helpers/etherscan-verification';
import { eContractid } from '../../helpers/types';

task(`deploy-${eContractid.UiPoolDataProvider}`, `Deploys the UiPoolDataProvider contract`)
  .addFlag('verify', 'Verify UiPoolDataProvider contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    console.log(`\n- UiPoolDataProvider deployment`);

    console.log(`\tDeploying UiPoolDataProvider implementation ...`);
    const uiPoolDataProvider = await new UiPoolDataProviderFactory(
      await localBRE.ethers.provider.getSigner()
    ).deploy();
    await uiPoolDataProvider.deployTransaction.wait();
    console.log('uiPoolDataProvider.address', uiPoolDataProvider.address);
    await verifyContract(uiPoolDataProvider.address, []);

    console.log(`\tFinished UiPoolDataProvider proxy and implementation deployment`);
  });
