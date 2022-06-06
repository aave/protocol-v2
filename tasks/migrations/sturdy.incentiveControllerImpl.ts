import { task } from 'hardhat/config';
import { deploySturdyIncentivesControllerImpl } from '../../helpers/contracts-deployments';
import { getFirstSigner } from '../../helpers/contracts-getters';

task('sturdy:incentiveControllerImpl', 'Deploy incentiveController Implementation')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    await DRE.run('set-DRE');
    const signer = await getFirstSigner();
    const EMISSION_EXECUTOR = await signer.getAddress();

    console.log('Deploying incentiveControllerImpl started\n');
    const incentiveController = await deploySturdyIncentivesControllerImpl(
      [EMISSION_EXECUTOR],
      verify
    );
    console.log(`incentiveControllerImpl address `, incentiveController.address);
  });
