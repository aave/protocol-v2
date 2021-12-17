import BigNumber from 'bignumber.js';
import { eEthereumNetwork } from './types';

// ----------------
// MATH
// ----------------

export const PERCENTAGE_FACTOR = '10000';
export const HALF_PERCENTAGE = '5000';
export const WAD = Math.pow(10, 18).toString();
export const HALF_WAD = new BigNumber(WAD).multipliedBy(0.5).toString();
export const RAY = new BigNumber(10).exponentiatedBy(27).toFixed();
export const HALF_RAY = new BigNumber(RAY).multipliedBy(0.5).toFixed();
export const WAD_RAY_RATIO = Math.pow(10, 9).toString();
export const oneEther = new BigNumber(Math.pow(10, 18));
export const oneUsd = new BigNumber(Math.pow(10, 8));
export const oneRay = new BigNumber(Math.pow(10, 27));
export const MAX_UINT_AMOUNT =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';
export const ONE_YEAR = '31536000';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ONE_ADDRESS = '0x0000000000000000000000000000000000000001';
// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------
export const OPTIMAL_UTILIZATION_RATE = new BigNumber(0.8).times(RAY);
export const EXCESS_UTILIZATION_RATE = new BigNumber(0.2).times(RAY);
export const APPROVAL_AMOUNT_LENDING_POOL = '1000000000000000000000000000';
export const TOKEN_DISTRIBUTOR_PERCENTAGE_BASE = '10000';
export const MOCK_USD_PRICE_IN_WEI = '5848466240000000';
export const USD_ADDRESS = '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96';
export const AAVE_REFERRAL = '0';

export const MOCK_CHAINLINK_AGGREGATORS_PRICES = {
  // Update to USD-based price feeds
  AAVE: oneEther.multipliedBy('0.003620948469').toFixed(),
  BAT: oneEther.multipliedBy('0.00137893825230').toFixed(),
  BUSD: oneEther.multipliedBy('0.00736484').toFixed(),
  DAI: oneEther.multipliedBy('0.00369068412860').toFixed(),
  ENJ: oneEther.multipliedBy('0.00029560').toFixed(),
  KNC: oneEther.multipliedBy('0.001072').toFixed(),
  LINK: oneEther.multipliedBy('0.009955').toFixed(),
  MANA: oneEther.multipliedBy('0.000158').toFixed(),
  MKR: oneEther.multipliedBy('2.508581').toFixed(),
  REN: oneEther.multipliedBy('0.00065133').toFixed(),
  SNX: oneEther.multipliedBy('0.00442616').toFixed(),
  SUSD: oneEther.multipliedBy('0.00364714136416').toFixed(),
  TUSD: oneEther.multipliedBy('0.00364714136416').toFixed(),
  UNI: oneEther.multipliedBy('0.00536479').toFixed(),
  USDC: oneEther.multipliedBy('0.00367714136416').toFixed(),
  USDT: oneEther.multipliedBy('0.00369068412860').toFixed(),
  WETH: oneEther.toFixed(),
  WBTC: oneEther.multipliedBy('47.332685').toFixed(),
  YFI: oneEther.multipliedBy('22.407436').toFixed(),
  ZRX: oneEther.multipliedBy('0.001151').toFixed(),
  UniDAIWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniWBTCWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniAAVEWETH: oneEther.multipliedBy('0.003620948469').toFixed(),
  UniBATWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniDAIUSDC: oneEther.multipliedBy('22.407436').toFixed(),
  UniCRVWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniLINKWETH: oneEther.multipliedBy('0.009955').toFixed(),
  UniMKRWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniRENWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniSNXWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniUNIWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniUSDCWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniWBTCUSDC: oneEther.multipliedBy('22.407436').toFixed(),
  UniYFIWETH: oneEther.multipliedBy('22.407436').toFixed(),
  BptWBTCWETH: oneEther.multipliedBy('22.407436').toFixed(),
  BptBALWETH: oneEther.multipliedBy('22.407436').toFixed(),
  WMATIC: oneEther.multipliedBy('0.003620948469').toFixed(),
  STAKE: oneEther.multipliedBy('0.003620948469').toFixed(),
  xSUSHI: oneEther.multipliedBy('0.00913428586').toFixed(),
  WAVAX: oneEther.multipliedBy('0.006051936629').toFixed(),
  USD: '5848466240000000',
};

export const chainlinkAggregatorProxy = {
  main: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  kovan: '0x9326BFA02ADD2366b30bacB125260Af641031331',
  matic: '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0',
  mumbai: '0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada',
  avalanche: '0x0A77230d17318075983913bC2145DB16C7366156',
  fuji: '0x5498BB86BC934c8D34FDA08E81D444153d0D06aD',
  tenderly: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  'arbitrum-rinkeby': '0x5f0423B1a6935dc5596e7A24d98532b67A0AeFd8',
  arbitrum: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
  rinkeby: '0x8A753747A1Fa494EC906cE90E9f37563A8AF630e',
};

export const chainlinkEthUsdAggregatorProxy = {
  main: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  kovan: '0x9326BFA02ADD2366b30bacB125260Af641031331',
  matic: '0xF9680D99D6C9589e2a93a78A04A279e509205945',
  mumbai: '0x0715A7794a1dc8e42615F059dD6e406A6594651A',
  avalanche: '0x976B3D034E162d8bD72D6b9C989d545b839003b0',
  fuji: '0x86d67c3D38D2bCeE722E601025C25a575021c6EA',
  tenderly: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  'arbitrum-rinkeby': '0x5f0423B1a6935dc5596e7A24d98532b67A0AeFd8',
  arbitrum: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
  rinkeby: '0x8A753747A1Fa494EC906cE90E9f37563A8AF630e',
};
