import path from 'path';
import fs from 'fs';

import {usePlugin, BuidlerConfig} from '@nomiclabs/buidler/config';
// @ts-ignore
import {accounts} from './test-wallets.js';
import {eEthereumNetwork} from './helpers/types';

usePlugin('@nomiclabs/buidler-ethers');
usePlugin('buidler-typechain');
usePlugin('solidity-coverage');
usePlugin('@nomiclabs/buidler-waffle');
usePlugin('@nomiclabs/buidler-etherscan');
//usePlugin('buidler-gas-reporter');

const DEFAULT_BLOCK_GAS_LIMIT = 10000000;
const DEFAULT_GAS_PRICE = 10;
const HARDFORK = 'istanbul';
const INFURA_KEY = '';
const ETHERSCAN_KEY = '';
const MNEMONIC_PATH = "m/44'/60'/0'/0";
const MNEMONICS: {[network: string]: string} = {
  [eEthereumNetwork.kovan]: '',
  [eEthereumNetwork.ropsten]: '',
  [eEthereumNetwork.main]: '',
};

['misc', 'migrations', 'dev-deployment'].forEach((folder) => {
  const tasksPath = path.join(__dirname, 'tasks', folder);
  fs.readdirSync(tasksPath)
    .filter((pth) => pth.includes('.ts'))
    .forEach((task) => require(`${tasksPath}/${task}`));
});

const getCommonNetworkConfig = (networkName: eEthereumNetwork, networkId: number) => {
  return {
    url: `https://${networkName}.infura.io/v3/${INFURA_KEY}`,
    hardfork: HARDFORK,
    blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
    gasMultiplier: DEFAULT_GAS_PRICE,
    chainId: networkId,
    accounts: {
      mnemonic: MNEMONICS[networkName],
      path: MNEMONIC_PATH,
      initialIndex: 0,
      count: 20,
    },
  };
};

const config: any = {
  solc: {
    version: '0.6.8',
    optimizer: {enabled: true, runs: 200},
    evmVersion: 'istanbul',
  },
  typechain: {
    outDir: 'types',
    target: 'ethers-v4',
  },
  etherscan: {
    url: 'https://api-kovan.etherscan.io/api',
    apiKey: ETHERSCAN_KEY,
  },
  defaultNetwork: 'buidlerevm',
  mocha: {
    timeout: 0,
  },
  networks: {
    kovan: getCommonNetworkConfig(eEthereumNetwork.kovan, 42),
    ropsten: getCommonNetworkConfig(eEthereumNetwork.ropsten, 3),
    main: getCommonNetworkConfig(eEthereumNetwork.main, 1),
    buidlerevm: {
      hardfork: 'istanbul',
      blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
      gas: DEFAULT_BLOCK_GAS_LIMIT,
      gasPrice: 8000000000,
      chainId: 31337,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      accounts: accounts.map(({secretKey, balance}: {secretKey: string; balance: string}) => ({
        privateKey: secretKey,
        balance,
      })),
    },
    ganache: {
      url: 'http://ganache:8545',
      accounts: {
        mnemonic: 'fox sight canyon orphan hotel grow hedgehog build bless august weather swarm',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
  },
};

export default config;
