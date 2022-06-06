import { task } from 'hardhat/config';
import { deployLendingPoolImpl } from '../../helpers/contracts-deployments';

task('sturdy:lendingPoolImpl', 'Deploy lendingPool Implementation')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    await DRE.run('set-DRE');

    console.log('Deploying lendingPoolImpl started\n');
    const lendingPool = await deployLendingPoolImpl(verify);
    console.log(`lendingPoolImpl address `, lendingPool.address);
  });
