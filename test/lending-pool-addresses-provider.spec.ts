import {expect} from "chai";
import {MockProvider} from "ethereum-waffle";
import {getLendingPoolAddressesProvider} from "../helpers/contracts-helpers";
import {createRandomAddress, evmRevert} from "../helpers/misc-utils";
import {TEST_SNAPSHOT_ID} from "../helpers/constants";
import { makeSuite } from './helpers/make-suite';

makeSuite("LendingPoolAddressesProvider", () => {
  const wallets = new MockProvider().getWallets();

  it("Test the accessibility of the LendingPoolAddressesProvider", async () => {
    const mockAddress = createRandomAddress();
    const INVALID_OWNER_REVERT_MSG = "Ownable: caller is not the owner";
    const addressesProvider = await getLendingPoolAddressesProvider();
    await addressesProvider.transferOwnership(wallets[1].address);

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
