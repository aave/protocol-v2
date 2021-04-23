import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { deployContract } from '../../helpers/contracts-helpers';

import { PermissionManager } from '../../types';

makeSuite('Permission manager', (testEnv: TestEnv) => {
  let permissionManager: PermissionManager;
  const DEPOSITOR = 0, BORROWER = 1, LIQUIDATOR = 2;

  before('deploying a new Permission manager', async () => {
    permissionManager = await deployContract<PermissionManager>('PermissionManager', []);
  });

  it('Adds user 0 as permission admin', async () => {
    const { users } = testEnv;

    await permissionManager.addPermissionAdmins([users[0].address]);

    const isPermissionAdmin = await permissionManager.isPermissionsAdmin(users[0].address);

    expect(isPermissionAdmin).to.be.equal(true);
  });

  it('Registers a new depositor', async () => {
    const { users } = testEnv;

    await permissionManager.connect(users[0].signer).addPermissions([DEPOSITOR], [users[0].address]);

    const isDepositor = await permissionManager.isInRole(users[0].address, DEPOSITOR);
    const isBorrower = await permissionManager.isInRole(users[0].address, BORROWER);
    const isLiquidator = await permissionManager.isInRole(users[0].address, LIQUIDATOR);

    expect(isDepositor).to.be.equal(true);
    expect(isBorrower).to.be.equal(false);
    expect(isLiquidator).to.be.equal(false);
  });

  it('Registers a new borrower', async () => {
    const { users } = testEnv;

    await permissionManager.connect(users[0].signer).addPermissions([BORROWER], [users[0].address]);

    const isDepositor = await permissionManager.isInRole(users[0].address, DEPOSITOR);
    const isBorrower = await permissionManager.isInRole(users[0].address, BORROWER);
    const isLiquidator = await permissionManager.isInRole(users[0].address, LIQUIDATOR);

    expect(isDepositor).to.be.equal(true);
    expect(isBorrower).to.be.equal(true);
    expect(isLiquidator).to.be.equal(false);
  });

  it('Registers a new liquidator', async () => {
    const { users } = testEnv;

    await permissionManager.connect(users[0].signer).addPermissions([LIQUIDATOR], [users[0].address]);

    const isDepositor = await permissionManager.isInRole(users[0].address, DEPOSITOR);
    const isBorrower = await permissionManager.isInRole(users[0].address, BORROWER);
    const isLiquidator = await permissionManager.isInRole(users[0].address, LIQUIDATOR);

    expect(isDepositor).to.be.equal(true);
    expect(isBorrower).to.be.equal(true);
    expect(isLiquidator).to.be.equal(true);
  });

  it('Checks getPermissions', async () => {
    const { users } = testEnv;

    const {
      0: permissions,
    } = await permissionManager.getAccountPermissions(users[0].address);

    const mappedPermissions = permissions.map(item => item.toString());

    expect(mappedPermissions.indexOf(BORROWER.toString())).to.be.gte(0);
    expect(mappedPermissions.indexOf(DEPOSITOR.toString())).to.be.gte(0);
    expect(mappedPermissions.indexOf(LIQUIDATOR.toString())).to.be.gte(0);
  });

  it('Removes the depositor', async () => {
    const { users } = testEnv;

    await permissionManager.connect(users[0].signer).removePermissions([DEPOSITOR], [users[0].address]);

    const isDepositor = await permissionManager.isInRole(users[0].address, DEPOSITOR);
    const isBorrower = await permissionManager.isInRole(users[0].address, BORROWER);
    const isLiquidator = await permissionManager.isInRole(users[0].address, LIQUIDATOR);

    expect(isDepositor).to.be.equal(false);
    expect(isBorrower).to.be.equal(true);
    expect(isLiquidator).to.be.equal(true);
  });

  it('Removes the borrower', async () => {
    const { users } = testEnv;

    await permissionManager.connect(users[0].signer).removePermissions([BORROWER], [users[0].address]);

    const isDepositor = await permissionManager.isInRole(users[0].address, DEPOSITOR);
    const isBorrower = await permissionManager.isInRole(users[0].address, BORROWER);
    const isLiquidator = await permissionManager.isInRole(users[0].address, LIQUIDATOR);

    expect(isDepositor).to.be.equal(false);
    expect(isBorrower).to.be.equal(false);
    expect(isLiquidator).to.be.equal(true);
  });

  it('Removes the liquidator', async () => {
    const { users } = testEnv;

    await permissionManager.connect(users[0].signer).removePermissions([LIQUIDATOR], [users[0].address]);

    const isDepositor = await permissionManager.isInRole(users[0].address, DEPOSITOR);
    const isBorrower = await permissionManager.isInRole(users[0].address, BORROWER);
    const isLiquidator = await permissionManager.isInRole(users[0].address, LIQUIDATOR);

    expect(isDepositor).to.be.equal(false);
    expect(isBorrower).to.be.equal(false);
    expect(isLiquidator).to.be.equal(false);
  });

  it('Checks getPermissions', async () => {
    const { users } = testEnv;

    const {
      1: permissionsCount
    } = await permissionManager.getAccountPermissions(users[0].address);


    expect(permissionsCount).to.be.equal(0);
  });

  it('Checks that only the permissions manager can set permissions', async () => {
    const { users } = testEnv;

    await expect(permissionManager.connect(users[1].signer).addPermissions([], [])).to.be
      .reverted;
    await expect(permissionManager.connect(users[1].signer).removePermissions([], [])).to.be
      .reverted;
  });

  it('Checks that only the owner can add permissions admins', async () => {
    const { users } = testEnv;

    await expect(permissionManager.connect(users[1].signer).addPermissionAdmins([])).to.be
      .reverted;
    await expect(permissionManager.connect(users[1].signer).addPermissionAdmins([])).to.be
      .reverted;
  });


  it('Add borrower role to user 0. Removes permission admin to user 0, check permission admin is removed and other permissions are not affected', async () => {
    const { users } = testEnv;


    await permissionManager.connect(users[0].signer).addPermissions([BORROWER], [users[0].address]);

    await permissionManager.removePermissionAdmins([users[0].address]);

    const isPermissionAdmin = await permissionManager.isPermissionsAdmin(users[0].address);
    const isBorrower = await permissionManager.isInRole(users[0].address, BORROWER);


    expect(isPermissionAdmin).to.be.equal(false);
    expect(isBorrower).to.be.equal(true);
  });
});
