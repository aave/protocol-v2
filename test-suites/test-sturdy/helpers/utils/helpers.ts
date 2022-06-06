import { LendingPool } from '../../../../types/LendingPool';
import { ReserveData, UserReserveData } from './interfaces';
import {
  getLendingRateOracle,
  getIErc20Detailed,
  getMintableERC20,
  getAToken,
  getStableDebtToken,
  getVariableDebtToken,
} from '../../../../helpers/contracts-getters';
import { eNetwork, tEthereumAddress } from '../../../../helpers/types';
import BigNumber from 'bignumber.js';
import { getDb, DRE } from '../../../../helpers/misc-utils';
import { SturdyProtocolDataProvider } from '../../../../types/SturdyProtocolDataProvider';
import './math';
import web3 from 'web3';
import { ConfigNames, loadPoolConfig } from '../../../../helpers/configuration';
import { getParamPerNetwork } from '../../../../helpers/contracts-helpers';

export const ETHfromWei = (value) => web3.utils.fromWei(value + '', 'ether');

export const getReserveData = async (
  helper: SturdyProtocolDataProvider,
  reserve: tEthereumAddress
): Promise<ReserveData> => {
  const [reserveData, tokenAddresses, rateOracle, token] = await Promise.all([
    helper.getReserveData(reserve),
    helper.getReserveTokensAddresses(reserve),
    getLendingRateOracle(),
    getIErc20Detailed(reserve),
  ]);

  const stableDebtToken = await getStableDebtToken(tokenAddresses.stableDebtTokenAddress);
  const variableDebtToken = await getVariableDebtToken(tokenAddresses.variableDebtTokenAddress);

  const { 0: principalStableDebt } = await stableDebtToken.getSupplyData();
  const totalStableDebtLastUpdated = await stableDebtToken.getTotalSupplyLastUpdated();

  const scaledVariableDebt = await variableDebtToken.scaledTotalSupply();

  const rate = (await rateOracle.getMarketBorrowRate(reserve)).toString();
  const symbol = await token.symbol();
  const decimals = new BigNumber(await token.decimals());

  const totalLiquidity = new BigNumber(reserveData.availableLiquidity.toString())
    .plus(reserveData.totalStableDebt.toString())
    .plus(reserveData.totalVariableDebt.toString());

  const totalDebt = new BigNumber(reserveData.totalStableDebt.toString()).plus(
    reserveData.totalVariableDebt.toString()
  );

  const utilizationRate = new BigNumber(
    totalLiquidity.eq(0) ? 0 : totalDebt.rayDiv(totalLiquidity)
  );

  return {
    totalLiquidity,
    utilizationRate,
    availableLiquidity: new BigNumber(reserveData.availableLiquidity.toString()),
    totalStableDebt: new BigNumber(reserveData.totalStableDebt.toString()),
    totalVariableDebt: new BigNumber(reserveData.totalVariableDebt.toString()),
    liquidityRate: new BigNumber(reserveData.liquidityRate.toString()),
    variableBorrowRate: new BigNumber(reserveData.variableBorrowRate.toString()),
    stableBorrowRate: new BigNumber(reserveData.stableBorrowRate.toString()),
    averageStableBorrowRate: new BigNumber(reserveData.averageStableBorrowRate.toString()),
    liquidityIndex: new BigNumber(reserveData.liquidityIndex.toString()),
    variableBorrowIndex: new BigNumber(reserveData.variableBorrowIndex.toString()),
    lastUpdateTimestamp: new BigNumber(reserveData.lastUpdateTimestamp),
    totalStableDebtLastUpdated: new BigNumber(totalStableDebtLastUpdated),
    principalStableDebt: new BigNumber(principalStableDebt.toString()),
    scaledVariableDebt: new BigNumber(scaledVariableDebt.toString()),
    address: reserve,
    aTokenAddress: tokenAddresses.aTokenAddress,
    symbol,
    decimals,
    marketStableRate: new BigNumber(rate),
  };
};

export const getUserData = async (
  pool: LendingPool,
  helper: SturdyProtocolDataProvider,
  reserve: string,
  user: tEthereumAddress,
  sender?: tEthereumAddress
): Promise<UserReserveData> => {
  const [userData, scaledATokenBalance] = await Promise.all([
    helper.getUserReserveData(reserve, user),
    getATokenUserData(reserve, user, helper),
  ]);

  const token = await getMintableERC20(reserve);
  const walletBalance = new BigNumber((await token.balanceOf(sender || user)).toString());

  return {
    scaledATokenBalance: new BigNumber(scaledATokenBalance),
    currentATokenBalance: new BigNumber(userData.currentATokenBalance.toString()),
    currentStableDebt: new BigNumber(userData.currentStableDebt.toString()),
    currentVariableDebt: new BigNumber(userData.currentVariableDebt.toString()),
    principalStableDebt: new BigNumber(userData.principalStableDebt.toString()),
    scaledVariableDebt: new BigNumber(userData.scaledVariableDebt.toString()),
    stableBorrowRate: new BigNumber(userData.stableBorrowRate.toString()),
    liquidityRate: new BigNumber(userData.liquidityRate.toString()),
    usageAsCollateralEnabled: userData.usageAsCollateralEnabled,
    stableRateLastUpdated: new BigNumber(userData.stableRateLastUpdated.toString()),
    walletBalance,
  };
};

export const getReserveAddressFromSymbol = async (symbol: string) => {
  const config = loadPoolConfig(ConfigNames.Sturdy);
  const network = <eNetwork>DRE.network.name;
  const reserveAssets = getParamPerNetwork(config.ReserveAssets, network);

  const token = await getMintableERC20(
    reserveAssets[symbol] || (await getDb().get(`${symbol}.${DRE.network.name}`).value()).address
  );

  if (!token) {
    throw `Could not find instance for contract ${symbol}`;
  }
  return token.address;
};

const getATokenUserData = async (
  reserve: string,
  user: string,
  helpersContract: SturdyProtocolDataProvider
) => {
  const aTokenAddress: string = (await helpersContract.getReserveTokensAddresses(reserve))
    .aTokenAddress;

  const aToken = await getAToken(aTokenAddress);

  const scaledBalance = await aToken.scaledBalanceOf(user);
  return scaledBalance.toString();
};

export const printUserAccountData = async (state: any) => {
  console.log(`${state?.user} ${state?.action}: ${state?.amount} ${state?.coin}`);
  console.log(`totalDebtETH: `, ETHfromWei(state?.totalDebtETH.toString()));
  console.log(`availableBorrowsETH: `, ETHfromWei(state?.availableBorrowsETH.toString()));
  console.log(
    `currentLiquidationThreshold: `,
    ETHfromWei(state?.currentLiquidationThreshold.toString())
  );
  console.log('\n\n');
};

export const printDivider = () => {
  console.log('=================================================');
};
