import {
  AavePools,
  iMultiPoolsAssets,
  IReserveParams,
  tEthereumAddress,
  iBasicDistributionParams,
} from './types';
import {getParamPerPool} from './contracts-helpers';
import {AaveConfig} from '../config/aave';
import {UniswapConfig} from '../config/uniswap';
import {ZERO_ADDRESS} from './constants';

export const TEST_SNAPSHOT_ID = '0x1';

// ----------------
// COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
// ----------------

export const ALL_AAVE_RESERVES_SYMBOLS = [
  [
    'ETH',
    'DAI',
    'LEND',
    'TUSD',
    'BAT',
    'USDC',
    'USDT',
    'SUSD',
    'ZRX',
    'MKR',
    'WBTC',
    'LINK',
    'KNC',
    'MANA',
    'REP',
    'SNX',
    'BUSD',
    'UNI_DAI_ETH',
    'UNI_USDC_ETH',
    'UNI_SETH_ETH',
    'UNI_LINK_ETH',
    'UNI_MKR_ETH',
    'UNI_LEND_ETH',
  ],
];

// ----------------
// PROTOCOL PARAMS PER POOL
// ----------------

export const getReservesConfigByPool = (pool: AavePools): iMultiPoolsAssets<IReserveParams> =>
  getParamPerPool<iMultiPoolsAssets<IReserveParams>>(
    {
      [AavePools.proto]: {
        ...AaveConfig.ReservesConfig,
      },
      [AavePools.secondary]: {
        ...UniswapConfig.ReservesConfig,
      },
    },
    pool
  );

export const getFeeDistributionParamsCommon = (
  receiver: tEthereumAddress
): iBasicDistributionParams => {
  const receivers = [receiver, ZERO_ADDRESS];
  const percentages = ['2000', '8000'];
  return {
    receivers,
    percentages,
  };
};
