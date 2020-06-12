import {expect} from "chai";
import {makeSuite, TestEnv} from "./helpers/make-suite";

makeSuite("AToken: Modifiers", (testEnv: TestEnv) => {
  const NOT_LENDING_POOL_MSG =
    "The caller of this function must be a lending pool";

  it("Tries to invoke mintOnDeposit not being the LendingPool", async () => {
    const {deployer, aDai} = testEnv;
    await expect(aDai.mintOnDeposit(deployer.address, "1")).to.be.revertedWith(
      NOT_LENDING_POOL_MSG
    );
  });

  it("Tries to invoke burnOnLiquidation not being the LendingPool", async () => {
    const {deployer, aDai} = testEnv;
    await expect(
      aDai.burnOnLiquidation(deployer.address, "1")
    ).to.be.revertedWith(NOT_LENDING_POOL_MSG);
  });

  it("Tries to invoke transferOnLiquidation not being the LendingPool", async () => {
    const {deployer, users, aDai} = testEnv;
    await expect(
      aDai.transferOnLiquidation(deployer.address, users[0].address, "1")
    ).to.be.revertedWith(NOT_LENDING_POOL_MSG);
  });
});
