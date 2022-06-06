import { task } from 'hardhat/config';
import { deploySturdyTokenImpl } from '../../helpers/contracts-deployments';

task('sturdy:incentiveTokenImpl', 'Deploy incentiveToken Implementation')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    await DRE.run('set-DRE');

    console.log('Deploying incentiveTokenImpl started\n');
    const incentiveToken = await deploySturdyTokenImpl(verify);
    console.log(`incentiveTokenImpl address `, incentiveToken.address);
  });
