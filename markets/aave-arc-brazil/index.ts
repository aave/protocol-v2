import { strategyBRL } from './reservesConfigs';
import { strategyUSDC, strategyWBTC, strategyWETH } from '../aave-arc/reservesConfigs';
import { oneRay, ZERO_ADDRESS } from './../../helpers/constants';
import {
  ePolygonNetwork,
  IAaveArcBrazilConfiguration,
  eEthereumNetwork,
} from './../../helpers/types';
import { AaveArcConfig } from './../aave-arc/index';
import { parseUnits } from 'ethers/lib/utils';

const borrowRate = oneRay.multipliedBy(0.03).toFixed();

export const AaveArcBrazil: IAaveArcBrazilConfiguration = {
  ...AaveArcConfig,
  OracleQuoteCurrency: 'USD',
  OracleQuoteUnit: parseUnits('1', 8).toString(),
  MarketId: 'Aave Arc Brazil Testnet',
  LendingRateOracleRatesCommon: {
    BRL: {
      borrowRate,
    },
    USDC: {
      borrowRate,
    },
    WETH: {
      borrowRate,
    },
    WBTC: {
      borrowRate,
    },
  },
  ReservesConfig: {
    BRL: strategyBRL,
    USDC: strategyUSDC,
    WETH: strategyWETH,
    WBTC: strategyWBTC,
  },
  ReserveAssets: {
    [ePolygonNetwork.matic]: {},
    [eEthereumNetwork.goerli]: {
      BRL: ZERO_ADDRESS,
      USDC: ZERO_ADDRESS,
      WETH: ZERO_ADDRESS,
      WBTC: ZERO_ADDRESS,
    },
    [ePolygonNetwork.mumbai]: {
      BRL: ZERO_ADDRESS,
      USDC: ZERO_ADDRESS,
      WETH: ZERO_ADDRESS,
      WBTC: ZERO_ADDRESS,
    },
  },
  Mocks: {
    AllAssetsInitialPrices: {
      BRL: parseUnits('0.192', 8).toString(),
      USDC: parseUnits('1', 8).toString(),
      WETH: parseUnits('1300', 8).toString(),
      WBTC: parseUnits('16350', 8).toString(),
    },
  },
};
