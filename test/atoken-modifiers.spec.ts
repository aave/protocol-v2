import rawBRE from "@nomiclabs/buidler";
import {expect} from "chai";
import {MockProvider} from "ethereum-waffle";
import {BuidlerRuntimeEnvironment} from "@nomiclabs/buidler/types";
import {LendingPoolAddressesProvider} from "../types/LendingPoolAddressesProvider";
import {getLendingPoolAddressesProvider} from "../helpers/contracts-helpers";
import {evmRevert} from "../helpers/misc-utils";

describe("AToken: Modifiers", () => {
  const wallets = new MockProvider().getWallets();
  let BRE: BuidlerRuntimeEnvironment;
  let _addressesProvider: LendingPoolAddressesProvider;

  before(async () => {
    await evmRevert("0x1");
    _addressesProvider = await getLendingPoolAddressesProvider();
    console.log(await _addressesProvider.getLendingPoolCore());
  });

  it("Test the accessibility of the LendingPoolAddressesProvider", async () => {});
});

// contract("AToken: Modifiers", async ([deployer, ...users]) => {
//   let _testEnvProvider: ITestEnvWithoutInstances;
//   let _aDAI: ATokenInstance;

//   before("Initializing test variables", async () => {
//     console.time("setup-test");
//     _testEnvProvider = await testEnvProviderWithoutInstances(artifacts, [
//       deployer,
//       ...users,
//     ]);

//     const {getATokenInstances} = _testEnvProvider;

//     _aDAI = (await getATokenInstances()).aDAI;

//     console.timeEnd("setup-test");
//   });

//   it("Tries to invoke mintOnDeposit", async () => {
//     await expectRevert(
//       _aDAI.mintOnDeposit(deployer, "1"),
//       "The caller of this function must be a lending pool"
//     );
//   });

//   it("Tries to invoke burnOnLiquidation", async () => {
//     await expectRevert(
//       _aDAI.burnOnLiquidation(deployer, "1"),
//       "The caller of this function must be a lending pool"
//     );
//   });

//   it("Tries to invoke transferOnLiquidation", async () => {
//     await expectRevert(
//       _aDAI.transferOnLiquidation(deployer, users[1], "1"),
//       "The caller of this function must be a lending pool"
//     );
//   });
// });
