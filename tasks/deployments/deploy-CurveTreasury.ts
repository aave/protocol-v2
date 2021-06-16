import { task } from 'hardhat/config';
import { CRV_TOKEN, CURVE_CONFIG, ZERO_ADDRESS } from '../../helpers/constants';
import {
  deployCurveTreasury,
  deployInitializableAdminUpgradeabilityProxy,
} from '../../helpers/contracts-deployments';
import { waitForTx } from '../../helpers/misc-utils';

task(`deploy-curve-treasury`, `Deploys the CurveTreasury contract`)
  .addParam('proxyAdmin')
  .addParam('treasuryAdmin')
  .addFlag('verify', `Verify contract via Etherscan API.`)
  .setAction(async ({ verify, proxyAdmin, treasuryAdmin }, localBRE) => {
    await localBRE.run('set-DRE');

    const net = localBRE.network.name;
    console.log(`\n- Curve Treasury deployment`);

    const implementation = await deployCurveTreasury(
      CURVE_CONFIG.votingEscrow[net],
      CRV_TOKEN[net],
      CURVE_CONFIG.curveFeeDistributor[net],
      CURVE_CONFIG.gaugeController[net],
      ZERO_ADDRESS,
      verify
    );

    const proxy = await deployInitializableAdminUpgradeabilityProxy(verify);
    const encoded = implementation.interface.encodeFunctionData('initialize', [
      treasuryAdmin,
      [],
      [],
      [],
    ]);
    await waitForTx(await proxy.initialize(implementation.address, proxyAdmin, encoded));

    console.log(`\tFinished CurveTreasury deployment`);
    console.log(`\tProxy:`, proxy.address);
    console.log(`\tImpl:`, implementation.address);
  });
