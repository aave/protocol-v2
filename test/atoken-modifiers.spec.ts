import rawBRE from "@nomiclabs/buidler";
import {expect} from "chai";
import {MockProvider} from "ethereum-waffle";
import {BuidlerRuntimeEnvironment} from "@nomiclabs/buidler/types";
import {LendingPoolAddressesProvider} from "../types/LendingPoolAddressesProvider";
import {
  getLendingPoolAddressesProvider,
  getLendingPoolProxy,
  getAToken,
  getAaveProtocolTestHelpers,
} from "../helpers/contracts-helpers";
import {evmRevert} from "../helpers/misc-utils";

describe("AToken: Modifiers", () => {
  const wallets = new MockProvider().getWallets();
  let BRE: BuidlerRuntimeEnvironment;

  before(async () => {
    await evmRevert("0x1");
  });

  it("Tries to invoke mintOnDeposit", async () => {
    const testHelpers = await getAaveProtocolTestHelpers();
    console.log(await testHelpers.ADDRESSES_PROVIDER());
    console.log(await testHelpers.getAllATokens())
    // const aDAI = await getAToken(await lendingPool.getReserveConfigurationData())
    // await expectRevert(
    //   _aDAI.mintOnDeposit(deployer, "1"),
    //   "The caller of this function must be a lending pool"
    // );
  });

  // it("Tries to invoke burnOnLiquidation", async () => {
  //   await expectRevert(
  //     _aDAI.burnOnLiquidation(deployer, "1"),
  //     "The caller of this function must be a lending pool"
  //   );
  // });

  // it("Tries to invoke transferOnLiquidation", async () => {
  //   await expectRevert(
  //     _aDAI.transferOnLiquidation(deployer, users[1], "1"),
  //     "The caller of this function must be a lending pool"
  //   );
  // });
});
