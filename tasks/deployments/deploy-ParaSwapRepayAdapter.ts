import { task } from 'hardhat/config';

import { ParaSwapRepayAdapterFactory } from '../../types';
import { verifyContract } from '../../helpers/contracts-helpers';
import { getFirstSigner } from '../../helpers/contracts-getters';
import { eContractid } from '../../helpers/types';

const CONTRACT_NAME = 'ParaSwapRepayAdapter';

task(`deploy-${CONTRACT_NAME}`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('provider', 'Address of the LendingPoolAddressesProvider')
  .addParam('augustusRegistry', 'Address of ParaSwap AugustusRegistry')
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ provider, augustusRegistry, verify }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    console.log(`\n- ${CONTRACT_NAME} deployment`);
    const adapter = await new ParaSwapRepayAdapterFactory(
      await getFirstSigner()
    ).deploy(provider, augustusRegistry);
    await adapter.deployTransaction.wait();
    console.log(`${CONTRACT_NAME}.address`, adapter.address);

    if (verify) {
      await verifyContract(eContractid.ParaSwapRepayAdapter, adapter, [
        provider,
        augustusRegistry,
      ]);
    }

    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
