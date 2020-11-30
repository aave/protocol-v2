import { task } from 'hardhat/config';

import { UniswapRepayAdapterFactory } from '../../types';
import { verifyContract } from '../../helpers/etherscan-verification';
import { getFirstSigner } from '../../helpers/contracts-getters';

const CONTRACT_NAME = 'UniswapRepayAdapter';

task(`deploy-${CONTRACT_NAME}`, `Deploys the UniswapRepayAdapter contract`)
  .addFlag('verify', 'Verify UniswapRepayAdapter contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    console.log(`\n- UniswapRepayAdapter deployment`);
    const args = [
      '0x88757f2f99175387aB4C6a4b3067c77A695b0349', // lending  provider kovan address
      '0xfcd87315f0e4067070ade8682fcdbc3006631441', // uniswap router address
    ];
    console.log('before');
    const uniswapRepayAdapter = await new UniswapRepayAdapterFactory(await getFirstSigner()).deploy(
      args[0],
      args[1]
    );
    console.log('afta');
    await uniswapRepayAdapter.deployTransaction.wait();
    console.log('uniswapRepayAdapter.address', uniswapRepayAdapter.address);
    await verifyContract(uniswapRepayAdapter.address, args);

    console.log(`\tFinished UiPoolDataProvider proxy and implementation deployment`);
  });
