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
  SymbolPrefix: 'v',
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
    WAVAX: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(), // TODO: fix borrowRate?
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eAvalancheNetwork.avalanche]: undefined,
    [eAvalancheNetwork.fuji]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdminIndex: 0,
  EmergencyAdmin: {
    [eAvalancheNetwork.avalanche]: undefined,
    [eAvalancheNetwork.fuji]: undefined,
  },
  ProviderRegistry: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0x06eC0BDC3997EE32Cb5B66a1B9C11d92e2C27Aab',
  },
  ProviderRegistryOwner: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0x1128d177BdaA74Ae68EB06e693f4CbA6BF427a5e',
  },
  LendingRateOracle: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0xEbBD998B7Dc2a8E675F0859d907c8Fa6027aBc7b',
  },
  LendingPoolCollateralManager: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0x6242bE2fB5591FA1e81a99e6DD55Ff667fa82a71',
  },
  LendingPoolConfigurator: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '',
  },
  LendingPool: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0x5f3968A2E41C95A95329333d44AB989de6c43f8E',
  },
  WethGateway: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0x62AF6258d26838f33BADFbb33cf1De8FaB8EB19f',
  },
  TokenDistributor: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '',
  },
  AaveOracle: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '0xD217DdD9f0Af84644dEFe84a0b634621D4617a29',
  },
  FallbackOracle: {
    [eAvalancheNetwork.avalanche]: ZERO_ADDRESS,
    [eAvalancheNetwork.fuji]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    [eAvalancheNetwork.avalanche]: {
      WETH: '0x976B3D034E162d8bD72D6b9C989d545b839003b0',
      DAI: '0x51D7180edA2260cc4F6e4EebB82FEF5c3c2B8300',
      USDC: '0xF096872672F44d6EBA71458D74fe67F9a77a23B9',
      USDT: '0xEBE676ee90Fe1112671f19b6B7459bC678B67e8a',
      AAVE: '0x3CA13391E9fb38a75330fb28f8cc2eB3D9ceceED',
      WBTC: '0x2779D32d5166BAaa2B2b658333bA7e6Ec0C65743',
      WAVAX: '0x0A77230d17318075983913bC2145DB16C7366156',
    },
    [eAvalancheNetwork.fuji]: {
      WETH: '0x86d67c3D38D2bCeE722E601025C25a575021c6EA',
      USDT: '0x7898AcCC83587C3C55116c5230C17a6Cd9C71bad',
      WBTC: '0x31CF013A08c6Ac228C94551d535d5BAfE19c602a',
      WAVAX: '0x5498BB86BC934c8D34FDA08E81D444153d0D06aD',
      USD: '0x86d67c3D38D2bCeE722E601025C25a575021c6EA',
    },
  },
  ReserveAssets: {
    [eAvalancheNetwork.avalanche]: {},
    [eAvalancheNetwork.fuji]: {},
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '',
  },
  WETH: {
    [eAvalancheNetwork.avalanche]: '',
    [eAvalancheNetwork.fuji]: '',
  },
  WrappedNativeToken: {
    [eAvalancheNetwork.avalanche]: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // Official WAVAX
    [eAvalancheNetwork.fuji]: '0xd00ae08403B9bbb9124bB305C09058E32C39A48c', // Official WAVAX
  },
  ReserveFactorTreasuryAddress: {
    [eAvalancheNetwork.avalanche]: '0x467b92aF281d14cB6809913AD016a607b5ba8A36',
    [eAvalancheNetwork.fuji]: '0xB45F5C501A22288dfdb897e5f73E189597e09288', // Self-controlled EOA for testing
  },
  IncentivesController: {
    [eAvalancheNetwork.avalanche]: '0x01D83Fe6A10D2f2B7AF17034343746188272cAc9',
    [eAvalancheNetwork.fuji]: '0xa1EF206fb9a8D8186157FC817fCddcC47727ED55',
  },
};
