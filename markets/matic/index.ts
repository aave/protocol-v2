import { IMaticConfiguration, ePolygonNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyDAI,
  strategyUSDC,
  strategyUSDT,
  strategyWBTC,
  strategyWETH,
  strategyMATIC,
  strategyAAVE,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const MaticConfig: IMaticConfiguration = {
  ...CommonsConfig,
  MarketId: 'Matic Market',
  ProviderId: 3,
  ReservesConfig: {
    DAI: strategyDAI,
    USDC: strategyUSDC,
    USDT: strategyUSDT,
    WBTC: strategyWBTC,
    WETH: strategyWETH,
    WMATIC: strategyMATIC,
    AAVE: strategyAAVE,
  },
  ReserveAssets: {
    [ePolygonNetwork.matic]: {
      DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
      WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      AAVE: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
    },
    [ePolygonNetwork.mumbai]: {
      // Mock tokens with a simple "mint" external function, except wmatic
      DAI: '0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F',
      USDC: '0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e',
      USDT: '0xBD21A10F619BE90d6066c941b04e340841F1F989',
      WBTC: '0x0d787a4a1548f673ed375445535a6c7A1EE56180',
      WETH: '0x3C68CE8504087f89c640D02d133646d98e64ddd9',
      WMATIC: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889',
    },
  },
};

export default MaticConfig;
