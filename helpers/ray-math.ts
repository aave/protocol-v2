import BigNumber from 'bignumber.js';

export type BigNumberValue = string | number | BigNumber;

export const BigNumberZD = BigNumber.clone({
  DECIMAL_PLACES: 0,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
});

export function valueToBigNumber(amount: BigNumberValue): BigNumber {
  return new BigNumber(amount);
}

export function valueToZDBigNumber(amount: BigNumberValue): BigNumber {
  return new BigNumberZD(amount);
}

export const WAD = valueToZDBigNumber(10).pow(18);
export const HALF_WAD = WAD.dividedBy(2);

export const RAY = valueToZDBigNumber(10).pow(27);
export const HALF_RAY = RAY.dividedBy(2);

export const WAD_RAY_RATIO = valueToZDBigNumber(10).pow(9);

export function wadMul(a: BigNumberValue, b: BigNumberValue): BigNumber {
  return HALF_WAD.plus(valueToZDBigNumber(a).multipliedBy(b)).div(WAD);
}

export function wadDiv(a: BigNumberValue, b: BigNumberValue): BigNumber {
  const halfB = valueToZDBigNumber(b).div(2);

  return halfB.plus(valueToZDBigNumber(a).multipliedBy(WAD)).div(b);
}

export function rayMul(a: BigNumberValue, b: BigNumberValue): BigNumber {
  return HALF_RAY.plus(valueToZDBigNumber(a).multipliedBy(b)).div(RAY);
}

export function rayDiv(a: BigNumberValue, b: BigNumberValue): BigNumber {
  const halfB = valueToZDBigNumber(b).div(2);

  return halfB.plus(valueToZDBigNumber(a).multipliedBy(RAY)).div(b);
}

export function rayToWad(a: BigNumberValue): BigNumber {
  const halfRatio = valueToZDBigNumber(WAD_RAY_RATIO).div(2);

  return halfRatio.plus(a).div(WAD_RAY_RATIO);
}

export function wadToRay(a: BigNumberValue): BigNumber {
  return valueToZDBigNumber(a).multipliedBy(WAD_RAY_RATIO).decimalPlaces(0);
}

export function rayPow(a: BigNumberValue, p: BigNumberValue): BigNumber {
  let x = valueToZDBigNumber(a);
  let n = valueToZDBigNumber(p);
  let z = !n.modulo(2).eq(0) ? x : valueToZDBigNumber(RAY);

  for (n = n.div(2); !n.eq(0); n = n.div(2)) {
    x = rayMul(x, x);

    if (!n.modulo(2).eq(0)) {
      z = rayMul(z, x);
    }
  }
  return z;
}

export function rayToDecimal(a: BigNumberValue): BigNumber {
  return valueToZDBigNumber(a).dividedBy(RAY);
}
