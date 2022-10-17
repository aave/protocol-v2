import { PolygonZkEvmConfig } from './../markets/polygon-zkevm/index';
import { getMintableERC20, getMockedTokens } from './contracts-getters';
import {
  AavePools,
  iMultiPoolsAssets,
  IReserveParams,
  PoolConfiguration,
  eNetwork,
  IBaseConfiguration,
} from './types';
import { getEthersSignersAddresses, getParamPerPool } from './contracts-helpers';
import AaveConfig from '../markets/aave';
import MaticConfig from '../markets/matic';
import AvalancheConfig from '../markets/avalanche';
import AmmConfig from '../markets/amm';

import { CommonsConfig } from '../markets/aave/commons';
import { DRE, filterMapBy } from './misc-utils';
import { tEthereumAddress, IAaveConfiguration } from './types';
import { getParamPerNetwork } from './contracts-helpers';
import { deployWETHMocked } from './contracts-deployments';

export enum ConfigNames {
  Commons = 'Commons',
  Aave = 'Aave',
  Matic = 'Matic',
  Amm = 'Amm',
  Avalanche = 'Avalanche',
  PolygonZkEvm = 'PolygonZkEvm',
}

export const loadPoolConfig = (configName: ConfigNames): PoolConfiguration => {
  switch (configName) {
    case ConfigNames.Aave:
      return AaveConfig;
    case ConfigNames.Matic:
      return MaticConfig;
    case ConfigNames.Amm:
      return AmmConfig;
    case ConfigNames.Avalanche:
      return AvalancheConfig;
    case ConfigNames.Commons:
      return CommonsConfig;
    case ConfigNames.PolygonZkEvm:
      return PolygonZkEvmConfig;
    default:
      throw new Error(
        `Unsupported pool configuration: ${configName} is not one of the supported configs ${Object.values(
          ConfigNames
        )}`
      );
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
      [AavePools.amm]: {
        ...AmmConfig.ReservesConfig,
      },
      [AavePools.matic]: {
        ...MaticConfig.ReservesConfig,
      },
      [AavePools.avalanche]: {
        ...AvalancheConfig.ReservesConfig,
      },
      [AavePools.polygonZkEvm]: {
        ...PolygonZkEvmConfig.ReservesConfig,
      },
    },
    pool
  );

export const getGenesisPoolAdmin = async (
  config: IBaseConfiguration
): Promise<tEthereumAddress> => {
  const currentNetwork = process.env.FORK ? process.env.FORK : DRE.network.name;
  const targetAddress = getParamPerNetwork(config.PoolAdmin, <eNetwork>currentNetwork);
  if (targetAddress) {
    return targetAddress;
  }
  const addressList = await getEthersSignersAddresses();
  const addressIndex = config.PoolAdminIndex;
  return addressList[addressIndex];
};

export const getEmergencyAdmin = async (config: IBaseConfiguration): Promise<tEthereumAddress> => {
  const currentNetwork = process.env.FORK ? process.env.FORK : DRE.network.name;
  const targetAddress = getParamPerNetwork(config.EmergencyAdmin, <eNetwork>currentNetwork);
  if (targetAddress) {
    return targetAddress;
  }
  const addressList = await getEthersSignersAddresses();
  const addressIndex = config.EmergencyAdminIndex;
  return addressList[addressIndex];
};

export const getTreasuryAddress = async (config: IBaseConfiguration): Promise<tEthereumAddress> => {
  const currentNetwork = process.env.FORK ? process.env.FORK : DRE.network.name;
  return getParamPerNetwork(config.ReserveFactorTreasuryAddress, <eNetwork>currentNetwork);
};

export const getATokenDomainSeparatorPerNetwork = (
  network: eNetwork,
  config: IBaseConfiguration
): tEthereumAddress => getParamPerNetwork<tEthereumAddress>(config.ATokenDomainSeparator, network);

export const getWethAddress = async (config: PoolConfiguration) => {
  const currentNetwork = process.env.FORK ? process.env.FORK : DRE.network.name;
  const wethAddress = getParamPerNetwork(config.WETH, <eNetwork>currentNetwork);
  if (wethAddress) {
    return wethAddress;
  }
  if (currentNetwork.includes('main')) {
    throw new Error('WETH not set at mainnet configuration.');
  }
  const mockTokens = await getMockedTokens(config);
  if (mockTokens['WETH']) {
    return mockTokens['WETH'].address;
  }
  const weth = await deployWETHMocked();
  return weth.address;
};

export const getWrappedNativeTokenAddress = async (config: PoolConfiguration) => {
  const currentNetwork = process.env.MAINNET_FORK === 'true' ? 'main' : DRE.network.name;
  const wethAddress = getParamPerNetwork(config.WrappedNativeToken, <eNetwork>currentNetwork);
  if (wethAddress) {
    return wethAddress;
  }
  if (currentNetwork.includes('main')) {
    throw new Error('WETH not set at mainnet configuration.');
  }
  const mockTokens = await getMockedTokens(config);
  if (mockTokens['WETH']) {
    return mockTokens['WETH'].address;
  }
  const weth = await deployWETHMocked();
  return weth.address;
};

export const getLendingRateOracles = (poolConfig: IBaseConfiguration) => {
  const {
    ProtocolGlobalParams: { UsdAddress },
    LendingRateOracleRatesCommon,
    ReserveAssets,
  } = poolConfig;

  const network = process.env.FORK ? process.env.FORK : DRE.network.name;
  return filterMapBy(LendingRateOracleRatesCommon, (key) =>
    Object.keys(ReserveAssets[network]).includes(key)
  );
};

export const getQuoteCurrency = async (config: PoolConfiguration) => {
  switch (config.OracleQuoteCurrency) {
    case 'ETH':
    case 'WETH':
      return getWethAddress(config);
    case 'USD':
      return config.ProtocolGlobalParams.UsdAddress;
    default:
      throw `Quote ${config.OracleQuoteCurrency} currency not set. Add a new case to getQuoteCurrency switch`;
  }
};
