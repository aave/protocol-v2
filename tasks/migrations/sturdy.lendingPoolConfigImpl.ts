import { task } from 'hardhat/config';
import { deployLendingPoolConfiguratorImpl } from '../../helpers/contracts-deployments';

task('sturdy:lendingPoolConfigImpl', 'Deploy lendingPoolConfigurator Implementation')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    await DRE.run('set-DRE');

    console.log('Deploying lendingPoolConfigImpl started\n');
    const lendingPoolConfig = await deployLendingPoolConfiguratorImpl(verify);
    console.log(`lendingPoolConfigImpl address `, lendingPoolConfig.address);
  });
