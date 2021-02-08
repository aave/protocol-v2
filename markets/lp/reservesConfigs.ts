import BigNumber from 'bignumber.js';
import { oneRay } from '../../helpers/constants';
import { eContractid, IReserveParams } from '../../helpers/types';

export const strategyWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.65).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(1).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(1).multipliedBy(oneRay).toFixed(),
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8250',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000'
};

export const strategyWBTC: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.65).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(1).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: new BigNumber(0.1).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(1).multipliedBy(oneRay).toFixed(),
  baseLTVAsCollateral: '7000',
  liquidationThreshold: '7500',
  liquidationBonus: '11000',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '8',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '2000'
};

export const strategyDAI: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.8).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(0.75).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: new BigNumber(0.02).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(0.75).multipliedBy(oneRay).toFixed(),
  baseLTVAsCollateral: '7500',
  liquidationThreshold: '8000',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000'
};

export const strategyUSDC: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.8).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(0.75).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: new BigNumber(0.02).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(0.60).multipliedBy(oneRay).toFixed(),
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8500',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '6',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000'
};

export const strategyUSDT: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.8).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.04).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(0.75).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: new BigNumber(0.02).multipliedBy(oneRay).toFixed(),
  stableRateSlope2: new BigNumber(0.60).multipliedBy(oneRay).toFixed(),
  baseLTVAsCollateral: '-1',
  liquidationThreshold: '8500',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '6',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000'
};

export const strategyDAIWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000'
};

export const strategyWBTCWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500'
};

export const strategyAAVEWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '500'
};

export const strategyBATWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500'
};

export const strategyUSDCDAI: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000'
};

export const strategyCRVWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '5000',
  liquidationThreshold: '6000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '500'
};

export const strategyLINKWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500'
};

export const strategyMKRWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500'
};

export const strategyRENWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500'
};

export const strategySNXWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '4000',
  liquidationThreshold: '6000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '2000'
};

export const strategyUNIWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500'
};

export const strategyUSDCWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000'
};

export const strategyWBTCUSDC: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500'
};

export const strategyYFIWETH: IReserveParams = {
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.10).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(3.00).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  baseLTVAsCollateral: '5000',
  liquidationThreshold: '6000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500'
};