import { oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { IUniswapConfiguration, EthereumNetwork, eEthereumNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyDAI,
  strategyUSDC,
  strategyUSDT,
  strategyWETH,
  strategyWBTC,
  strategyWETHWBTC,
  strategyWETHDAI
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const UniswapConfig: IUniswapConfiguration = {
  ...CommonsConfig,
  MarketId: 'Uniswap V2 market',
  ProviderId: 2,
  ReservesConfig: {
    DAI: strategyDAI,
    USDC: strategyUSDC,
    USDT: strategyUSDT,
    WBTC: strategyWBTC,
    WETH: strategyWETH,
    WETHDAI: strategyWETHDAI,
    WETHWBTC: strategyWETHWBTC
  },
  ReserveAssets: {
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [EthereumNetwork.kovan]: {
      DAI: '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD',
      USDC: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
      USDT: '0x13512979ADE267AB5100878E2e0f485B568328a4',
      WBTC: '0xD1B98B6607330172f1D991521145A22BCe793277',
      WETH: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
      WETHDAI: '0x7d3A67ab574abD3F9849e5fcDa48c19939d032b4',
      WETHWBTC: '0x342e78bf229Cd2a750E80D7D7c2C185455979b91',
    },
    [EthereumNetwork.ropsten]: {
      // AAVE: '',
      // BAT: '0x85B24b3517E3aC7bf72a14516160541A60cFF19d',
      // BUSD: '0xFA6adcFf6A90c11f31Bc9bb59eC0a6efB38381C6',
      // DAI: '0xf80A32A835F79D7787E8a8ee5721D0fEaFd78108',
      // ENJ: ZERO_ADDRESS,
      // KNC: '0xCe4aA1dE3091033Ba74FA2Ad951f6adc5E5cF361',
      // LINK: '0x1a906E71FF9e28d8E01460639EB8CF0a6f0e2486',
      // MANA: '0x78b1F763857C8645E46eAdD9540882905ff32Db7',
      // MKR: '0x2eA9df3bABe04451c9C3B06a2c844587c59d9C37',
      // REN: ZERO_ADDRESS,
      // SNX: '0xF80Aa7e2Fda4DA065C55B8061767F729dA1476c7',
      // SUSD: '0xc374eB17f665914c714Ac4cdC8AF3a3474228cc5',
      // TUSD: '0xa2EA00Df6d8594DBc76b79beFe22db9043b8896F',
      // UNI: ZERO_ADDRESS,
      // USDC: '0x851dEf71f0e6A903375C1e536Bd9ff1684BAD802',
      // USDT: '0xB404c51BBC10dcBE948077F18a4B8E553D160084',
      // WBTC: '0xa0E54Ab6AA5f0bf1D62EC3526436F3c05b3348A0',
      // WETH: '0xc778417e063141139fce010982780140aa0cd5ab',
      // YFI: ZERO_ADDRESS,
      // ZRX: '0x02d7055704EfF050323A2E5ee4ba05DB2A588959',
    },
    [EthereumNetwork.main]: {
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      WETHDAI: '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11',
      WETHWBTC: '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940',
    },
    [EthereumNetwork.tenderlyMain]: {
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      WETHDAI: '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11',
      WETHWBTC: '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940',
    },
  },
};

export default UniswapConfig;
