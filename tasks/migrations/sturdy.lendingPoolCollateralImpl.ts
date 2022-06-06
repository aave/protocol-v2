import { task } from 'hardhat/config';
import { deployLendingPoolCollateralManagerImpl } from '../../helpers/contracts-deployments';

task('sturdy:lendingPoolCollateralImpl', 'Deploy lendingPoolCollateralManager Implementation')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    await DRE.run('set-DRE');

    console.log('Deploying lendingPoolCollateralImpl started\n');
    const lendingPoolCollateral = await deployLendingPoolCollateralManagerImpl(verify);
    console.log(`lendingPoolCollateralImpl address `, lendingPoolCollateral.address);
  });
