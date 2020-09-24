import {
  AavePools,
  iMultiPoolsAssets,
  IReserveParams,
  PoolConfiguration,
  iBasicDistributionParams,
  ICommonConfiguration,
  eEthereumNetwork,
} from './types';
import {getParamPerPool} from './contracts-helpers';
import {AaveConfig} from '../config/aave';
import {UniswapConfig} from '../config/uniswap';
import {CommonsConfig} from '../config/commons';
import {ZERO_ADDRESS} from './constants';
import {BRE} from './misc-utils';
import {tEthereumAddress} from './types';
import {getParamPerNetwork} from './contracts-helpers';

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
    case ConfigNames.Commons:
      return CommonsConfig;
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

export const getGenesisAaveAdmin = async (config: ICommonConfiguration) => {
  const currentNetwork = BRE.network.name;
  const targetAddress = getParamPerNetwork(config.AaveAdmin, <eEthereumNetwork>currentNetwork);
  if (targetAddress) {
    return targetAddress;
  }
  const addressList = await Promise.all(
    (await BRE.ethers.getSigners()).map((signer) => signer.getAddress())
  );
  const addressIndex = config.AaveAdminIndex;
  return addressList[addressIndex];
};

export const getATokenDomainSeparatorPerNetwork = (
  network: eEthereumNetwork,
  config: ICommonConfiguration
): tEthereumAddress => getParamPerNetwork<tEthereumAddress>(config.ATokenDomainSeparator, network);
