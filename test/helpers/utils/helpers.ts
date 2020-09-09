import {LendingPool} from '../../../types/LendingPool';
import {ReserveData, UserReserveData} from './interfaces';
import {
  getLendingRateOracle,
  getIErc20Detailed,
  getMintableErc20,
  getAToken,
} from '../../../helpers/contracts-helpers';
import {ZERO_ADDRESS} from '../../../helpers/constants';
import {tEthereumAddress} from '../../../helpers/types';
import BigNumber from 'bignumber.js';
import {getDb, BRE} from '../../../helpers/misc-utils';

export const getReserveData = async (
  pool: LendingPool,
  reserve: tEthereumAddress
): Promise<ReserveData> => {
  const data = await pool.getReserveData(reserve);
  const tokenAddresses = await pool.getReserveTokensAddresses(reserve);
  const rateOracle = await getLendingRateOracle();

  const rate = (await rateOracle.getMarketBorrowRate(reserve)).toString();

  const token = await getIErc20Detailed(reserve);
  const symbol = await token.symbol();
  const decimals = new BigNumber(await token.decimals());

  const totalLiquidity = new BigNumber(data.availableLiquidity.toString())
    .plus(data.totalBorrowsStable.toString())
    .plus(data.totalBorrowsVariable.toString());

  const utilizationRate = new BigNumber(
    totalLiquidity.eq(0)
      ? 0
      : new BigNumber(data.totalBorrowsStable.toString())
          .plus(data.totalBorrowsVariable.toString())
          .rayDiv(totalLiquidity)
  );

  return {
    totalLiquidity,
    utilizationRate,
    availableLiquidity: new BigNumber(data.availableLiquidity.toString()),
    totalBorrowsStable: new BigNumber(data.totalBorrowsStable.toString()),
    totalBorrowsVariable: new BigNumber(data.totalBorrowsVariable.toString()),
    liquidityRate: new BigNumber(data.liquidityRate.toString()),
    variableBorrowRate: new BigNumber(data.variableBorrowRate.toString()),
    stableBorrowRate: new BigNumber(data.stableBorrowRate.toString()),
    averageStableBorrowRate: new BigNumber(data.averageStableBorrowRate.toString()),
    liquidityIndex: new BigNumber(data.liquidityIndex.toString()),
    variableBorrowIndex: new BigNumber(data.variableBorrowIndex.toString()),
    lastUpdateTimestamp: new BigNumber(data.lastUpdateTimestamp),
    address: reserve,
    aTokenAddress: tokenAddresses.aTokenAddress,
    symbol,
    decimals,
    marketStableRate: new BigNumber(rate),
  };
};

export const getUserData = async (
  pool: LendingPool,
  reserve: string,
  user: tEthereumAddress,
  sender?: tEthereumAddress
): Promise<UserReserveData> => {
  const [userData, aTokenData] = await Promise.all([
    pool.getUserReserveData(reserve, user),
    getATokenUserData(reserve, user, pool),
  ]);

  const [
    userIndex,
    redirectedBalance,
    principalATokenBalance,
    redirectionAddressRedirectedBalance,
    interestRedirectionAddress,
  ] = aTokenData;

  const token = await getMintableErc20(reserve);
  const walletBalance = new BigNumber((await token.balanceOf(sender || user)).toString());

  return {
    principalATokenBalance: new BigNumber(principalATokenBalance),
    interestRedirectionAddress,
    redirectionAddressRedirectedBalance: new BigNumber(redirectionAddressRedirectedBalance),
    redirectedBalance: new BigNumber(redirectedBalance),
    currentATokenUserIndex: new BigNumber(userIndex),
    currentATokenBalance: new BigNumber(userData.currentATokenBalance.toString()),
    currentStableDebt: new BigNumber(userData.currentStableDebt.toString()),
    currentVariableDebt: new BigNumber(userData.currentVariableDebt.toString()),
    principalStableDebt: new BigNumber(userData.principalStableDebt.toString()),
    principalVariableDebt: new BigNumber(userData.principalVariableDebt.toString()),
    variableBorrowIndex: new BigNumber(userData.variableBorrowIndex.toString()),
    stableBorrowRate: new BigNumber(userData.stableBorrowRate.toString()),
    liquidityRate: new BigNumber(userData.liquidityRate.toString()),
    usageAsCollateralEnabled: userData.usageAsCollateralEnabled,
    stableRateLastUpdated: new BigNumber(userData.stableRateLastUpdated.toString()),
    walletBalance,
  };
};

export const getReserveAddressFromSymbol = async (symbol: string) => {
  const token = await getMintableErc20(
    (await getDb().get(`${symbol}.${BRE.network.name}`).value()).address
  );

  if (!token) {
    throw `Could not find instance for contract ${symbol}`;
  }
  return token.address;
};

const getATokenUserData = async (reserve: string, user: string, pool: LendingPool) => {
  const aTokenAddress: string = (await pool.getReserveTokensAddresses(reserve)).aTokenAddress;

  const aToken = await getAToken(aTokenAddress);
  const [
    userIndex,
    interestRedirectionAddress,
    redirectedBalance,
    principalTokenBalance,
  ] = await Promise.all([
    aToken.getUserIndex(user),
    aToken.getInterestRedirectionAddress(user),
    aToken.getRedirectedBalance(user),
    aToken.principalBalanceOf(user),
  ]);

  const redirectionAddressRedirectedBalance =
    interestRedirectionAddress !== ZERO_ADDRESS
      ? new BigNumber((await aToken.getRedirectedBalance(interestRedirectionAddress)).toString())
      : new BigNumber('0');

  return [
    userIndex.toString(),
    redirectedBalance.toString(),
    principalTokenBalance.toString(),
    redirectionAddressRedirectedBalance.toString(),
    interestRedirectionAddress,
  ];
};
