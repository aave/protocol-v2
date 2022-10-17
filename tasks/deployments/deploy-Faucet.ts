import { task } from 'hardhat/config';
import { deployTokenMinter } from '../../helpers/contracts-deployments';

task(`deploy-faucet`, `Deploys TokenMinter faucet contract`)
  .addFlag('verify', 'Verify via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');
    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    console.log(`\n- Faucet deployment`);

    const tokenMinter = await deployTokenMinter(verify);

    console.log('Faucet deployed at:', tokenMinter.address);
  });
