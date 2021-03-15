import BigNumber from 'bignumber.js';
import {
  oneEther,
  oneRay,
  RAY,
  ZERO_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
} from '../../helpers/constants';
import { ICommonConfiguration, ePolygonNetwork } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ATokenNamePrefix: 'Aave Matic Market',
  StableDebtTokenNamePrefix: 'Aave Matic Market stable debt',
  VariableDebtTokenNamePrefix: 'Aave Matic Market variable debt',
  SymbolPrefix: 'm',
  ProviderId: 0, // Overriden in index.ts
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
    WBTC: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    WMATIC: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(), // TEMP
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [ePolygonNetwork.mumbai]: undefined,
    [ePolygonNetwork.matic]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdminIndex: 0,
  EmergencyAdmin: {
    [ePolygonNetwork.mumbai]: undefined,
    [ePolygonNetwork.matic]: undefined,
  },
  LendingPool: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '',
  },
  LendingPoolConfigurator: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '',
  },
  ProviderRegistry: {
    [ePolygonNetwork.mumbai]: '0x27453A916e91Fb922d309D92e637C0b6625846dF', // TEMP
    [ePolygonNetwork.matic]: '0xCfb7Fc3176566368188ad36CFC2Adbf3130785Af',
  },
  ProviderRegistryOwner: {
    [ePolygonNetwork.mumbai]: '0xa6842C2C7fece4Cdc6a4aaaD331eb1c7910e419A', // TEMP
    [ePolygonNetwork.matic]: '0x252B4e4Ed857e05c6deA76076A9275A34eE0a451',
  },
  LendingRateOracle: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '0xAD41Cb02f7BFb6D00e99F47cde6669e44c7C1CC0',
  },
  LendingPoolCollateralManager: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '',
  },
  TokenDistributor: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '',
  },
  WethGateway: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '',
  },
  AaveOracle: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '0x1B38fa90596F2C25bCf1B193A6c6a718349AFDfC',
  },
  FallbackOracle: {
    [ePolygonNetwork.mumbai]: ZERO_ADDRESS,
    [ePolygonNetwork.matic]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    [ePolygonNetwork.matic]: {
      DAI: '0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D',
      USDC: '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7',
      USDT: '0x0A6513e40db6EB1b165753AD52E80663aeA50545',
      WBTC: '0xc907E116054Ad103354f2D350FD2514433D57F6f',
      WETH: '0xF9680D99D6C9589e2a93a78A04A279e509205945',
      WMATIC: '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0',
    },
    [ePolygonNetwork.mumbai]: {
      DAI: ZERO_ADDRESS,
      USDC: ZERO_ADDRESS,
      USDT: ZERO_ADDRESS,
      WBTC: ZERO_ADDRESS,
      WMATIC: ZERO_ADDRESS,
    },
  },
  ReserveAssets: {
    [ePolygonNetwork.matic]: {},
    [ePolygonNetwork.mumbai]: {},
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '',
  },
  WETH: {
    [ePolygonNetwork.mumbai]: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889', // WMATIC address (untested)
    [ePolygonNetwork.matic]: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC address
  },
  ReserveFactorTreasuryAddress: {
    [ePolygonNetwork.mumbai]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c', // TEMP
    [ePolygonNetwork.matic]: '0x7734280A4337F37Fbf4651073Db7c28C80B339e9',
  },
};
