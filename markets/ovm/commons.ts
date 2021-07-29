import {
  oneRay,
  ZERO_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  oneUsd,
} from '../../helpers/constants';
import { ICommonConfiguration, eOptimismNetwork } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ATokenNamePrefix: 'Aave Optimism Market',
  StableDebtTokenNamePrefix: 'Aave Optimism Market stable debt',
  VariableDebtTokenNamePrefix: 'Aave Optimism Market variable debt',
  SymbolPrefix: '', // TODO: add a symbol?
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
    DAI: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    USDC: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    USDT: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    AAVE: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    WBTC: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    LINK: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eOptimismNetwork.optimismKovan]: undefined,
    [eOptimismNetwork.optimism]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdminIndex: 0,
  EmergencyAdmin: {
    [eOptimismNetwork.optimism]: undefined,
    [eOptimismNetwork.optimismKovan]: undefined,
  },
  ProviderRegistry: {
    [eOptimismNetwork.optimism]: '',
    [eOptimismNetwork.optimismKovan]: '0x18AF64027c1E17e99e5709E42174151F9f62C622',
  },
  ProviderRegistryOwner: {
    [eOptimismNetwork.optimism]: '',
    [eOptimismNetwork.optimismKovan]: '0xA68E2f643e0fa7062A78DFB6C629577aE21ad829',
  },
  LendingRateOracle: {
    [eOptimismNetwork.optimism]: '',
    [eOptimismNetwork.optimismKovan]: '0xf4fE2aBdcC90c80188E16A0aBc065da7e90cC0C9',
  },
  LendingPoolCollateralManager: {
    [eOptimismNetwork.optimism]: '',
    [eOptimismNetwork.optimismKovan]: '0xb4beffF48e24785F787c13EeF7366467477f8202',
  },
  LendingPoolConfigurator: {
    [eOptimismNetwork.optimism]: '',
    [eOptimismNetwork.optimismKovan]: '',
  },
  LendingPool: {
    [eOptimismNetwork.optimism]: '',
    [eOptimismNetwork.optimismKovan]: '',
  },
  WethGateway: {
    [eOptimismNetwork.optimism]: '',
    [eOptimismNetwork.optimismKovan]: '0x9B0C9d5a030915F01aB4962D52D54c03cf37D2ce',
  },
  TokenDistributor: {
    [eOptimismNetwork.optimism]: '',
    [eOptimismNetwork.optimismKovan]: '',
  },
  AaveOracle: {
    [eOptimismNetwork.optimism]: '',
    [eOptimismNetwork.optimismKovan]: '0xB6a4826e2e37118440B446C8Ff42D9b617b0844C',
  },
  FallbackOracle: {
    [eOptimismNetwork.optimism]: ZERO_ADDRESS,
    [eOptimismNetwork.optimismKovan]: ZERO_ADDRESS, // TODO: Deploy?
  },
  ChainlinkAggregator: {
    [eOptimismNetwork.optimism]: {
      WETH: '',
      DAI: '',
      USDC: '',
      USDT: '',
      AAVE: '',
      WBTC: '',
      LINK: '',
      USD: '',
    },
    [eOptimismNetwork.optimismKovan]: {
      WETH: '0xB438eADc39Ff9B3EaCA2e8ada6E9D74338f0B02D', // MOCK
      DAI: '0xa269EC2e011d07045Eaef98db5fA6F4399c01768', // MOCK
      USDC: '0x9E4702B6079BD54A5889E0104515fa87f4BB55AF', // MOCK
      // USDT: '',
      // AAVE: '',
      WBTC: '0x662807E8d69168c89743DAB7b3e3aE18b37cAD8a', // RANDOM
      // LINK: '',
      USD: '0xB438eADc39Ff9B3EaCA2e8ada6E9D74338f0B02D', // MOCK
    },
  },
  ReserveAssets: {
    [eOptimismNetwork.optimism]: {},
    [eOptimismNetwork.optimismKovan]: {},
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eOptimismNetwork.optimism]: '',
    [eOptimismNetwork.optimismKovan]: '',
  },
  WETH: {
    [eOptimismNetwork.optimism]: '0x4200000000000000000000000000000000000006', // TODO: WETH
    [eOptimismNetwork.optimismKovan]: '0x4200000000000000000000000000000000000006', // TODO: WETH
  },
  WrappedNativeToken: {
    [eOptimismNetwork.optimism]: '0x4200000000000000000000000000000000000006', // WETH
    [eOptimismNetwork.optimismKovan]: '0x4200000000000000000000000000000000000006', // WETH
  },
  ReserveFactorTreasuryAddress: {
    [eOptimismNetwork.optimism]: '0x652e2Ac6b072Ba8bF7BEF2B11B092447dBc40bde', // TODO: Deploy Treasury
    [eOptimismNetwork.optimismKovan]: '0x652e2Ac6b072Ba8bF7BEF2B11B092447dBc40bde',
  },
  IncentivesController: {
    [eOptimismNetwork.optimism]: ZERO_ADDRESS,
    [eOptimismNetwork.optimismKovan]: ZERO_ADDRESS,
  },
};
