import { task } from 'hardhat/config';

import { ParaSwapLiquiditySwapAdapterFactory } from '../../types';
import { verifyContract } from '../../helpers/contracts-helpers';
import { getFirstSigner } from '../../helpers/contracts-getters';
import { eContractid } from '../../helpers/types';

const CONTRACT_NAME = 'ParaSwapLiquiditySwapAdapter';

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
    const adapter = await new ParaSwapLiquiditySwapAdapterFactory(
      await getFirstSigner()
    ).deploy(provider, augustusRegistry);
    await adapter.deployTransaction.wait();
    console.log(`${CONTRACT_NAME}.address`, adapter.address);

    if (verify) {
      await verifyContract(eContractid.ParaSwapLiquiditySwapAdapter, adapter, [
        provider,
        augustusRegistry,
      ]);
    }

    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
