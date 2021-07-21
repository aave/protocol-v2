import BigNumber from 'bignumber.js';
import {
  oneEther,
  oneRay,
  RAY,
  ZERO_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  oneUsd,
} from '../../helpers/constants';
import { ICommonConfiguration, eAvalancheNetwork } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ATokenNamePrefix: 'Aave Avalanche Market',
  StableDebtTokenNamePrefix: 'Aave Avalanche Market stable debt',
  VariableDebtTokenNamePrefix: 'Aave Avalanche Market variable debt',
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
    AVAX: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(), // TODO: fix borrowRate?
    }
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eAvalancheNetwork.avalanche]: undefined,
    [eAvalancheNetwork.fuji]: undefined
  },
  PoolAdminIndex: 0,
  EmergencyAdminIndex: 0,
  EmergencyAdmin: {
    [eAvalancheNetwork.avalanche]: undefined,
    [eAvalancheNetwork.fuji]: undefined
  },
  ProviderRegistry: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0x3C50d48864d0866B854120fd5B6e1CC7783BB92c'
  },
  ProviderRegistryOwner: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0xA68E2f643e0fa7062A78DFB6C629577aE21ad829'
  },
  LendingRateOracle: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0x82493D29a6CD24cF6C3865Ad5Ef728A6A8920194'
  },
  LendingPoolCollateralManager: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0x67abd0a85e1a2eAf10995820C23A455De7E164Af'
  },
  LendingPoolConfigurator: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: ''
  },
  LendingPool: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: ''
  },
  WethGateway: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: ''
  },
  TokenDistributor: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: ''
  },
  AaveOracle: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: ''
  },
  FallbackOracle: {
    [eAvalancheNetwork.avalanche]: ZERO_ADDRESS,
    [eAvalancheNetwork.fuji]: ZERO_ADDRESS // TODO: Deploy?
  },
  ChainlinkAggregator: {
    [eAvalancheNetwork.avalanche]: {
      WETH: '',
      DAI: '',
      USDC: '',
      USDT: '',
      AAVE: '',
      WBTC: '	',
      AVAX: '',
    },
    [eAvalancheNetwork.fuji]: {
      WETH: '0x86d67c3D38D2bCeE722E601025C25a575021c6EA',
      // DAI: '',
      // USDC: '',
      USDT: '0x7898AcCC83587C3C55116c5230C17a6Cd9C71bad',
      // AAVE: '',
      WBTC: '0x31CF013A08c6Ac228C94551d535d5BAfE19c602a',
      // AVAX: '0x5498BB86BC934c8D34FDA08E81D444153d0D06aD',
      USD: '0x86d67c3D38D2bCeE722E601025C25a575021c6EA'
    },
  },
  ReserveAssets: {
    [eAvalancheNetwork.avalanche]: {},
    [eAvalancheNetwork.fuji]: {}
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: ''
  },
  WETH: {
    [eAvalancheNetwork.avalanche]: '0xf20d962a6c8f70c731bd838a3a388D7d48fA6e15', // TODO: Add WETH address
    [eAvalancheNetwork.fuji]: '0x86d67c3D38D2bCeE722E601025C25a575021c6EA'
  },
  WrappedNativeToken: {
    [eAvalancheNetwork.avalanche]: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', 
    [eAvalancheNetwork.fuji]: '0xd00ae08403B9bbb9124bB305C09058E32C39A48c' // TODO: Add WAVAX address?
  },
  ReserveFactorTreasuryAddress: {
    [eAvalancheNetwork.avalanche]: '0x652e2Ac6b072Ba8bF7BEF2B11B092447dBc40bde', // TODO: Deploy Treasury
    [eAvalancheNetwork.fuji]: '0x652e2Ac6b072Ba8bF7BEF2B11B092447dBc40bde'
  },
  IncentivesController: {
    [eAvalancheNetwork.avalanche]: ZERO_ADDRESS,
    [eAvalancheNetwork.fuji]: ZERO_ADDRESS
  },
};
