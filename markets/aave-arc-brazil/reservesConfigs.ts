import { eContractid, IReserveParams } from '../../helpers/types';

import { rateStrategyStable } from '../aave-arc/rateStrategies';

export const strategyBRL: IReserveParams = {
  strategy: rateStrategyStable,
  baseLTVAsCollateral: '7000',
  liquidationThreshold: '7500',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: '18',
  aTokenImpl: eContractid.AToken,
  stableDebtTokenImpl: eContractid.PermissionedStableDebtToken,
  variableDebtTokenImpl: eContractid.PermissionedVariableDebtToken,
  reserveFactor: '1000',
  name: 'Real brasileiro CBDC Testnet',
};
