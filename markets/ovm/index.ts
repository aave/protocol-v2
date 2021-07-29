import { eOptimismNetwork, IOptimismConfiguration } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyWETH,
  strategyDAI,
  strategyUSDC,
  strategyUSDT,
  strategyAAVE,
  strategyWBTC,
  strategyLINK,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const OptimismConfig: IOptimismConfiguration = {
  ...CommonsConfig,
  MarketId: 'Avalanche market',
  ProviderId: 5, // TODO: What is this? 
  ReservesConfig: {
    WETH: strategyWETH,
    DAI: strategyDAI,
    USDC: strategyUSDC,
    USDT: strategyUSDT,
    AAVE: strategyAAVE,
    WBTC: strategyWBTC,
    LINK: strategyLINK,
  },
  ReserveAssets: {
    [eOptimismNetwork.optimism]: { // TODO: Check this
      WETH: '0x4200000000000000000000000000000000000006',
      // DAI: '',
      // USDC: '', // TODO:
      // USDT: '',
      // AAVE: '', // TODO: 
      // WBTC: '',
      // LINK: ''
    },
    [eOptimismNetwork.optimismKovan]: { // TODO: Deploy Mock tokens
      WETH: '0x4200000000000000000000000000000000000006',
      DAI: '0x47ee20342BC51ED759F0971cc96C31177ebc81Ae',
      USDC: '0x4de9ee3d1F33676e505CA3747993929c29802293',
      // USDT: '0x871091955225468eA25862A9C40147c698c20164',
      // AAVE: '0xe84b739b6B5d057301cB49c30C7783158Ba2Ded0',
      WBTC: '0x0706661fe3FB1f9b3D10DdFb3A30fBB709BC7D59',
      // LINK: '0x5a5Fcf7Aa05Beb73A78D5d19b9f7eB8009454B73'
    },
  },
};

export default OptimismConfig;
