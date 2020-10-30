import {expect} from 'chai';
import {makeSuite, TestEnv} from './helpers/make-suite';
import {ProtocolErrors, eContractid} from '../helpers/types';
import {getContract} from '../helpers/contracts-helpers';
import {StableDebtToken} from '../types/StableDebtToken';

makeSuite('Stable debt token tests', (testEnv: TestEnv) => {
  const {CALLER_MUST_BE_LENDING_POOL} = ProtocolErrors;

  it('Tries to invoke mint not being the LendingPool', async () => {
    const {deployer, pool, dai, helpersContract} = testEnv;

    const daiStableDebtTokenAddress = (await helpersContract.getReserveTokensAddresses(dai.address))
      .stableDebtTokenAddress;

    const stableDebtContract = await getContract<StableDebtToken>(
      eContractid.StableDebtToken,
      daiStableDebtTokenAddress
    );

    await expect(stableDebtContract.mint(deployer.address, '1', '1')).to.be.revertedWith(
      CALLER_MUST_BE_LENDING_POOL
    );
  });

  it('Tries to invoke burn not being the LendingPool', async () => {
    const {deployer, dai, helpersContract} = testEnv;

    const daiStableDebtTokenAddress = (await helpersContract.getReserveTokensAddresses(dai.address))
      .stableDebtTokenAddress;

    const stableDebtContract = await getContract<StableDebtToken>(
      eContractid.StableDebtToken,
      daiStableDebtTokenAddress
    );

    const name = await stableDebtContract.name();

    expect(name).to.be.equal('Aave stable debt bearing DAI');
    await expect(stableDebtContract.burn(deployer.address, '1')).to.be.revertedWith(
      CALLER_MUST_BE_LENDING_POOL
    );
  });
});
