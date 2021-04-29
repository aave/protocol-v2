import { MAX_BORROW_CAP } from '../../helpers/constants';
import { eContractid, IReserveParams} from '../../helpers/types';
import {
  rateStrategyAmmBase,
  rateStrategyStable,
  rateStrategyBaseOne,
} from './rateStrategies';


export const strategyWETH: IReserveParams = {
  strategy: rateStrategyBaseOne,
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8250',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyWBTC: IReserveParams = {
  strategy: rateStrategyBaseOne,
  baseLTVAsCollateral: '7000',
  liquidationThreshold: '7500',
  liquidationBonus: '11000',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '8',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '2000',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyDAI: IReserveParams = {
  strategy: rateStrategyStable,
  baseLTVAsCollateral: '7500',
  liquidationThreshold: '8000',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyUSDC: IReserveParams = {
  strategy: rateStrategyStable,
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8500',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '6',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyUSDT: IReserveParams = {
  strategy: rateStrategyStable,
  baseLTVAsCollateral: '-1',
  liquidationThreshold: '8500',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '6',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyDAIWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyWBTCWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyAAVEWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '500',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyBATWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyDAIUSDC: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyCRVWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '5000',
  liquidationThreshold: '6000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyLINKWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyMKRWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyRENWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500',
  borrowCap: MAX_BORROW_CAP,
};

export const strategySNXWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '4000',
  liquidationThreshold: '6000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '2000',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyUNIWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyUSDCWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyWBTCUSDC: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyYFIWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '5000',
  liquidationThreshold: '6000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500',
  borrowCap: MAX_BORROW_CAP,
};

export const strategyBALWETH: IReserveParams = {
  strategy: rateStrategyAmmBase,
  baseLTVAsCollateral: '6000',
  liquidationThreshold: '7000',
  liquidationBonus: '11500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1500',
  borrowCap: MAX_BORROW_CAP,
}