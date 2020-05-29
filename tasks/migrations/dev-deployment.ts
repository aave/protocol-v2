import { task } from "@nomiclabs/buidler/config";
import { eContractid } from "../../helpers/types";
import { expect } from "chai";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { Example } from "../../types/Example";

task("dev-deployment", "Deployment in buidlerevm").setAction(
  async (_, localBRE) => {
    const BRE: BuidlerRuntimeEnvironment = await localBRE.run("set-bre");

    const example = (await BRE.run(`deploy-${eContractid.Example}`)) as Example;

    expect((await example.test()).toString()).to.equal(
      "5",
      "INVALID_TEST_VALUE"
    );
  }
);
