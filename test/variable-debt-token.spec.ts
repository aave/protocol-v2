import {expect} from 'chai';
import {makeSuite, TestEnv} from './helpers/make-suite';
import {ProtocolErrors, TokenContractId, eContractid} from '../helpers/types';
import {getContract} from '../helpers/contracts-helpers';
import {VariableDebtToken} from '../types/VariableDebtToken';

makeSuite('Variable debt token tests', (testEnv: TestEnv) => {
  const {INVALID_POOL_CALLER_MSG_1} = ProtocolErrors;

  it('Tries to invoke mint not being the LendingPool', async () => {
    const {deployer, pool, dai} = testEnv;

    const daiVariableDebtTokenAddress = (await pool.getReserveTokensAddresses(dai.address))
      .variableDebtTokenAddress;

    const variableDebtContract = await getContract<VariableDebtToken>(
      eContractid.VariableDebtToken,
      daiVariableDebtTokenAddress
    );

    await expect(variableDebtContract.mint(deployer.address, '1')).to.be.revertedWith(
      INVALID_POOL_CALLER_MSG_1
    );
  });

  it('Tries to invoke burn not being the LendingPool', async () => {
    const {deployer, pool, dai} = testEnv;

    const daiVariableDebtTokenAddress = (await pool.getReserveTokensAddresses(dai.address))
      .variableDebtTokenAddress;

    const variableDebtContract = await getContract<VariableDebtToken>(
      eContractid.VariableDebtToken,
      daiVariableDebtTokenAddress
    );

    await expect(variableDebtContract.burn(deployer.address, '1')).to.be.revertedWith(
      INVALID_POOL_CALLER_MSG_1
    );
  });
});
