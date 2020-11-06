import {expect} from 'chai';
import {makeSuite, TestEnv} from './helpers/make-suite';
import {ProtocolErrors, eContractid} from '../helpers/types';
import {deployContract, getContract} from '../helpers/contracts-helpers';
import {MockAToken} from '../types/MockAToken';
import {MockStableDebtToken} from '../types/MockStableDebtToken';
import {MockVariableDebtToken} from '../types/MockVariableDebtToken';
import {ZERO_ADDRESS} from '../helpers/constants';
import {
  getAToken,
  getMockStableDebtToken,
  getMockVariableDebtToken,
  getVariableDebtToken,
} from '../helpers/contracts-getters';
import {
  deployMockAToken,
  deployMockStableDebtToken,
  deployMockVariableDebtToken,
} from '../helpers/contracts-deployments';

makeSuite('Upgradeability', (testEnv: TestEnv) => {
  const {CALLER_NOT_POOL_ADMIN} = ProtocolErrors;
  let newATokenAddress: string;
  let newStableTokenAddress: string;
  let newVariableTokenAddress: string;

  before('deploying instances', async () => {
    const {dai, pool} = testEnv;
    const aTokenInstance = await deployMockAToken([
      pool.address,
      dai.address,
      ZERO_ADDRESS,
      'Aave Interest bearing DAI updated',
      'aDAI',
      ZERO_ADDRESS,
    ]);

    const stableDebtTokenInstance = await deployMockStableDebtToken([
      pool.address,
      dai.address,
      'Aave stable debt bearing DAI updated',
      'stableDebtDAI',
      ZERO_ADDRESS,
    ]);

    const variableDebtTokenInstance = await deployMockVariableDebtToken([
      pool.address,
      dai.address,
      'Aave variable debt bearing DAI updated',
      'variableDebtDAI',
      ZERO_ADDRESS,
    ]);

    newATokenAddress = aTokenInstance.address;
    newVariableTokenAddress = variableDebtTokenInstance.address;
    newStableTokenAddress = stableDebtTokenInstance.address;
  });

  it('Tries to update the DAI Atoken implementation with a different address than the lendingPoolManager', async () => {
    const {dai, configurator, users} = testEnv;

    await expect(
      configurator.connect(users[1].signer).updateAToken(dai.address, newATokenAddress)
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Upgrades the DAI Atoken implementation ', async () => {
    const {dai, configurator, aDai} = testEnv;

    const name = await (await getAToken(newATokenAddress)).name();

    await configurator.updateAToken(dai.address, newATokenAddress);

    const tokenName = await aDai.name();

    expect(tokenName).to.be.eq('Aave Interest bearing DAI updated', 'Invalid token name');
  });

  it('Tries to update the DAI Stable debt token implementation with a different address than the lendingPoolManager', async () => {
    const {dai, configurator, users} = testEnv;

    await expect(
      configurator
        .connect(users[1].signer)
        .updateStableDebtToken(dai.address, newStableTokenAddress)
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Upgrades the DAI stable debt token implementation ', async () => {
    const {dai, configurator, pool, helpersContract} = testEnv;

    const name = await (await getAToken(newATokenAddress)).name();

    await configurator.updateStableDebtToken(dai.address, newStableTokenAddress);

    const {stableDebtTokenAddress} = await helpersContract.getReserveTokensAddresses(dai.address);

    const debtToken = await getMockStableDebtToken(stableDebtTokenAddress);

    const tokenName = await debtToken.name();

    expect(tokenName).to.be.eq('Aave stable debt bearing DAI updated', 'Invalid token name');
  });

  it('Tries to update the DAI variable debt token implementation with a different address than the lendingPoolManager', async () => {
    const {dai, configurator, users} = testEnv;

    await expect(
      configurator
        .connect(users[1].signer)
        .updateVariableDebtToken(dai.address, newVariableTokenAddress)
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Upgrades the DAI variable debt token implementation ', async () => {
    const {dai, configurator, pool, helpersContract} = testEnv;

    const name = await (await getAToken(newATokenAddress)).name();

    await configurator.updateVariableDebtToken(dai.address, newVariableTokenAddress);

    const {variableDebtTokenAddress} = await helpersContract.getReserveTokensAddresses(dai.address);

    const debtToken = await getMockVariableDebtToken(variableDebtTokenAddress);

    const tokenName = await debtToken.name();

    expect(tokenName).to.be.eq('Aave variable debt bearing DAI updated', 'Invalid token name');
  });
});
