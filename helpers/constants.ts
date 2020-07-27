import {
  iAssetBase,
  iAavePoolAssets,
  IMarketRates,
  iAssetAggregatorBase,
  AavePools,
  iMultiPoolsAssets,
  IReserveParams,
  tEthereumAddress,
  iBasicDistributionParams,
} from './types';
import BigNumber from 'bignumber.js';
import {getParamPerPool} from './contracts-helpers';

export const TEST_SNAPSHOT_ID = '0x1';

// ----------------
// MATH
// ----------------

export const WAD = Math.pow(10, 18).toString();
export const HALF_WAD = new BigNumber(WAD).multipliedBy(0.5).toString();
export const RAY = new BigNumber(10).exponentiatedBy(27).toFixed();
export const HALF_RAY = new BigNumber(RAY).multipliedBy(0.5).toFixed();
export const WAD_RAY_RATIO = Math.pow(10, 9).toString();
export const oneEther = new BigNumber(Math.pow(10, 18));
export const oneRay = new BigNumber(Math.pow(10, 27));
export const MAX_UINT_AMOUNT =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------
export const OPTIMAL_UTILIZATION_RATE = new BigNumber(0.8).times(RAY);
export const EXCESS_UTILIZATION_RATE = new BigNumber(0.2).times(RAY);
export const ONE_YEAR = '31536000';
export const APPROVAL_AMOUNT_LENDING_POOL = '1000000000000000000000000000';
export const TOKEN_DISTRIBUTOR_PERCENTAGE_BASE = '10000';
export const MOCK_USD_PRICE_IN_WEI = '5848466240000000';
export const USD_ADDRESS = '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96';
export const MOCK_ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ONE_ADDRESS = '0x0000000000000000000000000000000000000001';
export const AAVE_REFERRAL = '0';

// ----------------
// COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
// ----------------

export const ALL_AAVE_RESERVES_SYMBOLS = [
  [
    'ETH',
    'DAI',
    'LEND',
    'TUSD',
    'BAT',
    'USDC',
    'USDT',
    'SUSD',
    'ZRX',
    'MKR',
    'WBTC',
    'LINK',
    'KNC',
    'MANA',
    'REP',
    'SNX',
    'BUSD',
    'UNI_DAI_ETH',
    'UNI_USDC_ETH',
    'UNI_SETH_ETH',
    'UNI_LINK_ETH',
    'UNI_MKR_ETH',
    'UNI_LEND_ETH',
  ],
];

export const MOCK_CHAINLINK_AGGREGATORS_PRICES: iAssetAggregatorBase<string> = {
  DAI: oneEther.multipliedBy('0.00369068412860').toFixed(),
  TUSD: oneEther.multipliedBy('0.00364714136416').toFixed(),
  USDC: oneEther.multipliedBy('0.00367714136416').toFixed(),
  LEND: oneEther.multipliedBy('0.00003620948469').toFixed(),
  BAT: oneEther.multipliedBy('0.00137893825230').toFixed(),
  USDT: oneEther.multipliedBy('0.00369068412860').toFixed(),
  SUSD: oneEther.multipliedBy('0.00364714136416').toFixed(),
  MKR: oneEther.multipliedBy('2.508581').toFixed(),
  REP: oneEther.multipliedBy('0.048235').toFixed(),
  ZRX: oneEther.multipliedBy('0.001151').toFixed(),
  WBTC: oneEther.multipliedBy('47.332685').toFixed(),
  LINK: oneEther.multipliedBy('0.009955').toFixed(),
  KNC: oneEther.multipliedBy('0.001072').toFixed(),
  MANA: oneEther.multipliedBy('0.000158').toFixed(),
  SNX: oneEther.multipliedBy('0.00442616').toFixed(),
  BUSD: oneEther.multipliedBy('0.00736484').toFixed(),
  USD: MOCK_USD_PRICE_IN_WEI,
  UNI_DAI_ETH: oneEther.multipliedBy('2.1').toFixed(),
  UNI_USDC_ETH: oneEther.multipliedBy('2.1').toFixed(),
  UNI_SETH_ETH: oneEther.multipliedBy('2.1').toFixed(),
  UNI_LEND_ETH: oneEther.multipliedBy('2.1').toFixed(),
  UNI_LINK_ETH: oneEther.multipliedBy('2.1').toFixed(),
  UNI_MKR_ETH: oneEther.multipliedBy('2.1').toFixed(),
};

