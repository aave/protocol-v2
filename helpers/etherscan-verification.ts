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
  constructorArguments: string[],
  libraries?: string
) => {
  const currentNetwork = BRE.network.name;

  if (!process.env.ETHERSCAN_KEY) {
    throw Error('Missing process.env.ETHERSCAN_KEY.');
  }
  if (!process.env.ETHERSCAN_NETWORK) {
    throw Error('Missing process.env.ETHERSCAN_NETWORK');
  }
  if (!SUPPORTED_ETHERSCAN_NETWORKS.includes(currentNetwork)) {
    throw Error(
      `Current network ${currentNetwork} not supported. Please change to one of the next networks: ${SUPPORTED_ETHERSCAN_NETWORKS.toString()}`
    );
  }
  const etherscanPath = await getEtherscanPath(contractName);

  const params = {
    contractName: etherscanPath,
    address: address,
    constructorArguments,
    libraries,
  };

  try {
    console.log(
      '[ETHERSCAN][WARNING] Delaying Etherscan verification due their API can not find newly deployed contracts'
    );
    const msDelay = 3000;
    const times = 30;
    await runTaskWithRetry('verify-contract', params, times, msDelay);
  } catch (error) {}
};

export const runTaskWithRetry = async (
  task: string,
  params: any,
  times: number,
  msDelay: number
) => {
  let counter = times;
  await delay(msDelay);

  try {
    if (times) {
      await BRE.run(task, params);
    } else {
      console.error('[ERROR] Errors after all the retries, check the logs for more information.');
    }
  } catch (error) {
    counter--;
    console.info(`[INFO] Retrying attemps: ${counter}.`);
    console.error('[ERROR]', error.message);
    await runTaskWithRetry(task, params, counter, msDelay);
  }
};

export const checkVerification = () => {
  const currentNetwork = BRE.network.name;
  if (!process.env.ETHERSCAN_KEY) {
    throw Error('Missing process.env.ETHERSCAN_KEY.');
  }
  if (!process.env.ETHERSCAN_NETWORK) {
    throw Error('Missing process.env.ETHERSCAN_NETWORK');
  }
  if (!SUPPORTED_ETHERSCAN_NETWORKS.includes(currentNetwork)) {
    throw Error(
      `Current network ${currentNetwork} not supported. Please change to one of the next networks: ${SUPPORTED_ETHERSCAN_NETWORKS.toString()}`
    );
  }
};
