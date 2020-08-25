import {
  AavePools,
  iMultiPoolsAssets,
  IReserveParams,
  PoolConfiguration,
  tEthereumAddress,
  iBasicDistributionParams,
} from './types';
import {getParamPerPool} from './contracts-helpers';
import {AaveConfig} from '../config/aave';
import {UniswapConfig} from '../config/uniswap';
import {ZERO_ADDRESS} from './constants';

export enum ConfigNames {
  Commons = 'Commons',
  Aave = 'Aave',
  Uniswap = 'Uniswap',
}

export const loadPoolConfig = (configName: ConfigNames): PoolConfiguration => {
  switch (configName) {
    case ConfigNames.Aave:
      return AaveConfig;
    case ConfigNames.Uniswap:
      return UniswapConfig;
    default:
      throw new Error(`Unsupported pool configuration: ${Object.values(ConfigNames)}`);
  }
};

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
