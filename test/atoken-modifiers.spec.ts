import {expect} from "chai";
import {getAToken} from "../helpers/contracts-helpers";
import {AToken} from "../types/AToken";
import {makeSuite, TestEnv} from "./helpers/make-suite";

makeSuite("AToken: Modifiers", (testEnv: TestEnv) => {
  let _aDAI = {} as AToken;
  const NOT_LENDING_POOL_MSG =
    "The caller of this function must be a lending pool";

  before(async () => {
    const {helpersContract} = testEnv;

    const aDAIAddress = (await helpersContract.getAllATokens()).find(
      (aToken) => aToken.symbol === "aDAI"
    )?.tokenAddress;
    if (!aDAIAddress) {
      console.log(`atoken-modifiers.spec: aDAI not correctly initialized`);
      process.exit(1);
    }
    _aDAI = await getAToken(aDAIAddress);
  });

  it("Tries to invoke mintOnDeposit not being the LendingPool", async () => {
    const {deployer} = testEnv;
    await expect(_aDAI.mintOnDeposit(deployer.address, "1")).to.be.revertedWith(
      NOT_LENDING_POOL_MSG
    );
  });

  it("Tries to invoke burnOnLiquidation not being the LendingPool", async () => {
    const {deployer} = testEnv;
    await expect(
      _aDAI.burnOnLiquidation(deployer.address, "1")
    ).to.be.revertedWith(NOT_LENDING_POOL_MSG);
  });

  it("Tries to invoke transferOnLiquidation not being the LendingPool", async () => {
    const {deployer, users} = testEnv;
    await expect(
      _aDAI.transferOnLiquidation(deployer.address, users[0].address, "1")
    ).to.be.revertedWith(NOT_LENDING_POOL_MSG);
  });
});
