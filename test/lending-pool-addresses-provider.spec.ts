import {expect} from "chai";
import {MockProvider} from "ethereum-waffle";
import {BuidlerRuntimeEnvironment} from "@nomiclabs/buidler/types";
import {getLendingPoolAddressesProvider} from "../helpers/contracts-helpers";
import {createRandomAddress, evmRevert} from "../helpers/misc-utils";

describe("LendingPoolAddressesProvider", () => {
  const wallets = new MockProvider().getWallets();

  before(async () => {
    await evmRevert("0x1");
  });

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
