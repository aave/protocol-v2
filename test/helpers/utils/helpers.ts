import {LendingPool} from "../../../types/LendingPool";
import {ReserveData, UserReserveData} from "./interfaces";
import {
  getLendingRateOracle,
  getIErc20Detailed,
  getMintableErc20,
  getAToken,
} from "../../../helpers/contracts-helpers";
import {MOCK_ETH_ADDRESS, ZERO_ADDRESS} from "../../../helpers/constants";
import {tEthereumAddress} from "../../../helpers/types";
import BigNumber from "bignumber.js";
import {getDb, BRE} from "../../../helpers/misc-utils";

export const getReserveData = async (
  pool: LendingPool,
  reserve: tEthereumAddress
): Promise<ReserveData> => {
  const data: any = await pool.getReserveData(reserve);
  const configuration: any = await pool.getReserveConfigurationData(reserve);
  const rateOracle = await getLendingRateOracle();

  const rate = (await rateOracle.getMarketBorrowRate(reserve)).toString();

  const isEthReserve = reserve === MOCK_ETH_ADDRESS;
  let symbol = "ETH";
  let decimals = new BigNumber(18);
  if (!isEthReserve) {
    const token = await getIErc20Detailed(reserve);
    symbol = await token.symbol();
    decimals = new BigNumber(await token.decimals());
  }


  
  const totalLiquidity = new BigNumber(data.availableLiquidity).plus(data.totalBorrowsStable).plus(data.totalBorrowsVariable);

  const utilizationRate = new BigNumber(totalLiquidity.eq(0) ? 0 : new BigNumber(data.totalBorrowsStable).plus(data.totalBorrowsVariable).rayDiv(totalLiquidity))

  return {
    totalLiquidity,
    utilizationRate,
    availableLiquidity: new BigNumber(data.availableLiquidity),
    totalBorrowsStable: new BigNumber(data.totalBorrowsStable),
    totalBorrowsVariable: new BigNumber(data.totalBorrowsVariable),
    liquidityRate: new BigNumber(data.liquidityRate),
    variableBorrowRate: new BigNumber(data.variableBorrowRate),
    stableBorrowRate: new BigNumber(data.stableBorrowRate),
    averageStableBorrowRate: new BigNumber(data.averageStableBorrowRate),
    liquidityIndex: new BigNumber(data.liquidityIndex),
    variableBorrowIndex: new BigNumber(data.variableBorrowIndex),
    lastUpdateTimestamp: new BigNumber(data.lastUpdateTimestamp),
    address: reserve,
    aTokenAddress: configuration.aTokenAddress,
    symbol,
    decimals,
    marketStableRate: new BigNumber(rate),
  };
};

export const getUserData = async (
  pool: LendingPool,
  reserve: string,
  user: string
): Promise<UserReserveData> => {
  const [data, aTokenData] = await Promise.all([
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

  let walletBalance;

  if (reserve === MOCK_ETH_ADDRESS) {
    walletBalance = new BigNumber(
      (await BRE.ethers.provider.getBalance(user)).toString()
    );
  } else {
    const token = await getMintableErc20(reserve);
    walletBalance = new BigNumber((await token.balanceOf(user)).toString());
  }

  const userData: any = data;

  return {
    principalATokenBalance: new BigNumber(principalATokenBalance),
    interestRedirectionAddress,
    redirectionAddressRedirectedBalance: new BigNumber(
      redirectionAddressRedirectedBalance
    ),
    redirectedBalance: new BigNumber(redirectedBalance),
    currentATokenUserIndex: new BigNumber(userIndex),
    currentATokenBalance: new BigNumber(userData.currentATokenBalance),
    currentBorrowBalance: new BigNumber(userData.currentBorrowBalance),
    principalBorrowBalance: new BigNumber(userData.principalBorrowBalance),
    borrowRateMode: userData.borrowRateMode.toString(),
    borrowRate: new BigNumber(userData.borrowRate),
    liquidityRate: new BigNumber(userData.liquidityRate),
    originationFee: new BigNumber(userData.originationFee),
    variableBorrowIndex: new BigNumber(userData.variableBorrowIndex),
    lastUpdateTimestamp: new BigNumber(userData.lastUpdateTimestamp),
    usageAsCollateralEnabled: userData.usageAsCollateralEnabled,
    walletBalance,
  };
};

export const getReserveAddressFromSymbol = async (symbol: string) => {
  if (symbol.toUpperCase() === "ETH") {
    return MOCK_ETH_ADDRESS;
  }

  const token = await getMintableErc20(
    (await getDb().get(`${symbol}.${BRE.network.name}`).value()).address
  );

  if (!token) {
    throw `Could not find instance for contract ${symbol}`;
  }
  return token.address;
};

const getATokenUserData = async (
  reserve: string,
  user: string,
  pool: LendingPool
) => {
  const aTokenAddress: string = (await pool.getReserveConfigurationData(reserve)).aTokenAddress;

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
      ? new BigNumber(
          (
            await aToken.getRedirectedBalance(interestRedirectionAddress)
          ).toString()
        )
      : new BigNumber("0");

  return [
    userIndex.toString(),
    redirectedBalance.toString(),
    principalTokenBalance.toString(),
    redirectionAddressRedirectedBalance.toString(),
    interestRedirectionAddress,
  ];
};
