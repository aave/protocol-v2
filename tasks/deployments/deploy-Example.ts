import { task } from "@nomiclabs/buidler/config";
import { eContractid } from "../../helpers/types";
import {
  registerContractInJsonDb,
  deployExampleContract,
} from "../../helpers/contracts-helpers";

const { Example } = eContractid;

task(`deploy-${Example}`, `Deploys the ${Example} contract`).setAction(
  async ({}, localBRE) => {
    await localBRE.run("set-bre");

    console.log(`Deploying ${Example} ...\n`);

    const example = await deployExampleContract();
    await example.deployTransaction.wait();

    await registerContractInJsonDb(`${Example}`, example);

    return example;
  }
);
