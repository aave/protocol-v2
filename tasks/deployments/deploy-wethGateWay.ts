import { task } from 'hardhat/config';

import { deployWETHGateway } from '../../helpers/contracts-deployments';

const CONTRACT_NAME = 'WETHGateway';

task(`deploy-${CONTRACT_NAME}`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('weth', 'Address of the weth token')
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ weth, verify }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const wethGateWay = await deployWETHGateway([weth], verify);
    console.log(`${CONTRACT_NAME}.address`, wethGateWay.address);

    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
