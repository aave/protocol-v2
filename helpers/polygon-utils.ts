import axios from 'axios';
import { Contract } from 'ethers/lib/ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { source } from 'lowdb/adapters/FileSync';
import { file } from 'tmp-promise';
import { DRE } from './misc-utils';
import { ePolygonNetwork } from './types';

const TASK_FLATTEN_GET_FLATTENED_SOURCE = 'flatten:get-flattened-sources';
const TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS = 'compile:solidity:get-source-paths';

/* Polygon Helpers */

export const usingPolygon = () =>
  DRE && Object.keys(ePolygonNetwork).includes((DRE as HardhatRuntimeEnvironment).network.name);

/* Polygon Verifier */

const SOLIDITY_PRAGMA = 'pragma solidity';
const LICENSE_IDENTIFIER = 'License-Identifier';
const EXPERIMENTAL_ABIENCODER = 'pragma experimental ABIEncoderV2;';

// Remove lines at "text" that includes "matcher" string, but keeping first "keep" lines
const removeLines = (text: string, matcher: string, keep = 0): string => {
  let counter = keep;
  return text
    .split('\n')
    .filter((line) => {
      const match = !line.includes(matcher);
      if (match === false && counter > 0) {
        counter--;
        return true;
      }
      return match;
    })
    .join('\n');
};

// Try to find the path of a Contract by name of the file without ".sol"
const findPath = async (id: string): Promise<string> => {
  const paths = await DRE.run(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS);
  const path = paths.find((x) => {
    const t = x.split('/');
    return t[t.length - 1].split('.')[0] == id;
  });

  if (!path) {
    throw Error('Missing path for contract name: ${id}');
  }

  return path;
};

// Hardhat Flattener, similar to truffle flattener
const hardhatFlattener = async (filePath: string) =>
  await DRE.run(TASK_FLATTEN_GET_FLATTENED_SOURCE, { files: [filePath] });

// Verify a smart contract at Polygon Matic network via a GET request to the block explorer
export const verifyAtPolygon = async (
  id: string,
  instance: Contract,
  args: (string | string[])[]
) => {
  /*
    ${net == mumbai or mainnet}
    https://explorer-${net}.maticvigil.com/api
    ?module=contract
    &action=verify
    &addressHash={addressHash}
    &name={name}
    &compilerVersion={compilerVersion}
    &optimization={false}
    &contractSourceCode={contractSourceCode}
  */
  try {
    const net = (DRE as HardhatRuntimeEnvironment).network.name;
    const filePath = await findPath(id);
    const flattenSourceCode = await hardhatFlattener(filePath);

    // Remove pragmas and license identifier after first match, required by block explorers like explorer-mainnet.maticgivil.com or Etherscan
    const cleanedSourceCode = removeLines(
      removeLines(removeLines(flattenSourceCode, LICENSE_IDENTIFIER, 1), SOLIDITY_PRAGMA, 1),
      EXPERIMENTAL_ABIENCODER,
      1
    );
    const response = await axios.get(`https://explorer-${net}.maticvigil.com/api`, {
      params: {
        module: 'contract',
        action: 'verify',
        addressHash: instance.address,
        name: id,
        compilerVersion: 'v0.6.12+commit.27d51765',
        optimization: 'true',
        contractSourceCode: cleanedSourceCode,
      },
    });
    console.log(response);
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('[Polygon Verify] Error:', error.toString());
    throw error;
  }
};
