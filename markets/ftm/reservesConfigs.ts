import { eContractid, IReserveParams } from '../../helpers/types';

import {
  rateStrategyStableTwo,
  rateStrategyStableThree,
  rateStrategyYVWFTM,
  rateStrategyMOOWETH,
  rateStrategyYVWETH,
  rateStrategyYVWBTC,
  rateStrategyYVBOO,
  rateStrategyMOOTOMB_FTM,
  rateStrategyMOOTOMB_MIMATIC,
  rateStrategyYVFBEETS,
  rateStrategyYVLINK,
  rateStrategyYVCRV,
  rateStrategyYVSPELL,
  rateStrategyMOOBASED_MIMATIC,
} from './rateStrategies';

export const strategyDAI: IReserveParams = {
  strategy: rateStrategyStableTwo,
  baseLTVAsCollateral: '0' /*'7500'*/,
  liquidationThreshold: '0' /*'8000'*/,
  liquidationBonus: '0' /*'10500'*/,
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000',
  collateralEnabled: false,
  emissionPerSecond: '10',
};

export const strategyUSDC: IReserveParams = {
  strategy: rateStrategyStableThree,
  baseLTVAsCollateral: '0' /*'7500'*/,
  liquidationThreshold: '0' /*'8000'*/,
  liquidationBonus: '0' /*'10500'*/,
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '6',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000',
  collateralEnabled: false,
  emissionPerSecond: '10',
};

export const strategyUSDT: IReserveParams = {
  strategy: rateStrategyStableThree,
  baseLTVAsCollateral: '0'/*'7500'*/,
  liquidationThreshold: '0'/*'8000'*/,
  liquidationBonus: '0'/*'10500'*/,
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '6',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000',
  collateralEnabled: false,
  emissionPerSecond: '10',
};

export const strategyYVWFTM: IReserveParams = {
  strategy: rateStrategyYVWFTM,
  baseLTVAsCollateral: '7000',
  liquidationThreshold: '7500',
  liquidationBonus: '10750',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
};

export const strategyMOOWETH: IReserveParams = {
  strategy: rateStrategyMOOWETH,
  baseLTVAsCollateral: '7000',
  liquidationThreshold: '7500',
  liquidationBonus: '10750',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
};

export const strategyYVWETH: IReserveParams = {
    strategy: rateStrategyYVWETH,
    baseLTVAsCollateral: '0', //'7000',
    liquidationThreshold: '7500',
    liquidationBonus: '10750',
    borrowingEnabled: false,
    stableBorrowRateEnabled: false,
    reserveDecimals: '18',
    aTokenImpl: eContractid.ATokenForCollateral,
    reserveFactor: '0',
    collateralEnabled: true,
    emissionPerSecond: '0',
  };

export const strategyYVWBTC: IReserveParams = {
  strategy: rateStrategyYVWBTC,
  baseLTVAsCollateral: '0', //'7000',
  liquidationThreshold: '7500',
  liquidationBonus: '10750',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '8',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
};

export const strategyYVBOO: IReserveParams = {
  strategy: rateStrategyYVBOO,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11000',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
};

export const strategyMOOTOMB_FTM: IReserveParams = {
  strategy: rateStrategyMOOTOMB_FTM,
  baseLTVAsCollateral: '7000',
  liquidationThreshold: '7500',
  liquidationBonus: '10750',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
};

export const strategyMOOTOMB_MIMATIC: IReserveParams = {
  strategy: rateStrategyMOOTOMB_MIMATIC,
  baseLTVAsCollateral: '0', //'7000',
  liquidationThreshold: '7500',
  liquidationBonus: '10750',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
};

export const strategyYVFBEETS: IReserveParams = {
  strategy: rateStrategyYVFBEETS,
  baseLTVAsCollateral: '0', //'6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11000',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
};

export const strategyYVLINK: IReserveParams = {
  strategy: rateStrategyYVLINK,
  baseLTVAsCollateral: '0', //'7000',
  liquidationThreshold: '7500',
  liquidationBonus: '10700',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
};  

export const strategyYVCRV: IReserveParams = {
  strategy: rateStrategyYVCRV,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11000',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
};  

export const strategyYVSPELL: IReserveParams = {
  strategy: rateStrategyYVSPELL,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11000',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
};  

export const strategyMOOBASED_MIMATIC: IReserveParams = {
  strategy: rateStrategyMOOBASED_MIMATIC,
  baseLTVAsCollateral: '0', //'7000',
  liquidationThreshold: '7500',
  liquidationBonus: '10750',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
};
