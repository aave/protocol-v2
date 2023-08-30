import { oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { IOpBNBConfiguration, eEthereumNetwork, eOpBNB } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyWBNB,
  strategyZOZO,
  strategyBKS,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const OpBNBConfig: IOpBNBConfiguration = {
  ...CommonsConfig,
  MarketId: 'Aave genesis market',
  ProviderId: 4,
  ReservesConfig: {
    WBNB: strategyWBNB,
    ZO_ZO: strategyZOZO,
    BKS: strategyBKS,
  },
  ReserveAssets: {
    [eOpBNB.op_bnb] : {},
    /*[eEthereumNetwork.main]: {
      AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      BAT: '0x0d8775f648430679a709e98d2b0cb6250d2887ef',
      BUSD: '0x4Fabb145d64652a948d72533023f6E7A623C7C53',
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      ENJ: '0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c',
      KNC: '0xdd974D5C2e2928deA5F71b9825b8b646686BD200',
      LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      MANA: '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942',
      MKR: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
      REN: '0x408e41876cCCDC0F92210600ef50372656052a38',
      SNX: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F',
      SUSD: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
      TUSD: '0x0000000000085d4780B73119b644AE5ecd22b376',
      UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      YFI: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e',
      ZRX: '0xE41d2489571d322189246DaFA5ebDe1F4699F498',
      xSUSHI: '0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272',
    },*/

  },
};

export default OpBNBConfig;