export const ALL_ASSETS_INITIAL_PRICES: iAssetBase<string> = {
  ...MOCK_CHAINLINK_AGGREGATORS_PRICES,
  ETH: oneEther.toFixed(),
};

export const LENDING_RATE_ORACLE_RATES_COMMON: iAavePoolAssets<IMarketRates> = {
  ETH: {
    borrowRate: oneRay.multipliedBy(0.03).toFixed(),
  },
  DAI: {
    borrowRate: oneRay.multipliedBy(0.039).toFixed(),
  },
  TUSD: {
    borrowRate: oneRay.multipliedBy(0.035).toFixed(),
  },
  USDC: {
    borrowRate: oneRay.multipliedBy(0.039).toFixed(),
  },
  SUSD: {
    borrowRate: oneRay.multipliedBy(0.035).toFixed(),
  },
  USDT: {
    borrowRate: oneRay.multipliedBy(0.035).toFixed(),
  },
  BAT: {
    borrowRate: oneRay.multipliedBy(0.03).toFixed(),
  },
  LEND: {
    borrowRate: oneRay.multipliedBy(0.03).toFixed(),
  },
  LINK: {
    borrowRate: oneRay.multipliedBy(0.03).toFixed(),
  },
  KNC: {
    borrowRate: oneRay.multipliedBy(0.03).toFixed(),
  },
  REP: {
    borrowRate: oneRay.multipliedBy(0.03).toFixed(),
  },
  MKR: {
    borrowRate: oneRay.multipliedBy(0.03).toFixed(),
  },
  MANA: {
    borrowRate: oneRay.multipliedBy(0.03).toFixed(),
  },
  WBTC: {
    borrowRate: oneRay.multipliedBy(0.03).toFixed(),
  },
  ZRX: {
    borrowRate: oneRay.multipliedBy(0.03).toFixed(),
  },
  SNX: {
    borrowRate: oneRay.multipliedBy(0.03).toFixed(),
  },
  BUSD: {
    borrowRate: oneRay.multipliedBy(0.05).toFixed(),
  },
};

