import { task } from 'hardhat/config';
import { deployLidoVaultImpl } from '../../helpers/contracts-deployments';

task('sturdy:lidoVaultImpl', 'Deploy lidoVault Implementation')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    await DRE.run('set-DRE');

    console.log('Deploying lidoVaultImpl started\n');
    const lidoVault = await deployLidoVaultImpl(verify);
    console.log(`LidoVaultImpl address `, lidoVault.address);
  });
