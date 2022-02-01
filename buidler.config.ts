import { task, usePlugin } from '@nomiclabs/buidler/config';
import { BUIDLEREVM_CHAINID, COVERAGE_CHAINID } from './helpers/buidler-constants';
import { setDRE } from './helpers/misc-utils';
import { eEthereumNetwork } from './helpers/types';
// @ts-ignore
import { accounts } from './test-wallets.js';

require('dotenv').config();

usePlugin('@nomiclabs/buidler-ethers');
usePlugin('buidler-typechain');
usePlugin('solidity-coverage');
usePlugin('@nomiclabs/buidler-waffle');
usePlugin('@nomiclabs/buidler-etherscan');

const SKIP_LOAD = process.env.SKIP_LOAD === 'true';
const DEFAULT_BLOCK_GAS_LIMIT = 12450000;
const DEFAULT_GAS_PRICE = 10;
const HARDFORK = 'istanbul';
const INFURA_KEY = process.env.INFURA_KEY || '';
const BWARE_LABS_KEY = process.env.BWARE_LABS_KEY || '';
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY || '';
const SUBSCAN_KEY = process.env.SUBSCAN_KEY || '';

const MNEMONIC_PATH = "m/44'/60'/0'/0";
const MNEMONIC = process.env.MNEMONIC || '';

task(`set-DRE`, `Inits the DRE, to have access to all the plugins' objects`).setAction(
  async (_, _DRE) => {
    setDRE(_DRE);
    return _DRE;
  }
);

const getCommonNetworkConfig = (networkName: eEthereumNetwork, networkId: number) => {
  return {
    url: `https://rpc.${networkName}.astar.network:8545`,
    hardfork: HARDFORK,
    blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
    gasMultiplier: DEFAULT_GAS_PRICE,
    chainId: networkId,
    accounts: {
      mnemonic: MNEMONIC,
      path: MNEMONIC_PATH,
      initialIndex: 0,
      count: 20,
    },
  };
};

const buidlerConfig: any = {
  solc: {
    version: '0.6.12',
    optimizer: {enabled: true, runs: 200},
    evmVersion: 'istanbul',
  },
  typechain: {
    outDir: 'types',
    target: 'ethers-v4',
  },
  etherscan: {
    apiKey: SUBSCAN_KEY,
  },
  defaultNetwork: 'buidlerevm',
  mocha: {
    timeout: 0,
  },
  networks: {
    coverage: {
      url: 'http://localhost:8555',
      chainId: COVERAGE_CHAINID,
    },
    kovan: getCommonNetworkConfig(eEthereumNetwork.kovan, 42),
    ropsten: getCommonNetworkConfig(eEthereumNetwork.ropsten, 3),
    main: getCommonNetworkConfig(eEthereumNetwork.main, 1),
    buidlerevm: {
      hardfork: 'istanbul',
      blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
      gas: DEFAULT_BLOCK_GAS_LIMIT,
      gasPrice: 8000000000,
      chainId: BUIDLEREVM_CHAINID,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      accounts: accounts.map(({secretKey, balance}: {secretKey: string; balance: string}) => ({
        privateKey: secretKey,
        balance,
      })),
    },
    buidlerevm_docker: {
      hardfork: 'istanbul',
      blockGasLimit: 9500000,
      gas: 9500000,
      gasPrice: 8000000000,
      chainId: BUIDLEREVM_CHAINID,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      url: 'http://localhost:8545',
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

export default buidlerConfig;
