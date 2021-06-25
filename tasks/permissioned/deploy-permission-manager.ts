import { task } from 'hardhat/config';

import { PermissionManagerFactory } from '../../types';
import { verifyContract } from '../../helpers/contracts-helpers';
import { eContractid } from '../../helpers/types';
import { insertContractAddressInDb } from '../../helpers/contracts-helpers';
import { getLendingPoolAddressesProvider } from '../../helpers/contracts-getters';
import { waitForTx } from '../../helpers/misc-utils';
import { ethers } from 'ethers';

task(`deploy-permission-manager`, `Deploys the PermissionManager contract`)
  .addFlag('verify', 'Verify PermissionManager contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    console.log(`\n- PermissionManager deployment`);

    console.log(`\tDeploying PermissionManager implementation ...`);
    const permissionManagerInstance = await new PermissionManagerFactory(
      await localBRE.ethers.provider.getSigner()
    ).deploy();

    await permissionManagerInstance.deployTransaction.wait();

    console.log('Permission manager address', permissionManagerInstance.address);
    if (verify) {
      await verifyContract(eContractid.PermissionManager, permissionManagerInstance, []);
    }

    // register the permission manager in the addresses provider
    const addressesProvider = await getLendingPoolAddressesProvider();
    const permissionManagerHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes('PERMISSION_MANAGER')
    );

    await waitForTx(
      await addressesProvider.setAddress(permissionManagerHash, permissionManagerInstance.address)
    );

    // store the permission manager contract in the DB
    await insertContractAddressInDb(
      eContractid.PermissionManager,
      permissionManagerInstance.address
    );

    console.log(`\tFinished PermissionManager implementation deployment`);
  });
