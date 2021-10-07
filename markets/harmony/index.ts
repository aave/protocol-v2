import { eHarmonyNetwork, IHarmonyConfiguration } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyWETH,
  strategyDAI,
  strategyUSDC,
  strategyUSDT,
  strategyWBTC,
  strategyWONE,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const HarmonyConfig: IHarmonyConfiguration = {
  ...CommonsConfig,
  MarketId: 'Harmony market',
  ProviderId: 5,
  ReservesConfig: {
    '1ETH': strategyWETH,
    '1DAI': strategyDAI,
    '1USDT': strategyUSDT,
    '1USDC': strategyUSDC,
    '1WBTC': strategyWBTC,
    WONE: strategyWONE,
  },
  ReserveAssets: {
    [eHarmonyNetwork.harmony]: {
      '1ETH': '0x6983d1e6def3690c4d616b13597a09e6193ea013',
      '1WBTC': '0x3095c7557bcb296ccc6e363de01b760ba031f2d9',
      '1DAI': '0xef977d2f931c1978db5f6747666fa1eacb0d0339',
      '1USDC': '0x985458e523db3d53125813ed68c274899e9dfab4',
      '1USDT': '0x3c2b8be99c50593081eaa2a724f0b8285f5aba8f',
      WONE: '0xcf664087a5bb0237a0bad6742852ec6c8d69a27a',
    },
    [eHarmonyNetwork.testnet]: {
      '1ETH': '',
      '1WBTC': '',
      '1DAI': '',
      '1USDC': '',
      '1USDT': '',
      WONE: '',
    },
  },
};

export default HarmonyConfig;
