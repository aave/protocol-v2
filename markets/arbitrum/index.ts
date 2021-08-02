import { oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { eArbitrumNetwork, eEthereumNetwork, IArbitrumConfiguration } from '../../helpers/types';

import { CommonsConfig } from './commons';
import { strategyUSDT, strategyLINK, strategyWBTC, strategyWETH } from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const ArbitrumConfig: IArbitrumConfiguration = {
  ...CommonsConfig,
  MarketId: 'Aave arbitrum market',
  ProviderId: 1,
  ReservesConfig: {
    LINK: strategyLINK,
    USDT: strategyUSDT,
    WBTC: strategyWBTC,
    WETH: strategyWETH,
  },
  ReserveAssets: {
    [eArbitrumNetwork.rinkeby]: {
      WETH: '0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681',
      WBTC: '0x80205a8848fb7B8f7CCc4fb029662C34f190bF58',
      USDT: '0xfa641839FCC50db7420afE9f385CA1dfdF4ac744',
      LINK: '0xC3188739EdC9b53a61Cf0c24A31B9A76aCAFf5Ca',
    },
  },
};

export default ArbitrumConfig;