export const getReservesConfigByPool = (pool: AavePools): iMultiPoolsAssets<IReserveParams> =>
  getParamPerPool<iMultiPoolsAssets<IReserveParams>>(
    {
      [AavePools.proto]: {
        DAI: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.05).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.16).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '7500',
          liquidationThreshold: '8000',
          liquidationBonus: '10500',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '18',
        },
        TUSD: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.14).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '7500',
          liquidationThreshold: '8000',
          liquidationBonus: '10500',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '18',
        },
        USDC: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.16).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '7500',
          liquidationThreshold: '8000',
          liquidationBonus: '10500',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '6',
        },
        USDT: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.14).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '-1',
          liquidationThreshold: '8000',
          liquidationBonus: '10500',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '6',
        },
        SUSD: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.14).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '-1',
          liquidationThreshold: '8000',
          liquidationBonus: '10500',
          borrowingEnabled: true,
          stableBorrowRateEnabled: false,
          reserveDecimals: '18',
        },
        LEND: {
          baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '6000',
          liquidationThreshold: '6500',
          liquidationBonus: '11500',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '18',
        },
        BAT: {
          baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '6000',
          liquidationThreshold: '6500',
          liquidationBonus: '11000',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '18',
        },
        ETH: {
          baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '7500',
          liquidationThreshold: '8000',
          liquidationBonus: '10500',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '18',
        },
        LINK: {
          baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '6500',
          liquidationThreshold: '7000',
          liquidationBonus: '11000',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '18',
        },
        WBTC: {
          baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '6000',
          liquidationThreshold: '6500',
          liquidationBonus: '11500',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '8',
        },
        KNC: {
          baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '6000',
          liquidationThreshold: '6500',
          liquidationBonus: '11000',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '18',
        },
        REP: {
          baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '6000',
          liquidationThreshold: '6500',
          liquidationBonus: '11000',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '18',
        },
        MKR: {
          baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '6000',
          liquidationThreshold: '6500',
          liquidationBonus: '11000',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '18',
        },
        MANA: {
          baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '6000',
          liquidationThreshold: '6500',
          liquidationBonus: '11000',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '18',
        },
        ZRX: {
          baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '6000',
          liquidationThreshold: '6500',
          liquidationBonus: '11000',
          borrowingEnabled: true,
          stableBorrowRateEnabled: true,
          reserveDecimals: '18',
        },
        SNX: {
          baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.12).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '-1',
          liquidationThreshold: '6500',
          liquidationBonus: '11000',
          borrowingEnabled: true,
          stableBorrowRateEnabled: false,
          reserveDecimals: '18',
        },
        BUSD: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.14).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '-1',
          liquidationThreshold: '8000',
          liquidationBonus: '11000',
          borrowingEnabled: true,
          stableBorrowRateEnabled: false,
          reserveDecimals: '18',
        },
      },
      [AavePools.secondary]: {
        ETH: {
          baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '-1',
          liquidationThreshold: '8000',
          liquidationBonus: '10500',
          borrowingEnabled: true,
          stableBorrowRateEnabled: false,
          reserveDecimals: '18',
        },
        DAI: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.07).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.06).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '-1',
          liquidationThreshold: '8000',
          liquidationBonus: '10500',
          borrowingEnabled: true,
          stableBorrowRateEnabled: false,
          reserveDecimals: '18',
        },
        USDC: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.07).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.06).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '-1',
          liquidationThreshold: '8000',
          liquidationBonus: '10500',
          borrowingEnabled: true,
          stableBorrowRateEnabled: false,
          reserveDecimals: '6',
        },
        USDT: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.07).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.06).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '-1',
          liquidationThreshold: '8000',
          liquidationBonus: '10500',
          borrowingEnabled: true,
          stableBorrowRateEnabled: false,
          reserveDecimals: '6',
        },
        UNI_DAI_ETH: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.16).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '6800',
          liquidationThreshold: '7300',
          liquidationBonus: '11000',
          borrowingEnabled: false,
          stableBorrowRateEnabled: false,
          reserveDecimals: '18',
        },
        UNI_USDC_ETH: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.16).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '6800',
          liquidationThreshold: '7300',
          liquidationBonus: '11000',
          borrowingEnabled: false,
          stableBorrowRateEnabled: false,
          reserveDecimals: '18',
        },
        UNI_SETH_ETH: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.16).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '4800',
          liquidationThreshold: '6600',
          liquidationBonus: '11000',
          borrowingEnabled: false,
          stableBorrowRateEnabled: false,
          reserveDecimals: '18',
        },
        UNI_LEND_ETH: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.16).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '5100',
          liquidationThreshold: '6600',
          liquidationBonus: '11000',
          borrowingEnabled: false,
          stableBorrowRateEnabled: false,
          reserveDecimals: '18',
        },
        UNI_LINK_ETH: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.16).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '6300',
          liquidationThreshold: '6800',
          liquidationBonus: '11000',
          borrowingEnabled: false,
          stableBorrowRateEnabled: false,
          reserveDecimals: '18',
        },
        UNI_MKR_ETH: {
          baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
          variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
          variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
          stableRateSlope1: new BigNumber(0.16).multipliedBy(oneRay).toFixed(),
          stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
          baseLTVAsCollateral: '4800',
          liquidationThreshold: '6600',
          liquidationBonus: '11000',
          borrowingEnabled: false,
          stableBorrowRateEnabled: false,
          reserveDecimals: '18',
        },
      },
    },
    pool
  );

export const getFeeDistributionParamsCommon = (
  receiver: tEthereumAddress
): iBasicDistributionParams => {
  const receivers = [receiver, ZERO_ADDRESS];
  const percentages = ['2000', '8000'];
  return {
    receivers,
    percentages,
  };
};
