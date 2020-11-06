import {exit} from 'process';
import fs from 'fs';
import globby from 'globby';
import {file} from 'tmp-promise';
import {DRE} from './misc-utils';

const listSolidityFiles = (dir: string) => globby(`${dir}/**/*.sol`);

const fatalErrors = [
  `The address provided as argument contains a contract, but its bytecode`,
  `Daily limit of 100 source code submissions reached`,
];

export const SUPPORTED_ETHERSCAN_NETWORKS = ['main', 'ropsten', 'kovan'];

export const getEtherscanPath = async (contractName: string) => {
  const paths = await listSolidityFiles(DRE.config.paths.sources);
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
  const currentNetwork = DRE.network.name;

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
    const times = 15;
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
      await DRE.run(task, params);
      cleanup();
    } else {
      cleanup();
      console.error(
        '[ETHERSCAN][ERROR] Errors after all the retries, check the logs for more information.'
      );
    }
  } catch (error) {
    counter--;
    console.info(`[ETHERSCAN][[INFO] Retrying attemps: ${counter}.`);
    console.error('[ETHERSCAN][[ERROR]', error.message);

    if (fatalErrors.some((fatalError) => error.message.includes(fatalError))) {
      console.error(
        '[ETHERSCAN][[ERROR] Fatal error detected, skip retries and resume deployment.'
      );
      return;
    }

    await runTaskWithRetry(task, params, counter, msDelay, cleanup);
  }
};

export const checkVerification = () => {
  const currentNetwork = DRE.network.name;
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
