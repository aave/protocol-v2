import BigNumber from 'bignumber.js';
import {oneRay} from '../helpers/constants';
import {IReserveParams} from '../helpers/types';

export const strategyBase: IReserveParams = {
  baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.07).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(3).multipliedBy(oneRay).toFixed(),
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '6500',
  liquidationBonus: '11000',
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: '18'
};

export const stablecoinStrategyBase: IReserveParams = {
  baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.07).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(1.5).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: new BigNumber(0.06).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(1.5).multipliedBy(oneRay).toFixed(),
  baseLTVAsCollateral: '7500',
  liquidationThreshold: '8000',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: '18',
};

export const stablecoinStrategyCentralized: IReserveParams = {
  baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.07).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: new BigNumber(0.06).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
  baseLTVAsCollateral: '7500',
  liquidationThreshold: '8000',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: '6',
};

export const strategyGovernanceTokens: IReserveParams = {
  ...strategyBase,
  baseLTVAsCollateral: '4000',
  liquidationBonus: '11500',
};

export const stablecoinStrategyBUSD: IReserveParams = {
  ...stablecoinStrategyCentralized,
  reserveDecimals: '18',
  baseLTVAsCollateral: '-1',
  liquidationThreshold: '0',
  liquidationBonus: '0',
  baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
  stableBorrowRateEnabled: false,
  stableRateSlope1: new BigNumber(0.14).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
};

export const strategyAAVE: IReserveParams = {
  ...strategyBase,
  baseLTVAsCollateral: '5000',
  liquidationThreshold: '6500',
  liquidationBonus: '11000',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
};

export const stablecoinStrategyDAI: IReserveParams = {
  ...stablecoinStrategyBase,
};

export const strategyENJ: IReserveParams = {
  ...strategyBase,
  baseLTVAsCollateral: '5500',
  stableBorrowRateEnabled: false,
};

export const strategyKNC: IReserveParams = {
  ...strategyBase,
  variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
};

export const strategyLINK: IReserveParams = {
  ...strategyBase,
  baseLTVAsCollateral: '6500',
  liquidationThreshold: '7000',
};

export const strategyMANA: IReserveParams = {
  ...strategyBase,
  variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(0.5).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
};

export const strategyMKR: IReserveParams = {
  ...strategyBase,
  baseLTVAsCollateral: '3500',
};

export const strategyREN: IReserveParams = {
  ...strategyBase,
  baseLTVAsCollateral: '5000',
  liquidationThreshold: '6500',
  liquidationBonus: '11000',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
};

export const strategyREP: IReserveParams = {
  ...strategyBase,
  baseLTVAsCollateral: '3500',
  variableRateSlope1: new BigNumber(0.07).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3).multipliedBy(oneRay).toFixed(),
  borrowingEnabled: false,
};

export const stablecoinStrategySUSD: IReserveParams = {
  baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(1).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: new BigNumber(0.14).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
  baseLTVAsCollateral: '-1',
  liquidationThreshold: '0',
  liquidationBonus: '0',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
};

export const strategySNX: IReserveParams = {
  ...strategyBase,
  baseLTVAsCollateral: '1500',
  liquidationThreshold: '4000',
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.12).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(1).multipliedBy(oneRay).toFixed(),
  stableBorrowRateEnabled: false,
};

export const stablecoinStrategyTUSD: IReserveParams = {
  ...stablecoinStrategyCentralized,
  baseVariableBorrowRate: new BigNumber(0.01).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(1.5).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: new BigNumber(0.14).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
};

export const strategyUNI: IReserveParams = {
  ...strategyGovernanceTokens,
  stableBorrowRateEnabled: false,
};

export const stablecoinStrategyUSDC: IReserveParams = {
  ...stablecoinStrategyBase,
  variableRateSlope2: new BigNumber(0.6).multipliedBy(oneRay).toFixed(),
  reserveDecimals: '6',
};

export const stablecoinStrategyUSDT: IReserveParams = {
  ...stablecoinStrategyBase,
  baseLTVAsCollateral: '-1',
  liquidationThreshold: '7000',
  liquidationBonus: '0',
  borrowingEnabled: false,
  stableBorrowRateEnabled: true,
  reserveDecimals: '6',
};

export const strategyWBTC: IReserveParams = {
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
};

export const strategyWETH: IReserveParams = {
  baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(1).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(1).multipliedBy(oneRay).toFixed(),
  baseLTVAsCollateral: '7500',
  liquidationThreshold: '8000',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: '18',
};

export const strategyYFI: IReserveParams = {
  ...strategyGovernanceTokens,
};
