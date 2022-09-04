import { task } from 'hardhat/config';
import {
  loadPoolConfig,
  ConfigNames,
  getWethAddress,
  getTreasuryAddress,
} from '../../helpers/configuration';

import { waitForTx } from '../../helpers/misc-utils';
import {
  getFirstSigner,
  getPermissionManager,
  getLendingPoolAddressesProvider,
  getLendingPool,
  getLendingPoolConfiguratorProxy,
} from '../../helpers/contracts-getters';
import { getEthersSigners } from '../../helpers/contracts-helpers';

task(`full-add-admin`, `Whitelists an admin into the arc market`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const poolConfig = loadPoolConfig(pool);

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    // const NEW_PERMISSION_ADMIN = 'YOUR_ADDRESS';
    // const PERMISSION_MANAGER_ADDRESS = 'PERMISSION_MAN_ADDRESS';

    const NEW_PERMISSION_ADMIN = '0xfb2788b2A3a0242429fd9EE2b151e149e3b244eC';
    const PERMISSION_MANAGER_ADDRESS = '0x6ff4DE6185E08164D9c84aFcf11Eab9AC68ceCF9';

    const deployer = await getFirstSigner();
    const deployerAddress = await deployer.getAddress();
    console.log(`Signer: ${deployerAddress}`);

    //adding permissions to the permission manager for the weth gateway
    const permissionManager = await getPermissionManager(PERMISSION_MANAGER_ADDRESS);
    console.log('PermissionManager: ', permissionManager.address);

    await waitForTx(
      await permissionManager.connect(deployer).addPermissionAdmins([NEW_PERMISSION_ADMIN])
    );

    // borrow flag is 1, depositor 0
    await permissionManager
      .connect(deployer)
      .addPermissions([1, 0], [NEW_PERMISSION_ADMIN, NEW_PERMISSION_ADMIN]);

    console.log(`\tFinished adding ${NEW_PERMISSION_ADMIN} as permission admin`);
  });

task(`unpause-pool`, `Unpause-pool`).setAction(async ({}, localBRE) => {
  await localBRE.run('set-DRE');
  const deployer = await getFirstSigner();
  const users = await getEthersSigners();
  const nonAdmin = users[2];

  const emergencyAdmin = users[1];

  console.log('You need to use the Emergency Admin Address to unpause');
  const POOL_ADDRESSES_PROVIDER = '0x065B418fF4EdBA0c913029156f6f257884e92D82';
  const provider = await getLendingPoolAddressesProvider(POOL_ADDRESSES_PROVIDER);
  console.log('Emergency Admin address:', await provider.connect(nonAdmin).getEmergencyAdmin());
  console.log('Signer: ', await deployer.getAddress());
  const pool = await getLendingPool(await provider.connect(nonAdmin).getLendingPool());
  console.log(`\tPool paused? `, await pool.paused());

  const configurator = await getLendingPoolConfiguratorProxy(
    await provider.connect(nonAdmin).getLendingPoolConfigurator()
  );

  await configurator.connect(deployer).setPoolPause(false);

  console.log(`\tPool pause? `, await pool.paused());
});
