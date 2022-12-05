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
import { deployWETHMocked } from '../../helpers/contracts-deployments';

task(`full-add-admin`, `Whitelists an admin into the arc market`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const poolConfig = loadPoolConfig(pool);

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const NEW_PERMISSION_ADMIN = '0x3f1Cf2c4Ed96554b76763C8b38D66B66cc48E841';
    const PERMISSION_MANAGER_ADDRESS = '0x8F30ec9Fb348513494cCC1710528E744Efa71003';

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
  const POOL_ADDRESSES_PROVIDER = '0x56033E114c61183590d39BA847400F02022Ebe47';
  const provider = await getLendingPoolAddressesProvider(POOL_ADDRESSES_PROVIDER);
  console.log('Emergency Admin address:', await provider.connect(nonAdmin).getEmergencyAdmin());
  console.log('Signer: ', await deployer.getAddress());
  const pool = await getLendingPool(await provider.connect(nonAdmin).getLendingPool());

  const configurator = await getLendingPoolConfiguratorProxy(
    await provider.connect(nonAdmin).getLendingPoolConfigurator()
  );

  await configurator.connect(deployer).setPoolPause(false);
});

task(`deploy-weth-mocks`, `Deploys the Weth9 mocks for arc goerli`).setAction(
  async ({}, localBRE) => {
    await localBRE.run('set-DRE');
    const deployer = await getFirstSigner();

    const wethMock = await deployWETHMocked(true);
    console.log('deployed wethmock', wethMock);
  }
);
