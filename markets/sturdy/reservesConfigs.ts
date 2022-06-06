import { eContractid, IReserveParams } from '../../helpers/types';

import { 
  rateStrategyStableTwo,
  rateStrategySTETH,
  rateStrategyYVRETH_WSTETH,
  rateStrategyCVXRETH_WSTETH,
  rateStrategyCVXFRAX_3CRV,
  rateStrategyCVXSTECRV,
  rateStrategyCVXDOLA_3CRV,
} from './rateStrategies';

export const strategyDAI: IReserveParams = {
  strategy: rateStrategyStableTwo,
  baseLTVAsCollateral: '0'/*'7500'*/,
  liquidationThreshold: '0'/*'8000'*/,
  liquidationBonus: '0'/*'10500'*/,
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  reserveFactor: '1000',
  collateralEnabled: false,
  emissionPerSecond: '10',
};

export const strategyUSDC: IReserveParams = {
  strategy: rateStrategyStableTwo,
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

export const strategyUSDT: IReserveParams = {
  strategy: rateStrategyStableTwo,
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

export const strategySTETH: IReserveParams = {
  strategy: rateStrategySTETH,
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

export const strategyYVRETH_WSTETH: IReserveParams = {
  strategy: rateStrategyYVRETH_WSTETH,
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

export const strategyCVXRETH_WSTETH: IReserveParams = {
  strategy: rateStrategyCVXRETH_WSTETH,
  baseLTVAsCollateral: '9000',
  liquidationThreshold: '9300',
  liquidationBonus: '10200',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
  };

export const strategyCVXFRAX_3CRV: IReserveParams = {
  strategy: rateStrategyCVXFRAX_3CRV,
  baseLTVAsCollateral: '9000',
  liquidationThreshold: '9300',
  liquidationBonus: '10200',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
  };

export const strategyCVXSTECRV: IReserveParams = {
  strategy: rateStrategyCVXSTECRV,
  baseLTVAsCollateral: '9000',
  liquidationThreshold: '9300',
  liquidationBonus: '10200',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
  };

export const strategyCVXDOLA_3CRV: IReserveParams = {
  strategy: rateStrategyCVXDOLA_3CRV,
  baseLTVAsCollateral: '9000',
  liquidationThreshold: '9300',
  liquidationBonus: '10200',
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: '18',
  aTokenImpl: eContractid.ATokenForCollateral,
  reserveFactor: '0',
  collateralEnabled: true,
  emissionPerSecond: '0',
  };