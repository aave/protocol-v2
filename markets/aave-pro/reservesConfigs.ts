import { eContractid, IReserveParams } from '../../helpers/types';

import { rateStrategyStable, rateStrategyWETH, rateStrategyWBTC } from './rateStrategies';

export const strategyUSDC: IReserveParams = {
  strategy: rateStrategyStable,
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8500',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: '6',
  aTokenImpl: eContractid.AToken,
  stableDebtTokenImpl: eContractid.PermissionedStableDebtToken,
  variableDebtTokenImpl: eContractid.PermissionedVariableDebtToken,
  reserveFactor: '1000',
};

export const strategyUSDT: IReserveParams = {
  strategy: rateStrategyStable,
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8500',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: '6',
  aTokenImpl: eContractid.AToken,
  stableDebtTokenImpl: eContractid.PermissionedStableDebtToken,
  variableDebtTokenImpl: eContractid.PermissionedVariableDebtToken,
  reserveFactor: '1000',
};

export const strategyWETH: IReserveParams = {
  strategy: rateStrategyWETH,
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8250',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  stableDebtTokenImpl: eContractid.PermissionedStableDebtToken,
  variableDebtTokenImpl: eContractid.PermissionedVariableDebtToken,
  reserveFactor: '1000',
};

export const strategyWBTC: IReserveParams = {
  strategy: rateStrategyWBTC,
  baseLTVAsCollateral: '7000',
  liquidationThreshold: '7500',
  liquidationBonus: '11000',
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: '8',
  aTokenImpl: eContractid.AToken,
  stableDebtTokenImpl: eContractid.PermissionedStableDebtToken,
  variableDebtTokenImpl: eContractid.PermissionedVariableDebtToken,
  reserveFactor: '2000',
};
