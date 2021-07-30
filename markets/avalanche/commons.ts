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
    [eAvalancheNetwork.fuji]: '0x2e4c88B23A52Af210619E9FFA4371708E3Bfc286'
  },
  ProviderRegistryOwner: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0xA68E2f643e0fa7062A78DFB6C629577aE21ad829'
  },
  LendingRateOracle: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0x0BA6fa6D6800dc900dB82d58D135fD0e0DA1a77A'
  },
  LendingPoolCollateralManager: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0x102035669D37a48689859A9F1cf03F294c8b7f56'
  },
  LendingPoolConfigurator: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0x4de9ee3d1F33676e505CA3747993929c29802293'
  },
  LendingPool: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: ''
  },
  WethGateway: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0xd00ae08403B9bbb9124bB305C09058E32C39A48c'
  },
  TokenDistributor: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: ''
  },
  AaveOracle: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0x7cb1a6663D864eBD5cB0cDA6063FBf5e3A9285eC'
  },
  FallbackOracle: {
    [eAvalancheNetwork.avalanche]: ZERO_ADDRESS,
    [eAvalancheNetwork.fuji]: ZERO_ADDRESS // TODO: Deploy?
  },
  ChainlinkAggregator: {
    [eAvalancheNetwork.avalanche]: {
      WETH: '0x976B3D034E162d8bD72D6b9C989d545b839003b0',
      DAI: '0x51D7180edA2260cc4F6e4EebB82FEF5c3c2B8300',
      USDC: '',
      USDT: '0xEBE676ee90Fe1112671f19b6B7459bC678B67e8a',
      AAVE: '',
      WBTC: '0x2779D32d5166BAaa2B2b658333bA7e6Ec0C65743',
      AVAX: '0x0A77230d17318075983913bC2145DB16C7366156',
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
    [eAvalancheNetwork.avalanche]: '0xf20d962a6c8f70c731bd838a3a388D7d48fA6e15', // TODO: ETH Address
    [eAvalancheNetwork.fuji]: '0x3b8b3fc85ccA720809Af2dA4B58cF4ce84bcbdd0' // TODO: Mock ETH
  },
  WrappedNativeToken: {
    [eAvalancheNetwork.avalanche]: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // Official WAVAX 
    [eAvalancheNetwork.fuji]: '0xd00ae08403B9bbb9124bB305C09058E32C39A48c' // Official WAVAX
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
