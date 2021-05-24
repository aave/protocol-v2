import { task } from 'hardhat/config';
import {
  loadPoolConfig,
  ConfigNames,
  getWrappedNativeTokenAddress,
} from '../../helpers/configuration';
import { deployPermissionedWETHGateway, deployWETHGateway } from '../../helpers/contracts-deployments';
import { getFirstSigner, getPermissionManager } from '../../helpers/contracts-getters';
import { waitForTx } from '../../helpers/misc-utils';

const CONTRACT_NAME = 'WETHGateway';

task(`full-deploy-permissioned-weth-gateway`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const poolConfig = loadPoolConfig(pool);
    const Weth = await getWrappedNativeTokenAddress(poolConfig);

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }
    const wethGateWay = await deployPermissionedWETHGateway([Weth], verify);

    const deployer = await getFirstSigner();
    const deployerAddress = await deployer.getAddress();

    //adding permissions to the permission manager for the weth gateway
    const permissionManager = await getPermissionManager();

    
    await waitForTx(await permissionManager.addPermissionAdmins([deployerAddress]));

    await waitForTx(await permissionManager.connect(deployer).addPermissions([0, 1],[deployerAddress, deployerAddress] ));

    await waitForTx(await permissionManager.removePermissionAdmins([deployerAddress]));
    
    console.log(`${CONTRACT_NAME}.address`, wethGateWay.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
