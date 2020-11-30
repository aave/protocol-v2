import { task } from 'hardhat/config';

import { UniswapRepayAdapterFactory } from '../../types';
import { verifyContract } from '../../helpers/etherscan-verification';

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
      '0x9fe532197ad76c5a68961439604c037eb79681f0',
      '0xfcd87315f0e4067070ade8682fcdbc3006631441',
    ];
    const uniswapRepayAdapter = await new UniswapRepayAdapterFactory(
      await localBRE.ethers.provider.getSigner()
    ).deploy(args[0], args[1]);
    await uniswapRepayAdapter.deployTransaction.wait();
    console.log('uniswapRepayAdapter.address', uniswapRepayAdapter.address);
    await verifyContract(uniswapRepayAdapter.address, args);

    console.log(`\tFinished UiPoolDataProvider proxy and implementation deployment`);
  });
