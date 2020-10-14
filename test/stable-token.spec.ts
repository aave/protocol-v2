import {expect} from 'chai';
import {makeSuite, TestEnv} from './helpers/make-suite';
import {ProtocolErrors, eContractid} from '../helpers/types';
import {getContract} from '../helpers/contracts-helpers';
import {StableDebtToken} from '../types/StableDebtToken';

makeSuite('Stable debt token tests', (testEnv: TestEnv) => {
  const {AT_CALLER_MUST_BE_LENDING_POOL} = ProtocolErrors;

  it('Tries to invoke mint not being the LendingPool', async () => {
    const {deployer, pool, dai} = testEnv;

    const daiStableDebtTokenAddress = (await pool.getReserveTokensAddresses(dai.address))
      .stableDebtTokenAddress;

    const stableDebtContract = await getContract<StableDebtToken>(
      eContractid.StableDebtToken,
      daiStableDebtTokenAddress
    );

    await expect(stableDebtContract.mint(deployer.address, '1', '1')).to.be.revertedWith(
      AT_CALLER_MUST_BE_LENDING_POOL
    );
  });

  it('Tries to invoke burn not being the LendingPool', async () => {
    const {deployer, pool, dai} = testEnv;

    const daiStableDebtTokenAddress = (await pool.getReserveTokensAddresses(dai.address))
      .stableDebtTokenAddress;

    const stableDebtContract = await getContract<StableDebtToken>(
      eContractid.StableDebtToken,
      daiStableDebtTokenAddress
    );

    await expect(stableDebtContract.burn(deployer.address, '1')).to.be.revertedWith(
      AT_CALLER_MUST_BE_LENDING_POOL
    );
  });
});
