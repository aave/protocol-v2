import rawBRE from "@nomiclabs/buidler";
import {expect} from "chai";
import {MockProvider} from "ethereum-waffle";
import {BuidlerRuntimeEnvironment} from "@nomiclabs/buidler/types";
import {deployLendingPoolAddressesProvider} from "../helpers/contracts-helpers";
import {LendingPoolAddressesProvider} from "../types/LendingPoolAddressesProvider";
import {createRandomAddress} from "../helpers/misc-utils";

describe("LendingPoolAddressesProvider", () => {
  const wallets = new MockProvider().getWallets();
  let BRE: BuidlerRuntimeEnvironment;

  before(async () => {
    BRE = await rawBRE.run("set-bre");
  });

  it("Test the accessibility of the LendingPoolAddressesProvider", async () => {
    const mockAddress = createRandomAddress();
    const INVALID_OWNER_REVERT_MSG = "Ownable: caller is not the owner";
    const addressesProvider = (await deployLendingPoolAddressesProvider()) as LendingPoolAddressesProvider;
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
