import { IPolygonZkEvmConfiguration, ePolygonZkEvmNetwork } from './../../helpers/types';

import { CommonsConfig } from './commons';
import { strategyWETH, strategyDAI } from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const PolygonZkEvmConfig: IPolygonZkEvmConfiguration = {
  ...CommonsConfig,
  MarketId: 'Polygon ZkEVM market',
  ProviderId: 4,
  ReservesConfig: {
    WETH: strategyWETH,
    DAI: strategyDAI,
    MAI: strategyDAI,
  },
  ReserveAssets: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: {
      WETH: '0x89929bc485ce72d2af7b7283b40b921e9f4f80b3',
      DAI: '0x89929bc485ce72d2af7b7283b40b921e9f4f80b3',
      MAI: '0x3035E40A8deDb9BD09500420E0d71d57083E644E',
    },
  },
};

export default PolygonZkEvmConfig;
