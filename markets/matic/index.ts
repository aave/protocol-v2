import { oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { IMaticConfiguration, EthereumNetwork, eEthereumNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyDAI,
  strategyUSDC,
  strategyUSDT,
  strategyWBTC,
  strategyWETH,
  strategyMATIC,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const AaveConfig: IMaticConfiguration = {
  ...CommonsConfig,
  MarketId: 'Matic Market',
  ProviderId: 3,    // Unknown?
  ReservesConfig: {
    DAI: strategyDAI,
    USDC: strategyUSDC,
    USDT: strategyUSDT,
    WBTC: strategyWBTC,
    WETH: strategyWETH,
    MATIC: strategyMATIC,
  },
  ReserveAssets: {
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.matic]: {
      DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
      WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      MATIC: '0x0000000000000000000000000000000000001010',
    },
    [eEthereumNetwork.mumbai]: { // Mock tokens with a simple "mint" external function
      DAI: '0x13b3fda609C1eeb23b4F4b69257840760dCa6C4a',
      USDC: '0x52b63223994433FdE2F1350Ba69Dfd2779f06ABA',
      USDT: '0xB3abd1912F586fDFFa13606882c28E27913853d2',
      WBTC: '0x393E3512d45a956A628124665672312ea86930Ba',
      WETH: '0x53CDb16B8C031B779e996406546614E5F05BC4Bf',
      MATIC: '0x0000000000000000000000000000000000001010 ',
    },
    [EthereumNetwork.kovan]: {},
    [EthereumNetwork.ropsten]: {},
    [EthereumNetwork.main]: {
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      MATIC: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    },
    [EthereumNetwork.tenderlyMain]: {
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      MATIC: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    },
  },
};

export default AaveConfig;
