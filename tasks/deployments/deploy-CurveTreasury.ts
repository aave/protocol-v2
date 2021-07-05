import { task } from 'hardhat/config';
import { loadPoolConfig } from '../../helpers/configuration';
import { CRV_TOKEN, CURVE_CONFIG, ZERO_ADDRESS } from '../../helpers/constants';
import {
  deployCurveTreasury,
  deployInitializableAdminUpgradeabilityProxy,
} from '../../helpers/contracts-deployments';
import { waitForTx } from '../../helpers/misc-utils';

task(`deploy-curve-treasury`, `Deploys the CurveTreasury contract`)
  .addParam('proxyAdmin')
  .addParam('treasuryAdmin')
  .addOptionalParam('collector')
  .addFlag('verify', `Verify contract via Etherscan API.`)
  .setAction(async ({ verify, proxyAdmin, treasuryAdmin, collector }, localBRE) => {
    await localBRE.run('set-DRE');

    const net = process.env.FORK ? process.env.FORK : localBRE.network.name;
    console.log(`\n- Curve Treasury deployment`);
    const aaveCollector = collector || ZERO_ADDRESS;

    // Deploy implementation
    const implementation = await deployCurveTreasury(
      CURVE_CONFIG.votingEscrow[net],
      CRV_TOKEN[net],
      CURVE_CONFIG.curveFeeDistributor[net],
      CURVE_CONFIG.gaugeController[net],
      aaveCollector,
      verify
    );

    // Freeze implementatation
    await waitForTx(await implementation.initialize(ZERO_ADDRESS));

    // Deploy proxy
    const proxy = await deployInitializableAdminUpgradeabilityProxy(verify);

    const encoded = implementation.interface.encodeFunctionData('initialize', [treasuryAdmin]);
    await waitForTx(
      await proxy['initialize(address,address,bytes)'](implementation.address, proxyAdmin, encoded)
    );

    console.log(`\tFinished CurveTreasury deployment`);
    console.log(`\tProxy:`, proxy.address);
    console.log(`\tImpl:`, implementation.address);

    return { implementation: implementation.address, proxy: proxy.address };
  });
