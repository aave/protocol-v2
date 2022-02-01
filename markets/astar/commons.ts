import {
  MOCK_CHAINLINK_AGGREGATORS_PRICES, oneRay, oneUsd, ZERO_ADDRESS
} from '../../helpers/constants';
import { eAstarNetwork, ICommonConfiguration } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ATokenNamePrefix: 'Aave Astar Market',
  StableDebtTokenNamePrefix: 'Aave Astar Market stable debt',
  VariableDebtTokenNamePrefix: 'Aave Astar Market variable debt',
  SymbolPrefix: 's',
  ProviderId: 0, // Overriden in index.ts
  OracleQuoteCurrency: 'USD',
  OracleQuoteUnit: oneUsd.toString(),
  ProtocolGlobalParams: {
    TokenDistributorPercentageBase: '10000',
    MockUsdPriceInWei: '5848466240000000',
    UsdAddress: '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96', // TODO: what is this?
    NilAddress: '0x0000000000000000000000000000000000000000',
    OneAddress: '0x0000000000000000000000000000000000000001',
    AaveReferral: '0',
  },

  // ----------------
  // COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
  // ----------------

  Mocks: {
    AllAssetsInitialPrices: {
      ...MOCK_CHAINLINK_AGGREGATORS_PRICES,
    },
  },
  // TODO: reorg alphabetically, checking the reason of tests failing
  LendingRateOracleRatesCommon: {
    WETH: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    USDC: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    USDT: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    WSBY: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eAstarNetwork.shibuya]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdminIndex: 0,
  EmergencyAdmin: {
    [eAstarNetwork.shibuya]: undefined,
  },
  ProviderRegistry: {
    [eAstarNetwork.shibuya]: '',
  },
  ProviderRegistryOwner: {
    [eAstarNetwork.shibuya]: '',
  },
  LendingRateOracle: {
    [eAstarNetwork.shibuya]: '',
  },
  LendingPoolCollateralManager: {
    [eAstarNetwork.shibuya]: '',
  },
  LendingPoolConfigurator: {
    [eAstarNetwork.shibuya]: '',
  },
  LendingPool: {
    [eAstarNetwork.shibuya]: '',
  },
  WethGateway: {
    [eAstarNetwork.shibuya]: '',
  },
  TokenDistributor: {
    [eAstarNetwork.shibuya]: '',
  },
  AaveOracle: {
    [eAstarNetwork.shibuya]: '',
  },
  FallbackOracle: {
    [eAstarNetwork.shibuya]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    [eAstarNetwork.shibuya]: {
      WETH: ZERO_ADDRESS,
      USDC: ZERO_ADDRESS,
      USDT: ZERO_ADDRESS,
      WSBY: ZERO_ADDRESS,
    },
  },
  ReserveAssets: {
    [eAstarNetwork.shibuya]: {},
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eAstarNetwork.shibuya]: '',
  },
  WETH: {
    [eAstarNetwork.shibuya]: '0x04efa209F9e74E612a529c393Cf9F1141E696F06',
  },
  WrappedNativeToken: {
    [eAstarNetwork.shibuya]: '0x321F318e7C276c93Cf3094fd3a9d7c4362fd19FB', // WSBY
  },
  ReserveFactorTreasuryAddress: {
    [eAstarNetwork.shibuya]: ZERO_ADDRESS,
  },
  IncentivesController: {
    [eAstarNetwork.shibuya]: ZERO_ADDRESS,
  },
};
