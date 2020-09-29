import {expect} from 'chai';
import {createRandomAddress} from '../helpers/misc-utils';
import {makeSuite, TestEnv} from './helpers/make-suite';
import {ProtocolErrors} from '../helpers/types';
import {ethers} from 'ethers';
import {ZERO_ADDRESS} from '../helpers/constants';

const {utils} = ethers;

makeSuite('LendingPoolAddressesProvider', (testEnv: TestEnv) => {
  it('Test the accessibility of the LendingPoolAddressesProvider', async () => {
    const {addressesProvider, users} = testEnv;
    const mockAddress = createRandomAddress();
    const {INVALID_OWNER_REVERT_MSG} = ProtocolErrors;

    await addressesProvider.transferOwnership(users[1].address);

    for (const contractFunction of [
      addressesProvider.setLendingPoolImpl,
      addressesProvider.setLendingPoolConfiguratorImpl,
      addressesProvider.setLendingPoolCollateralManager,
      addressesProvider.setAaveAdmin,
      addressesProvider.setPriceOracle,
      addressesProvider.setLendingRateOracle,
    ]) {
      await expect(contractFunction(mockAddress)).to.be.revertedWith(INVALID_OWNER_REVERT_MSG);
    }

    await expect(
      addressesProvider.setAddress(
        utils.keccak256(utils.toUtf8Bytes('RANDOM_ID')),
        mockAddress,
        ZERO_ADDRESS
      )
    ).to.be.revertedWith(INVALID_OWNER_REVERT_MSG);
  });
});
