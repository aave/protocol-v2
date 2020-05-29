import rawBRE from "@nomiclabs/buidler";
import { expect } from "chai";
import { MockProvider } from "ethereum-waffle";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { deployExampleContract } from "../helpers/contracts-helpers";
import { Example } from "../types/Example";

describe("Example test", () => {
  const [wallet] = new MockProvider().getWallets();
  let BRE: BuidlerRuntimeEnvironment;

  before(async () => {
    console.log("To execute once per 'describe'");
    BRE = await rawBRE.run("set-bre");
  });

  it("test()", async () => {
    const example = (await deployExampleContract()) as Example;

    expect((await example.test()).toString()).to.equal(
      "5",
      "INVALID_TEST_VALUE"
    );
  });
});
