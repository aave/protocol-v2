import {expect} from "chai";
import {MockProvider} from "ethereum-waffle";
import {
  getAToken,
  getAaveProtocolTestHelpers,
} from "../helpers/contracts-helpers";
import {evmRevert} from "../helpers/misc-utils";
import {AToken} from "../types/AToken";
import {TEST_SNAPSHOT_ID} from "../helpers/constants";

describe("AToken: Modifiers", () => {
  const [deployer, ...restWallets] = new MockProvider().getWallets();
  let _aDAI = {} as AToken;
  const NOT_LENDING_POOL_MSG =
    "The caller of this function must be a lending pool";

  before(async () => {
    await evmRevert(TEST_SNAPSHOT_ID);
    const testHelpers = await getAaveProtocolTestHelpers();

    const aDAIAddress = (await testHelpers.getAllATokens()).find(
      (aToken) => aToken.symbol === "aDAI"
    )?.tokenAddress;
    if (!aDAIAddress) {
      console.log(`atoken-modifiers.spec: aDAI not correctly initialized`);
      process.exit(1);
    }
    _aDAI = await getAToken(aDAIAddress);
  });

  it("Tries to invoke mintOnDeposit not being the LendingPool", async () => {
    await expect(_aDAI.mintOnDeposit(deployer.address, "1")).to.be.revertedWith(
      NOT_LENDING_POOL_MSG
    );
  });

  it("Tries to invoke burnOnLiquidation not being the LendingPool", async () => {
    await expect(
      _aDAI.burnOnLiquidation(deployer.address, "1")
    ).to.be.revertedWith(NOT_LENDING_POOL_MSG);
  });

  it("Tries to invoke transferOnLiquidation not being the LendingPool", async () => {
    await expect(
      _aDAI.transferOnLiquidation(deployer.address, restWallets[0].address, "1")
    ).to.be.revertedWith(NOT_LENDING_POOL_MSG);
  });
});
