import {exit} from 'process';
import fs from 'fs';
import {file} from 'tmp-promise';
import {BRE} from './misc-utils';

export const SUPPORTED_ETHERSCAN_NETWORKS = ['main', 'ropsten', 'kovan'];

export const getEtherscanPath = async (contractName: string) => {
  const compilerInput = await BRE.run('compile:get-compiler-input');
  const paths = Object.keys(compilerInput.sources);
  const path = paths.find((p) => p.includes(contractName));
  if (!path) {
    throw new Error(
      `Contract path not found for ${contractName}. Check if smart contract file is equal to contractName input.`
    );
  }

  return `${path}:${contractName}`;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const verifyContract = async (
  contractName: string,
  address: string,
  constructorArguments: (string | string[])[],
  libraries?: string
) => {
  const currentNetwork = BRE.network.name;

  if (!process.env.ETHERSCAN_KEY) {
    throw Error('Missing process.env.ETHERSCAN_KEY.');
  }
  if (!SUPPORTED_ETHERSCAN_NETWORKS.includes(currentNetwork)) {
    throw Error(
      `Current network ${currentNetwork} not supported. Please change to one of the next networks: ${SUPPORTED_ETHERSCAN_NETWORKS.toString()}`
    );
  }
  const etherscanPath = await getEtherscanPath(contractName);

  try {
    console.log(
      '[ETHERSCAN][WARNING] Delaying Etherscan verification due their API can not find newly deployed contracts'
    );
    const msDelay = 3000;
    const times = 60;
    // Write a temporal file to host complex parameters for buidler-etherscan https://github.com/nomiclabs/buidler/tree/development/packages/buidler-etherscan#complex-arguments
    const {fd, path, cleanup} = await file({
      prefix: 'verify-params-',
      postfix: '.js',
    });
    fs.writeSync(fd, `module.exports = ${JSON.stringify([...constructorArguments])};`);

    const params = {
      contractName: etherscanPath,
      address: address,
      libraries,
      constructorArgs: path,
    };
    await runTaskWithRetry('verify', params, times, msDelay, cleanup);
  } catch (error) {}
};

export const runTaskWithRetry = async (
  task: string,
  params: any,
  times: number,
  msDelay: number,
  cleanup: () => void
) => {
  let counter = times;
  await delay(msDelay);

  try {
    if (times) {
      await BRE.run(task, params);
      cleanup();
    } else {
      cleanup();
      console.error('[ERROR] Errors after all the retries, check the logs for more information.');
    }
  } catch (error) {
    counter--;
    console.info(`[INFO] Retrying attemps: ${counter}.`);
    console.error('[ERROR]', error.message);
    await runTaskWithRetry(task, params, counter, msDelay, cleanup);
  }
};

export const checkVerification = () => {
  const currentNetwork = BRE.network.name;
  if (!process.env.ETHERSCAN_KEY) {
    console.error('Missing process.env.ETHERSCAN_KEY.');
    exit(3);
  }
  if (!SUPPORTED_ETHERSCAN_NETWORKS.includes(currentNetwork)) {
    console.error(
      `Current network ${currentNetwork} not supported. Please change to one of the next networks: ${SUPPORTED_ETHERSCAN_NETWORKS.toString()}`
    );
    exit(5);
  }
};
