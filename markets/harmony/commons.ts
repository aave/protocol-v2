import { oneRay, MOCK_CHAINLINK_AGGREGATORS_PRICES, oneUsd } from '../../helpers/constants';
import { ICommonConfiguration, eHarmonyNetwork } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ATokenNamePrefix: 'Aave Harmony Market',
  StableDebtTokenNamePrefix: 'Aave Harmony Market stable debt',
  VariableDebtTokenNamePrefix: 'Aave Harmony Market variable debt',
  SymbolPrefix: 'o',
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
  LendingRateOracleRatesCommon: {
    '1WETH': {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    '1DAI': {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    '1USDC': {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    '1USDT': {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    '1WBTC': {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    WONE: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eHarmonyNetwork.harmony]: undefined,
    [eHarmonyNetwork.testnet]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdminIndex: 0,
  EmergencyAdmin: {
    [eHarmonyNetwork.harmony]: undefined,
    [eHarmonyNetwork.testnet]: undefined,
  },
  FallbackOracle: {
    [eHarmonyNetwork.harmony]: undefined,
    [eHarmonyNetwork.testnet]: undefined,
  },
  ProviderRegistry: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  ProviderRegistryOwner: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  LendingRateOracle: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  LendingPoolCollateralManager: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  LendingPoolConfigurator: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  LendingPool: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  WethGateway: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  TokenDistributor: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  AaveOracle: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  ChainlinkAggregator: {
    [eHarmonyNetwork.harmony]: {
      '1ETH': '',
      '1WBTC': '',
      '1DAI': '',
      '1USDC': '',
      '1USDT': '',
      WONE: '',
    },
    [eHarmonyNetwork.testnet]: {
      '1WETH': '0x4f11696cE92D78165E1F8A9a4192444087a45b64',
      '1WBTC': '0xEF637736B220a58C661bfF4b71e03ca898DCC0Bd',
      '1DAI': '0x1FA508EB3Ac431f3a9e3958f2623358e07D50fe0',
      '1USDC': '0x6F2bD4158F771E120d3692C45Eb482C16f067dec',
      '1USDT': '0x9A37E1abFC430B9f5E204CA9294809c1AF37F697',
      WONE: '0xcEe686F89bc0dABAd95AEAAC980aE1d97A075FAD',
    },
  },
  ReserveAssets: {
    [eHarmonyNetwork.harmony]: {},
    [eHarmonyNetwork.testnet]: {},
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  WETH: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  WrappedNativeToken: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  ReserveFactorTreasuryAddress: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
  IncentivesController: {
    [eHarmonyNetwork.harmony]: '',
    [eHarmonyNetwork.testnet]: '',
  },
};
