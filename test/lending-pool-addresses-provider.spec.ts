import {expect} from "chai";
import {createRandomAddress} from "../helpers/misc-utils";
import {makeSuite, TestEnv} from "./helpers/make-suite";
import {ProtocolErrors} from "../helpers/types";

makeSuite("LendingPoolAddressesProvider", (testEnv: TestEnv) => {
  it("Test the accessibility of the LendingPoolAddressesProvider", async () => {
    const {addressesProvider, users} = testEnv;
    const mockAddress = createRandomAddress();
    const {INVALID_OWNER_REVERT_MSG} = ProtocolErrors;

    await addressesProvider.transferOwnership(users[1].address);

    for (const contractFunction of [
      addressesProvider.setFeeProviderImpl,
      addressesProvider.setLendingPoolImpl,
      addressesProvider.setLendingPoolConfiguratorImpl,
      addressesProvider.setLendingPoolCoreImpl,
      addressesProvider.setLendingPoolDataProviderImpl,
      addressesProvider.setLendingPoolLiquidationManager,
      addressesProvider.setLendingPoolManager,
      addressesProvider.setLendingPoolParametersProviderImpl,
      addressesProvider.setPriceOracle,
      addressesProvider.setLendingRateOracle,
    ]) {
      await expect(contractFunction(mockAddress)).to.be.revertedWith(
        INVALID_OWNER_REVERT_MSG
      );
    }
  });
});
