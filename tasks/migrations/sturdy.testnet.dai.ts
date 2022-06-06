import { task } from 'hardhat/config';
import { deployMockDai } from '../../helpers/contracts-deployments';
import { getFirstSigner } from '../../helpers/contracts-getters';

task('sturdy:testnet:dai', 'Deploy dai token')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    await DRE.run('set-DRE');

    console.log('Deploying dai token started\n');
    const signer = await getFirstSigner();
    const dai_minter = await signer.getAddress();
    const dai = await deployMockDai(DRE.network.config.chainId, verify);
    await dai.mint(dai_minter, DRE.ethers.utils.parseEther('1000000'));
    console.log(`dai address `, dai.address);
  });
