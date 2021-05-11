import BigNumber from 'bignumber.js';
import { oneEther, oneRay, RAY, ZERO_ADDRESS, MOCK_CHAINLINK_AGGREGATORS_PRICES } from '../../helpers/constants';
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
  EmergencyAdmin: {
    [ePolygonNetwork.mumbai]: undefined,
    [ePolygonNetwork.matic]: undefined,
  },
  LendingPool: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '0xABdC61Cd16e5111f335f4135B7A0e65Cc7F86327',
  },
  LendingPoolConfigurator: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '0x17c4A170FFF882862F656597889016D3a6073534',
  },
  EmergencyAdminIndex: 1,
  ProviderRegistry: {
    [ePolygonNetwork.mumbai]: '0x569859d41499B4dDC28bfaA43915051FF0A38a6F', // TEMP
    [ePolygonNetwork.matic]: '0x28334e4791860a0c1eCF89a62B973ba04a5d643F',  // TEMP
  },
  ProviderRegistryOwner: {
    [ePolygonNetwork.mumbai]: '0x18d9bA2baEfBdE0FF137C4ad031427EF205f1Fd9', // TEMP
    [ePolygonNetwork.matic]: '0x85e4A467343c0dc4aDAB74Af84448D9c45D8ae6F',  // TEMP
  },
  LendingRateOracle: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '',
  },  
  LendingPoolCollateralManager: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '0x9Af76e0575D139570D3B4c821567Fe935E8c25C5',
  },
  TokenDistributor: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '',
  },
  WethGateway: {
    [ePolygonNetwork.mumbai]: '',
    [ePolygonNetwork.matic]: '0x15A46f5073789b7D16F6F46632aE50Bae838d938',
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
    [ePolygonNetwork.matic]: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',  // WMATIC address
  },
  ReserveFactorTreasuryAddress: {
    [ePolygonNetwork.mumbai]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',   // TEMP 
    [ePolygonNetwork.matic]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',    // TEMP  
  },
};
