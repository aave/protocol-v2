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
    AAVE: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
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
    [ePolygonNetwork.matic]: '0xeD03247f4858E60ad682B9865d64eCb46322ECfd',
  },
  ProviderRegistryOwner: {
    [ePolygonNetwork.mumbai]: '0xa6842C2C7fece4Cdc6a4aaaD331eb1c7910e419A', // TEMP
    [ePolygonNetwork.matic]: '0x88505CB63c1679145053c758ebb7b37ac241Bd2C',
  },
  LendingRateOracle: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '0x37Ce325Df9c92A994cC662443Dda6276a4BBBaf1',
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
    [ePolygonNetwork.matic]: '0x8746445fF50469B406C5642763979280AFe3e426',
  },
  AaveOracle: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '0x21451bD7b528896B4AB2b9764b521D6ed641708d',
  },
  FallbackOracle: {
    [ePolygonNetwork.mumbai]: ZERO_ADDRESS,
    [ePolygonNetwork.matic]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    [ePolygonNetwork.matic]: {
      AAVE: '0xbE23a3AA13038CfC28aFd0ECe4FdE379fE7fBfc4',
      DAI: '0xFC539A559e170f848323e19dfD66007520510085',
      USDC: '0xefb7e6be8356cCc6827799B6A7348eE674A80EaE',
      USDT: '0xf9d5AAC6E5572AEFa6bd64108ff86a222F69B64d',
      WBTC: '0xA338e0492B2F944E9F8C0653D3AD1484f2657a37',
      WMATIC: '0x327e23A4855b6F663a28c5161541d69Af8973302',
      USD: '0xF9680D99D6C9589e2a93a78A04A279e509205945',
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
    [ePolygonNetwork.mumbai]: '0x53CDb16B8C031B779e996406546614E5F05BC4Bf',
    [ePolygonNetwork.matic]: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  },
  ReserveFactorTreasuryAddress: {
    [ePolygonNetwork.mumbai]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c', // TEMP
    [ePolygonNetwork.matic]: '0x7734280A4337F37Fbf4651073Db7c28C80B339e9',
  },
  IncentivesController: {
    [ePolygonNetwork.mumbai]: ZERO_ADDRESS,
    [ePolygonNetwork.matic]: '0x357D51124f59836DeD84c8a1730D72B749d8BC23',
  },
};
