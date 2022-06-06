import { task } from 'hardhat/config';
import { deployMockUSDT } from '../../helpers/contracts-deployments';
import { getFirstSigner } from '../../helpers/contracts-getters';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

task('sturdy:testnet:usdt', 'Deploy usdt token')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    await DRE.run('set-DRE');

    console.log('Deploying usdt token started\n');
    const signer = await getFirstSigner();
    const usdt_minter = await signer.getAddress();
    const usdt = await deployMockUSDT(['USDT', 'USDT', 6, usdt_minter], verify);
    //first param is random txHash to mock
    await usdt.Swapin(
      '0xf46b121a8bf6c2612ca202023f93cba708ecb1771da365029072a2f9930ddc76',
      usdt_minter,
      await convertToCurrencyDecimals(usdt.address, '1000000')
    );
    console.log(`usdt address `, usdt.address);
  });
