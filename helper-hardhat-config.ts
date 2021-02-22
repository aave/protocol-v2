// @ts-ignore
import { eEthereumNetwork, iParamsPerNetwork } from './helpers/types';

require('dotenv').config();

const INFURA_KEY = process.env.INFURA_KEY || '';
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || '';

const GWEI = 1000 * 1000 * 1000;

export const NETWORKS_RPC_URL: iParamsPerNetwork<string> = {
  [eEthereumNetwork.kovan]: ALCHEMY_KEY
    ? `https://eth-kovan.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://kovan.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.ropsten]: ALCHEMY_KEY
    ? `https://eth-ropsten.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://ropsten.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.main]: ALCHEMY_KEY
    ? `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://mainnet.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.coverage]: 'http://localhost:8555',
  [eEthereumNetwork.hardhat]: 'http://localhost:8545',
  [eEthereumNetwork.buidlerevm]: 'http://localhost:8545',
  [eEthereumNetwork.tenderlyMain]: ALCHEMY_KEY
    ? `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://mainnet.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.mumbai]: 'https://rpc-mumbai.maticvigil.com',
  [eEthereumNetwork.matic]: 'https://rpc-mainnet.matic.network',
}

export const NETWORKS_DEFAULT_GAS: iParamsPerNetwork<number> = {
  [eEthereumNetwork.kovan]: 65 * GWEI ,
  [eEthereumNetwork.ropsten]: 65 * GWEI ,
  [eEthereumNetwork.main]: 65 * GWEI ,
  [eEthereumNetwork.coverage]: 65 * GWEI ,
  [eEthereumNetwork.hardhat]: 65 * GWEI ,
  [eEthereumNetwork.buidlerevm]: 65 * GWEI ,
  [eEthereumNetwork.tenderlyMain]: 65 * GWEI ,
  [eEthereumNetwork.mumbai]: 1 * GWEI ,
  [eEthereumNetwork.matic]: 65 * GWEI ,
}