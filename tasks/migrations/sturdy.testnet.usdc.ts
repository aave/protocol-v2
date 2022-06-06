import { task } from 'hardhat/config';
import { deployMockUSDC } from '../../helpers/contracts-deployments';
import { getFirstSigner } from '../../helpers/contracts-getters';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

task('sturdy:testnet:usdc', 'Deploy usdc token')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    await DRE.run('set-DRE');

    console.log('Deploying usdc token started\n');
    const signer = await getFirstSigner();
    const usdc_minter = await signer.getAddress();
    const usdc = await deployMockUSDC(['USDC', 'USDC', 6, usdc_minter], verify);
    //first param is random txHash to mock
    await usdc.Swapin(
      '0xf46b121a8bf6c2612ca202023f93cba708ecb1771da365029072a2f9930ddc76',
      usdc_minter,
      await convertToCurrencyDecimals(usdc.address, '1000000')
    );
    console.log(`usdc address `, usdc.address);
  });
