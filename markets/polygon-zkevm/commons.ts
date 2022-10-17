import BigNumber from 'bignumber.js';
import {
  oneEther,
  oneRay,
  RAY,
  ZERO_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  oneUsd,
  MOCK_CHAINLINK_AGGREGATORS_USD_PRICES,
} from '../../helpers/constants';
import { ICommonConfiguration, eAvalancheNetwork, ePolygonZkEvmNetwork } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ATokenNamePrefix: 'Aave Polygon zkEVM Market',
  StableDebtTokenNamePrefix: 'Aave Polygon zkEVM Market stable debt',
  VariableDebtTokenNamePrefix: 'Aave Polygon zkEVM Market variable debt',
  SymbolPrefix: 'polZkEvm',
  ProviderId: 0, // Overriden in index.ts
  OracleQuoteCurrency: 'USD',
  OracleQuoteUnit: oneUsd.toString(),
  ProtocolGlobalParams: {
    TokenDistributorPercentageBase: '10000',
    MockUsdPriceInWei: '5848466240000000',
    UsdAddress: '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96',
    NilAddress: '0x0000000000000000000000000000000000000000',
    OneAddress: '0x0000000000000000000000000000000000000001',
    AaveReferral: '0',
  },

  // ----------------
  // COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
  // ----------------

  Mocks: {
    AllAssetsInitialPrices: {
      ...MOCK_CHAINLINK_AGGREGATORS_USD_PRICES,
    },
  },
  // TODO: reorg alphabetically, checking the reason of tests failing
  LendingRateOracleRatesCommon: {
    WETH: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    DAI: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    MAI: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdminIndex: 0,
  EmergencyAdmin: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: undefined,
  },
  ProviderRegistry: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: undefined,
  },
  ProviderRegistryOwner: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: undefined,
  },
  LendingRateOracle: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '',
  },
  LendingPoolCollateralManager: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '',
  },
  LendingPoolConfigurator: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '',
  },
  LendingPool: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '',
  },
  WethGateway: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '',
  },
  TokenDistributor: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '',
  },
  AaveOracle: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '',
  },
  FallbackOracle: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '',
  },
  ChainlinkAggregator: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: {},
  },
  ReserveAssets: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: {},
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '',
  },
  WETH: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '0x89929bc485ce72d2af7b7283b40b921e9f4f80b3',
  },
  WrappedNativeToken: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '',
  },
  ReserveFactorTreasuryAddress: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '0x77c45699A715A64A7a7796d5CEe884cf617D5254',
  },
  IncentivesController: {
    [ePolygonZkEvmNetwork.polZkEvmTestnet]: '',
  },
};
