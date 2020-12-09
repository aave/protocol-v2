import { task } from 'hardhat/config';

import { UniswapRepayAdapterFactory } from '../../types';
import { verifyContract } from '../../helpers/etherscan-verification';
import { getFirstSigner } from '../../helpers/contracts-getters';

const CONTRACT_NAME = 'UniswapRepayAdapter';

task(`deploy-${CONTRACT_NAME}`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('provider', 'Address of the LendingPoolAddressesProvider')
  .addParam('router', 'Address of the uniswap router')
  .addParam('weth', 'Address of the weth token')
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ provider, router, weth, verify }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    console.log(`\n- ${CONTRACT_NAME} deployment`);
    const uniswapRepayAdapter = await new UniswapRepayAdapterFactory(await getFirstSigner()).deploy(
      provider,
      router,
      weth
    );
    await uniswapRepayAdapter.deployTransaction.wait();
    console.log(`${CONTRACT_NAME}.address`, uniswapRepayAdapter.address);
    await verifyContract(uniswapRepayAdapter.address, [provider, router, weth]);

    console.log(
      `\tFinished ${CONTRACT_NAME}${CONTRACT_NAME}lDataProvider proxy and implementation deployment`
    );
  });
