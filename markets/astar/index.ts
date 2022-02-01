import { eAstarNetwork, IAstarConfiguration } from '../../helpers/types';
import { CommonsConfig } from './commons';
import {
  strategyUSDC,
  strategyUSDT, strategyWETH, strategyWSBY
} from './reservesConfigs';


// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const AstarConfig: IAstarConfiguration = {
  ...CommonsConfig,
  MarketId: 'Astar market',
  ProviderId: 4,
  ReservesConfig: {
    WETH: strategyWETH,
    USDT: strategyUSDT,
    USDC: strategyUSDC,
    WSBY: strategyWSBY,
  },
  ReserveAssets: {
    [eAstarNetwork.shibuya]: {
      WETH: '0x04efa209F9e74E612a529c393Cf9F1141E696F06',
      USDT: '0x9ed26572c27530c740C9B866E42A8997f69A48a8',
      USDC: '0xA4F42578c723A5B6781A9F49d586B8645ba85C31',
      WSBY: '0x321F318e7C276c93Cf3094fd3a9d7c4362fd19FB',
    },
  },
};

export default AstarConfig;
