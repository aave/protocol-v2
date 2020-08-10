import {expect} from 'chai';
import {makeSuite, TestEnv} from './helpers/make-suite';
import {ProtocolErrors, eContractid} from '../helpers/types';
import {deployGenericAToken, getAToken, deployContract} from '../helpers/contracts-helpers';
import {MockAToken} from '../types/MockAToken';

makeSuite('Upgradeability', (testEnv: TestEnv) => {
  const {INVALID_POOL_MANAGER_CALLER_MSG} = ProtocolErrors;
  let newATokenAddress: string;

  before('deploying instances', async () => {
    const {dai, pool} = testEnv;
    const aTokenInstance = await deployContract<MockAToken>(eContractid.MockAToken, [
      pool.address,
      dai.address,
      'Aave Interest bearing DAI updated',
      'aDAI',
    ]);

    newATokenAddress = aTokenInstance.address;
  });

  it('Tries to update the DAI Atoken implementation with a different address than the lendingPoolManager', async () => {
    const {dai, configurator, users} = testEnv;

    await expect(
      configurator.connect(users[1].signer).updateAToken(dai.address, newATokenAddress)
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it('Upgrades the DAI Atoken implementation ', async () => {
    const {dai, configurator, aDai} = testEnv;

    const name = await (await getAToken(newATokenAddress)).name();

    await configurator.updateAToken(dai.address, newATokenAddress);

    const tokenName = await aDai.name();

    expect(tokenName).to.be.eq('Aave Interest bearing DAI updated', 'Invalid token name');
  });
});
