import {expect} from 'chai';
import {makeSuite, TestEnv} from './helpers/make-suite';
import {ProtocolErrors} from '../helpers/types';

makeSuite('AToken: Modifiers', (testEnv: TestEnv) => {
  const {INVALID_POOL_CALLER_MSG_1} = ProtocolErrors;

  it('Tries to invoke mintOnDeposit not being the LendingPool', async () => {
    const {deployer, aDai} = testEnv;
    await expect(aDai.mintOnDeposit(deployer.address, '1')).to.be.revertedWith(
      INVALID_POOL_CALLER_MSG_1
    );
  });

  it('Tries to invoke burnOnLiquidation not being the LendingPool', async () => {
    const {deployer, aDai} = testEnv;
    await expect(aDai.burnOnLiquidation(deployer.address, '1')).to.be.revertedWith(
      INVALID_POOL_CALLER_MSG_1
    );
  });

  it('Tries to invoke transferOnLiquidation not being the LendingPool', async () => {
    const {deployer, users, aDai} = testEnv;
    await expect(
      aDai.transferOnLiquidation(deployer.address, users[0].address, '1')
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG_1);
  });
});
