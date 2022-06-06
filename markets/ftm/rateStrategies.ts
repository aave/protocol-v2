import BigNumber from 'bignumber.js';
import { oneEther, oneRay } from '../../helpers/constants';
import { IInterestRateStrategyParams } from '../../helpers/types';

// DAI
export const rateStrategyStableTwo: IInterestRateStrategyParams = {
  name: 'rateStrategyStableTwo',
  optimalUtilizationRate: new BigNumber(0.9).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0' /* new BigNumber(0).multipliedBy(oneRay).toFixed() */,
  variableRateSlope1: '0' /* new BigNumber(0.04).multipliedBy(oneRay).toFixed() */,
  variableRateSlope2: new BigNumber(0.2).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0' /* new BigNumber(0.02).multipliedBy(oneRay).toFixed() */,
  stableRateSlope2: '0' /* new BigNumber(0.75).multipliedBy(oneRay).toFixed() */,
  capacity: '0',
};

// USDC, USDT
export const rateStrategyStableThree: IInterestRateStrategyParams = {
  name: 'rateStrategyStableThree',
  optimalUtilizationRate: new BigNumber(0.9).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0' /* new BigNumber(0).multipliedBy(oneRay).toFixed() */,
  variableRateSlope1: '0' /* new BigNumber(0.04).multipliedBy(oneRay).toFixed() */,
  variableRateSlope2: new BigNumber(0.2).multipliedBy(oneRay).toFixed(),
  stableRateSlope1: '0' /* new BigNumber(0.02).multipliedBy(oneRay).toFixed() */,
  stableRateSlope2: '0' /* new BigNumber(0.60).multipliedBy(oneRay).toFixed() */,
  capacity: '0',
};

// yvWFTM
export const rateStrategyYVWFTM: IInterestRateStrategyParams = {
  name: 'rateStrategyYVWFTM',
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0',
  variableRateSlope1: '0',
  variableRateSlope2: '0',
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  capacity: new BigNumber(20000000).multipliedBy(oneEther).toFixed(),   // 20M
};

// mooWETH
export const rateStrategyMOOWETH: IInterestRateStrategyParams = {
  name: 'rateStrategyMOOWETH',
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0',
  variableRateSlope1: '0',
  variableRateSlope2: '0',
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  capacity: '0',
};

// yvWETH
export const rateStrategyYVWETH: IInterestRateStrategyParams = {
  name: 'rateStrategyYVWETH',
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0',
  variableRateSlope1: '0',
  variableRateSlope2: '0',
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  capacity: '0',
};

// yvWBTC
export const rateStrategyYVWBTC: IInterestRateStrategyParams = {
  name: 'rateStrategyYVWBTC',
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0',
  variableRateSlope1: '0',
  variableRateSlope2: '0',
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  capacity: '0',
};

// yvBOO
export const rateStrategyYVBOO: IInterestRateStrategyParams = {
  name: 'rateStrategyYVBOO',
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0',
  variableRateSlope1: '0',
  variableRateSlope2: '0',
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  capacity: '0',
};

// mooTOMB_FTM
export const rateStrategyMOOTOMB_FTM: IInterestRateStrategyParams = {
  name: 'rateStrategyMOOTOMB_FTM',
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0',
  variableRateSlope1: '0',
  variableRateSlope2: '0',
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  capacity: '0',
};

// mooTOMB_MIMATIC
export const rateStrategyMOOTOMB_MIMATIC: IInterestRateStrategyParams = {
  name: 'rateStrategyMOOTOMB_MIMATIC',
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0',
  variableRateSlope1: '0',
  variableRateSlope2: '0',
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  capacity: '0',
};

// yvfBEETS
export const rateStrategyYVFBEETS: IInterestRateStrategyParams = {
  name: 'rateStrategyYVFBEETS',
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0',
  variableRateSlope1: '0',
  variableRateSlope2: '0',
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  capacity: new BigNumber(8000000).multipliedBy(oneEther).toFixed(),   // 8M
};

// yvLINK
export const rateStrategyYVLINK: IInterestRateStrategyParams = {
  name: 'rateStrategyYVLINK',
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0',
  variableRateSlope1: '0',
  variableRateSlope2: '0',
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  capacity: '0',
};

// yvCRV
export const rateStrategyYVCRV: IInterestRateStrategyParams = {
  name: 'rateStrategyYVCRV',
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0',
  variableRateSlope1: '0',
  variableRateSlope2: '0',
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  capacity: '0',
};

// yvSPELL
export const rateStrategyYVSPELL: IInterestRateStrategyParams = {
  name: 'rateStrategyYVSPELL',
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0',
  variableRateSlope1: '0',
  variableRateSlope2: '0',
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  capacity: '0',
};

// mooBASED_MIMATIC
export const rateStrategyMOOBASED_MIMATIC: IInterestRateStrategyParams = {
  name: 'rateStrategyMOOBASED_MIMATIC',
  optimalUtilizationRate: new BigNumber(0.45).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: '0',
  variableRateSlope1: '0',
  variableRateSlope2: '0',
  stableRateSlope1: '0',
  stableRateSlope2: '0',
  capacity: '0',
};

