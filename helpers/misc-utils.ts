import BigNumber from "bignumber.js";
import BN = require("bn.js");
import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { WAD } from "./constants";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";

export const toWad = (value: string | number) =>
  new BigNumber(value).times(WAD).toFixed();

export const bnToBigNumber = (amount: BN): BigNumber =>
  new BigNumber(<any>amount);
export const stringToBigNumber = (amount: string): BigNumber =>
  new BigNumber(amount);

export const getDb = () => low(new FileSync("./deployed-contracts.json"));

export let BRE: BuidlerRuntimeEnvironment = {} as BuidlerRuntimeEnvironment;
export const setBRE = (_BRE: BuidlerRuntimeEnvironment) => {
  BRE = _BRE;
};

export const sleep = (milliseconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};
