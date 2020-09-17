import BigNumber from 'bignumber.js';
import {
  ONE_YEAR,
  RAY,
  MAX_UINT_AMOUNT,
  OPTIMAL_UTILIZATION_RATE,
  EXCESS_UTILIZATION_RATE,
  ZERO_ADDRESS,
} from '../../../helpers/constants';
import {IReserveParams, iAavePoolAssets, RateMode} from '../../../helpers/types';
import './math';
import {ReserveData, UserReserveData} from './interfaces';

export const strToBN = (amount: string): BigNumber => new BigNumber(amount);

interface Configuration {
  reservesParams: iAavePoolAssets<IReserveParams>;
}

export const configuration: Configuration = <Configuration>{};

export const calcExpectedUserDataAfterDeposit = (
  amountDeposited: string,
  reserveDataBeforeAction: ReserveData,
  reserveDataAfterAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber,
  txCost: BigNumber
): UserReserveData => {
  const expectedUserData = <UserReserveData>{};

  expectedUserData.currentStableDebt = calcExpectedStableDebtTokenBalance(
    userDataBeforeAction.principalStableDebt,
    userDataBeforeAction.stableBorrowRate,
    userDataBeforeAction.stableRateLastUpdated,
    txTimestamp
  );

  expectedUserData.currentVariableDebt = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  expectedUserData.principalStableDebt = userDataBeforeAction.principalStableDebt;
  expectedUserData.scaledVariableDebt = userDataBeforeAction.scaledVariableDebt;
  expectedUserData.variableBorrowIndex = userDataBeforeAction.variableBorrowIndex;
  expectedUserData.stableBorrowRate = userDataBeforeAction.stableBorrowRate;
  expectedUserData.stableRateLastUpdated = userDataBeforeAction.stableRateLastUpdated;

  expectedUserData.liquidityRate = reserveDataAfterAction.liquidityRate;

  expectedUserData.scaledATokenBalance = calcExpectedScaledATokenBalance(
    userDataBeforeAction,
    reserveDataAfterAction.liquidityIndex,
    new BigNumber(amountDeposited),
    new BigNumber(0)
  );
  expectedUserData.currentATokenBalance = calcExpectedATokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  ).plus(amountDeposited);

  if (userDataBeforeAction.currentATokenBalance.eq(0)) {
    expectedUserData.usageAsCollateralEnabled = true;
  } else {
    expectedUserData.usageAsCollateralEnabled = userDataBeforeAction.usageAsCollateralEnabled;
  }

  expectedUserData.variableBorrowIndex = userDataBeforeAction.variableBorrowIndex;
  expectedUserData.walletBalance = userDataBeforeAction.walletBalance.minus(amountDeposited);

  expectedUserData.currentStableDebt = expectedUserData.principalStableDebt = calcExpectedStableDebtTokenBalance(
    userDataBeforeAction.principalStableDebt,
    userDataBeforeAction.stableBorrowRate,
    userDataBeforeAction.stableRateLastUpdated,
    txTimestamp
  );

  expectedUserData.currentVariableDebt = expectedUserData.principalStableDebt = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  return expectedUserData;
};

export const calcExpectedUserDataAfterWithdraw = (
  amountWithdrawn: string,
  reserveDataBeforeAction: ReserveData,
  reserveDataAfterAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber,
  txCost: BigNumber
): UserReserveData => {
  const expectedUserData = <UserReserveData>{};

  const aTokenBalance = calcExpectedATokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  if (amountWithdrawn == MAX_UINT_AMOUNT) {
    amountWithdrawn = aTokenBalance.toFixed(0);
  }

  expectedUserData.scaledATokenBalance = calcExpectedScaledATokenBalance(
    userDataBeforeAction,
    reserveDataAfterAction.liquidityIndex,
    new BigNumber(0),
    new BigNumber(amountWithdrawn)
  );

  expectedUserData.currentATokenBalance = aTokenBalance.minus(amountWithdrawn);

  expectedUserData.principalStableDebt = userDataBeforeAction.principalStableDebt;
  expectedUserData.scaledVariableDebt = userDataBeforeAction.scaledVariableDebt;

  expectedUserData.currentStableDebt = calcExpectedStableDebtTokenBalance(
    userDataBeforeAction.principalStableDebt,
    userDataBeforeAction.stableBorrowRate,
    userDataBeforeAction.stableRateLastUpdated,
    txTimestamp
  );

  expectedUserData.currentVariableDebt = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  expectedUserData.variableBorrowIndex = userDataBeforeAction.variableBorrowIndex;
  expectedUserData.stableBorrowRate = userDataBeforeAction.stableBorrowRate;
  expectedUserData.stableRateLastUpdated = userDataBeforeAction.stableRateLastUpdated;

  expectedUserData.liquidityRate = reserveDataAfterAction.liquidityRate;

  if (userDataBeforeAction.currentATokenBalance.eq(0)) {
    expectedUserData.usageAsCollateralEnabled = true;
  } else {
    //if the user is withdrawing everything, usageAsCollateralEnabled must be false
    if (expectedUserData.currentATokenBalance.eq(0)) {
      expectedUserData.usageAsCollateralEnabled = false;
    } else {
      expectedUserData.usageAsCollateralEnabled = userDataBeforeAction.usageAsCollateralEnabled;
    }
  }

  expectedUserData.walletBalance = userDataBeforeAction.walletBalance.plus(amountWithdrawn);

  return expectedUserData;
};

export const calcExpectedReserveDataAfterDeposit = (
  amountDeposited: string,
  reserveDataBeforeAction: ReserveData,
  txTimestamp: BigNumber
): ReserveData => {
  const expectedReserveData: ReserveData = <ReserveData>{};

  expectedReserveData.address = reserveDataBeforeAction.address;

  expectedReserveData.totalLiquidity = new BigNumber(reserveDataBeforeAction.totalLiquidity).plus(
    amountDeposited
  );
  expectedReserveData.availableLiquidity = new BigNumber(
    reserveDataBeforeAction.availableLiquidity
  ).plus(amountDeposited);

  expectedReserveData.averageStableBorrowRate = reserveDataBeforeAction.averageStableBorrowRate;
  expectedReserveData.liquidityIndex = calcExpectedLiquidityIndex(
    reserveDataBeforeAction,
    txTimestamp
  );
  expectedReserveData.variableBorrowIndex = calcExpectedVariableBorrowIndex(
    reserveDataBeforeAction,
    txTimestamp
  );

  expectedReserveData.totalStableDebt = calcExpectedTotalStableDebt(
    reserveDataBeforeAction,
    txTimestamp
  );
  expectedReserveData.totalVariableDebt = calcExpectedTotalVariableDebt(
    reserveDataBeforeAction,
    expectedReserveData.variableBorrowIndex
  );

  expectedReserveData.scaledVariableDebt = reserveDataBeforeAction.scaledVariableDebt;
  expectedReserveData.principalStableDebt = reserveDataBeforeAction.principalStableDebt;

  expectedReserveData.utilizationRate = calcExpectedUtilizationRate(
    expectedReserveData.totalStableDebt,
    expectedReserveData.totalVariableDebt,
    expectedReserveData.totalLiquidity
  );
  const rates = calcExpectedInterestRates(
    reserveDataBeforeAction.symbol,
    reserveDataBeforeAction.marketStableRate,
    expectedReserveData.utilizationRate,
    expectedReserveData.totalStableDebt,
    expectedReserveData.totalVariableDebt,
    expectedReserveData.averageStableBorrowRate
  );
  expectedReserveData.liquidityRate = rates[0];
  expectedReserveData.stableBorrowRate = rates[1];
  expectedReserveData.variableBorrowRate = rates[2];

  return expectedReserveData;
};

export const calcExpectedReserveDataAfterWithdraw = (
  amountWithdrawn: string,
  reserveDataBeforeAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber
): ReserveData => {
  const expectedReserveData: ReserveData = <ReserveData>{};

  expectedReserveData.address = reserveDataBeforeAction.address;

  if (amountWithdrawn == MAX_UINT_AMOUNT) {
    amountWithdrawn = calcExpectedATokenBalance(
      reserveDataBeforeAction,
      userDataBeforeAction,
      txTimestamp
    ).toFixed();
  }

  expectedReserveData.totalLiquidity = new BigNumber(reserveDataBeforeAction.totalLiquidity).minus(
    amountWithdrawn
  );
  expectedReserveData.availableLiquidity = new BigNumber(
    reserveDataBeforeAction.availableLiquidity
  ).minus(amountWithdrawn);

  expectedReserveData.principalStableDebt = reserveDataBeforeAction.principalStableDebt;
  expectedReserveData.scaledVariableDebt = reserveDataBeforeAction.scaledVariableDebt;

  expectedReserveData.liquidityIndex = calcExpectedLiquidityIndex(
    reserveDataBeforeAction,
    txTimestamp
  );
  expectedReserveData.variableBorrowIndex = calcExpectedVariableBorrowIndex(
    reserveDataBeforeAction,
    txTimestamp
  );

  expectedReserveData.totalStableDebt = calcExpectedTotalStableDebt(
    reserveDataBeforeAction,
    txTimestamp
  );
  expectedReserveData.totalVariableDebt = calcExpectedTotalVariableDebt(
    reserveDataBeforeAction,
    expectedReserveData.variableBorrowIndex
  );

  expectedReserveData.averageStableBorrowRate = reserveDataBeforeAction.averageStableBorrowRate;

  expectedReserveData.utilizationRate = calcExpectedUtilizationRate(
    expectedReserveData.totalStableDebt,
    expectedReserveData.totalVariableDebt,
    expectedReserveData.totalLiquidity
  );
  const rates = calcExpectedInterestRates(
    reserveDataBeforeAction.symbol,
    reserveDataBeforeAction.marketStableRate,
    expectedReserveData.utilizationRate,
    expectedReserveData.totalStableDebt,
    expectedReserveData.totalVariableDebt,
    expectedReserveData.averageStableBorrowRate
  );
  expectedReserveData.liquidityRate = rates[0];
  expectedReserveData.stableBorrowRate = rates[1];
  expectedReserveData.variableBorrowRate = rates[2];

  return expectedReserveData;
};

export const calcExpectedReserveDataAfterBorrow = (
  amountBorrowed: string,
  borrowRateMode: string,
  reserveDataBeforeAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber
): ReserveData => {
  const expectedReserveData = <ReserveData>{};

  expectedReserveData.address = reserveDataBeforeAction.address;

  const amountBorrowedBN = new BigNumber(amountBorrowed);

  expectedReserveData.liquidityIndex = calcExpectedLiquidityIndex(
    reserveDataBeforeAction,
    txTimestamp
  );

  expectedReserveData.variableBorrowIndex = calcExpectedVariableBorrowIndex(
    reserveDataBeforeAction,
    txTimestamp
  );

  expectedReserveData.availableLiquidity = reserveDataBeforeAction.availableLiquidity.minus(
    amountBorrowedBN
  );

  expectedReserveData.lastUpdateTimestamp = txTimestamp;

  if (borrowRateMode == RateMode.Stable) {
    expectedReserveData.scaledVariableDebt = reserveDataBeforeAction.scaledVariableDebt;

    expectedReserveData.totalVariableDebt = reserveDataBeforeAction.scaledVariableDebt.rayMul(
      expectedReserveData.variableBorrowIndex
    );

    const totalStableDebtUntilTx = calcExpectedTotalStableDebt(
      reserveDataBeforeAction,
      txTimestamp
    );

    expectedReserveData.averageStableBorrowRate = calcExpectedAverageStableBorrowRate(
      reserveDataBeforeAction.averageStableBorrowRate,
      totalStableDebtUntilTx,
      amountBorrowedBN,
      reserveDataBeforeAction.stableBorrowRate
    );

    expectedReserveData.principalStableDebt = totalStableDebtUntilTx.plus(amountBorrowedBN);

    expectedReserveData.totalStableDebt = calcExpectedTotalStableDebt(
      {
        ...reserveDataBeforeAction,
        principalStableDebt: expectedReserveData.principalStableDebt,
        averageStableBorrowRate: expectedReserveData.averageStableBorrowRate,
        lastUpdateTimestamp: txTimestamp,
      },
      currentTimestamp
    );

    expectedReserveData.totalLiquidity = expectedReserveData.availableLiquidity
      .plus(expectedReserveData.totalVariableDebt)
      .plus(expectedReserveData.totalStableDebt);

    expectedReserveData.utilizationRate = calcExpectedUtilizationRate(
      expectedReserveData.totalStableDebt,
      expectedReserveData.totalVariableDebt,
      expectedReserveData.totalLiquidity
    );

    const rates = calcExpectedInterestRates(
      reserveDataBeforeAction.symbol,
      reserveDataBeforeAction.marketStableRate,
      expectedReserveData.utilizationRate,
      expectedReserveData.totalStableDebt,
      expectedReserveData.totalVariableDebt,
      expectedReserveData.averageStableBorrowRate
    );

    expectedReserveData.liquidityRate = rates[0];

    expectedReserveData.stableBorrowRate = rates[1];

    expectedReserveData.variableBorrowRate = rates[2];
  } else {
    expectedReserveData.principalStableDebt = reserveDataBeforeAction.principalStableDebt;

    expectedReserveData.totalStableDebt = calcExpectedStableDebtTokenBalance(
      userDataBeforeAction.principalStableDebt,
      userDataBeforeAction.stableBorrowRate,
      userDataBeforeAction.stableRateLastUpdated,
      currentTimestamp
    );
    expectedReserveData.averageStableBorrowRate = reserveDataBeforeAction.averageStableBorrowRate;

    expectedReserveData.scaledVariableDebt = reserveDataBeforeAction.scaledVariableDebt.plus(
      amountBorrowedBN.rayDiv(expectedReserveData.variableBorrowIndex)
    );
    const totalVariableDebtAfterTx = expectedReserveData.scaledVariableDebt.rayMul(
      expectedReserveData.variableBorrowIndex
    );

    expectedReserveData.utilizationRate = calcExpectedUtilizationRate(
      expectedReserveData.totalStableDebt,
      totalVariableDebtAfterTx,
      expectedReserveData.availableLiquidity
        .plus(expectedReserveData.totalStableDebt)
        .plus(totalVariableDebtAfterTx)
    );

    const rates = calcExpectedInterestRates(
      reserveDataBeforeAction.symbol,
      reserveDataBeforeAction.marketStableRate,
      expectedReserveData.utilizationRate,
      expectedReserveData.totalStableDebt,
      totalVariableDebtAfterTx,
      expectedReserveData.averageStableBorrowRate
    );

    expectedReserveData.liquidityRate = rates[0];

    expectedReserveData.stableBorrowRate = rates[1];

    expectedReserveData.variableBorrowRate = rates[2];

    expectedReserveData.totalVariableDebt = expectedReserveData.scaledVariableDebt.rayMul(
      calcExpectedReserveNormalizedDebt(expectedReserveData, currentTimestamp)
    );
  }

  expectedReserveData.totalLiquidity = expectedReserveData.availableLiquidity
    .plus(expectedReserveData.totalStableDebt)
    .plus(expectedReserveData.totalVariableDebt);

  return expectedReserveData;
};

export const calcExpectedReserveDataAfterRepay = (
  amountRepaid: string,
  borrowRateMode: RateMode,
  reserveDataBeforeAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber
): ReserveData => {
  const expectedReserveData: ReserveData = <ReserveData>{};

  expectedReserveData.address = reserveDataBeforeAction.address;

  let amountRepaidBN = new BigNumber(amountRepaid);

  const userStableDebt = calcExpectedStableDebtTokenBalance(
    userDataBeforeAction.principalStableDebt,
    userDataBeforeAction.stableBorrowRate,
    userDataBeforeAction.stableRateLastUpdated,
    txTimestamp
  );

  const userVariableDebt = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  //if amount repaid = MAX_UINT_AMOUNT, user is repaying everything
  if (amountRepaidBN.abs().eq(MAX_UINT_AMOUNT)) {
    if (borrowRateMode == RateMode.Stable) {
      amountRepaidBN = userStableDebt;
    } else {
      amountRepaidBN = userVariableDebt;
    }
  }

  if (borrowRateMode == RateMode.Stable) {
    const debtAccrued = userStableDebt.minus(userDataBeforeAction.principalStableDebt);

    expectedReserveData.totalLiquidity = reserveDataBeforeAction.totalLiquidity.plus(debtAccrued);

    expectedReserveData.totalStableDebt = reserveDataBeforeAction.totalStableDebt
      .minus(amountRepaidBN)
      .plus(debtAccrued);

    expectedReserveData.averageStableBorrowRate = calcExpectedAverageStableBorrowRate(
      reserveDataBeforeAction.averageStableBorrowRate,
      reserveDataBeforeAction.totalStableDebt.plus(debtAccrued),
      amountRepaidBN.negated(),
      userDataBeforeAction.stableBorrowRate
    );
    expectedReserveData.totalVariableDebt = reserveDataBeforeAction.totalVariableDebt;
  } else {
    const variableDebtBefore = userDataBeforeAction.scaledVariableDebt.rayMul(
      reserveDataBeforeAction.variableBorrowIndex
    );

    const debtAccrued = userVariableDebt.minus(variableDebtBefore);

    expectedReserveData.totalLiquidity = reserveDataBeforeAction.totalLiquidity.plus(debtAccrued);

    expectedReserveData.totalVariableDebt = reserveDataBeforeAction.totalVariableDebt
      .plus(debtAccrued)
      .minus(amountRepaidBN);

    expectedReserveData.totalStableDebt = reserveDataBeforeAction.totalStableDebt;
    expectedReserveData.averageStableBorrowRate = reserveDataBeforeAction.averageStableBorrowRate;
  }

  expectedReserveData.availableLiquidity = reserveDataBeforeAction.availableLiquidity.plus(
    amountRepaidBN
  );

  expectedReserveData.availableLiquidity = reserveDataBeforeAction.availableLiquidity.plus(
    amountRepaidBN
  );

  expectedReserveData.utilizationRate = calcExpectedUtilizationRate(
    expectedReserveData.totalStableDebt,
    expectedReserveData.totalVariableDebt,
    expectedReserveData.totalLiquidity
  );

  const rates = calcExpectedInterestRates(
    reserveDataBeforeAction.symbol,
    reserveDataBeforeAction.marketStableRate,
    expectedReserveData.utilizationRate,
    expectedReserveData.totalStableDebt,
    expectedReserveData.totalVariableDebt,
    expectedReserveData.averageStableBorrowRate
  );
  expectedReserveData.liquidityRate = rates[0];

  expectedReserveData.stableBorrowRate = rates[1];

  expectedReserveData.variableBorrowRate = rates[2];

  expectedReserveData.liquidityIndex = calcExpectedLiquidityIndex(
    reserveDataBeforeAction,
    txTimestamp
  );
  expectedReserveData.variableBorrowIndex = calcExpectedVariableBorrowIndex(
    reserveDataBeforeAction,
    txTimestamp
  );

  expectedReserveData.lastUpdateTimestamp = txTimestamp;

  return expectedReserveData;
};

export const calcExpectedUserDataAfterBorrow = (
  amountBorrowed: string,
  interestRateMode: string,
  reserveDataBeforeAction: ReserveData,
  expectedDataAfterAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber,
  txCost: BigNumber
): UserReserveData => {
  const expectedUserData = <UserReserveData>{};

  const amountBorrowedBN = new BigNumber(amountBorrowed);

  if (interestRateMode == RateMode.Stable) {
    const stableDebtUntilTx = calcExpectedStableDebtTokenBalance(
      userDataBeforeAction.principalStableDebt,
      userDataBeforeAction.stableBorrowRate,
      userDataBeforeAction.stableRateLastUpdated,
      txTimestamp
    );

    expectedUserData.principalStableDebt = stableDebtUntilTx.plus(amountBorrowed);
    expectedUserData.stableRateLastUpdated = txTimestamp;

    expectedUserData.stableBorrowRate = calcExpectedUserStableRate(
      stableDebtUntilTx,
      userDataBeforeAction.stableBorrowRate,
      amountBorrowedBN,
      reserveDataBeforeAction.stableBorrowRate
    );

    console.log("Principal stable debt: ",expectedUserData.principalStableDebt.toFixed() );
    console.log("stable borrow rate: ",expectedUserData.stableBorrowRate.toFixed() );
    
    expectedUserData.currentStableDebt = calcExpectedStableDebtTokenBalance(
      expectedUserData.principalStableDebt,
      expectedUserData.stableBorrowRate,
      txTimestamp,
      currentTimestamp
    );

    console.log("expected stable debt: ", expectedUserData.currentStableDebt);
    
    expectedUserData.scaledVariableDebt = userDataBeforeAction.scaledVariableDebt;
    
    expectedUserData.currentVariableDebt = calcExpectedVariableDebtTokenBalance(
      expectedDataAfterAction,
      expectedUserData,
      currentTimestamp
    );
  } else {
    expectedUserData.scaledVariableDebt = reserveDataBeforeAction.scaledVariableDebt.plus(
      amountBorrowedBN.rayDiv(expectedDataAfterAction.variableBorrowIndex)
    );

    expectedUserData.principalStableDebt = userDataBeforeAction.principalStableDebt;

    expectedUserData.stableBorrowRate = userDataBeforeAction.stableBorrowRate;

    expectedUserData.stableRateLastUpdated = userDataBeforeAction.stableRateLastUpdated;
  }

  expectedUserData.liquidityRate = expectedDataAfterAction.liquidityRate;

  expectedUserData.usageAsCollateralEnabled = userDataBeforeAction.usageAsCollateralEnabled;

  expectedUserData.currentATokenBalance = calcExpectedATokenBalance(
    expectedDataAfterAction,
    userDataBeforeAction,
    currentTimestamp
  );

  expectedUserData.scaledATokenBalance = userDataBeforeAction.scaledATokenBalance;

  expectedUserData.walletBalance = userDataBeforeAction.walletBalance.plus(amountBorrowed);

  return expectedUserData;
};

export const calcExpectedUserDataAfterRepay = (
  totalRepaid: string,
  rateMode: RateMode,
  reserveDataBeforeAction: ReserveData,
  expectedDataAfterAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  user: string,
  onBehalfOf: string,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber,
  txCost: BigNumber
): UserReserveData => {
  const expectedUserData = <UserReserveData>{};

  const variableBorrowBalance = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    currentTimestamp
  );

  const stableBorrowBalance = calcExpectedStableDebtTokenBalance(
    userDataBeforeAction.principalStableDebt,
    userDataBeforeAction.stableBorrowRate,
    userDataBeforeAction.stableRateLastUpdated,
    currentTimestamp
  );

  if (new BigNumber(totalRepaid).abs().eq(MAX_UINT_AMOUNT)) {
    totalRepaid =
      rateMode == RateMode.Stable
        ? stableBorrowBalance.toFixed(0)
        : variableBorrowBalance.toFixed();
  }

  if (rateMode == RateMode.Stable) {
    expectedUserData.principalVariableDebt = userDataBeforeAction.principalVariableDebt;
    expectedUserData.currentVariableDebt = variableBorrowBalance;
    expectedUserData.variableBorrowIndex = userDataBeforeAction.variableBorrowIndex;

    expectedUserData.currentStableDebt = expectedUserData.principalStableDebt = stableBorrowBalance.minus(
      totalRepaid
    );

    if (expectedUserData.currentStableDebt.eq('0')) {
      //user repaid everything
      expectedUserData.stableBorrowRate = expectedUserData.stableRateLastUpdated = new BigNumber(
        '0'
      );
    } else {
      expectedUserData.stableBorrowRate = userDataBeforeAction.stableBorrowRate;
      expectedUserData.stableRateLastUpdated = txTimestamp;
    }
  } else {
    expectedUserData.currentStableDebt = stableBorrowBalance;
    expectedUserData.principalStableDebt = userDataBeforeAction.principalStableDebt;
    expectedUserData.stableBorrowRate = userDataBeforeAction.stableBorrowRate;
    expectedUserData.stableRateLastUpdated = userDataBeforeAction.stableRateLastUpdated;

    expectedUserData.currentVariableDebt = expectedUserData.principalVariableDebt = variableBorrowBalance.minus(
      totalRepaid
    );

    if (expectedUserData.currentVariableDebt.eq('0')) {
      //user repaid everything
      expectedUserData.variableBorrowIndex = new BigNumber('0');
    } else {
      expectedUserData.variableBorrowIndex = expectedDataAfterAction.variableBorrowIndex;
    }
  }

  expectedUserData.liquidityRate = expectedDataAfterAction.liquidityRate;

  expectedUserData.usageAsCollateralEnabled = userDataBeforeAction.usageAsCollateralEnabled;

  expectedUserData.currentATokenBalance = calcExpectedATokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );
  expectedUserData.scaledATokenBalance = userDataBeforeAction.scaledATokenBalance;

  if (user === onBehalfOf) {
    expectedUserData.walletBalance = userDataBeforeAction.walletBalance.minus(totalRepaid);
  } else {
    //wallet balance didn't change
    expectedUserData.walletBalance = userDataBeforeAction.walletBalance;
  }

  return expectedUserData;
};

export const calcExpectedUserDataAfterSetUseAsCollateral = (
  useAsCollateral: boolean,
  reserveDataBeforeAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txCost: BigNumber
): UserReserveData => {
  const expectedUserData = {...userDataBeforeAction};

  expectedUserData.usageAsCollateralEnabled = useAsCollateral;

  return expectedUserData;
};

export const calcExpectedReserveDataAfterSwapRateMode = (
  reserveDataBeforeAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  rateMode: string,
  txTimestamp: BigNumber
): ReserveData => {
  const expectedReserveData: ReserveData = <ReserveData>{};

  expectedReserveData.address = reserveDataBeforeAction.address;

  const variableDebt = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  const stableDebt = calcExpectedStableDebtTokenBalance(
    userDataBeforeAction.principalStableDebt,
    userDataBeforeAction.stableBorrowRate,
    userDataBeforeAction.stableRateLastUpdated,
    txTimestamp
  );

  expectedReserveData.availableLiquidity = reserveDataBeforeAction.availableLiquidity;

  if (rateMode === RateMode.Stable) {
    //swap user stable debt to variable
    const debtAccrued = stableDebt.minus(userDataBeforeAction.principalStableDebt);

    expectedReserveData.totalLiquidity = reserveDataBeforeAction.totalLiquidity.plus(debtAccrued);

    expectedReserveData.averageStableBorrowRate = calcExpectedAverageStableBorrowRate(
      reserveDataBeforeAction.averageStableBorrowRate,
      reserveDataBeforeAction.totalStableDebt.plus(debtAccrued),
      stableDebt.negated(),
      userDataBeforeAction.stableBorrowRate
    );

    expectedReserveData.totalVariableDebt = reserveDataBeforeAction.totalVariableDebt.plus(
      stableDebt
    );

    expectedReserveData.totalStableDebt = reserveDataBeforeAction.totalStableDebt.minus(
      userDataBeforeAction.principalStableDebt
    );
  } else {
    const totalDebtBefore = userDataBeforeAction.scaledVariableDebt.rayMul(
      reserveDataBeforeAction.variableBorrowIndex
    );
    const debtAccrued = variableDebt.minus(totalDebtBefore);

    expectedReserveData.totalLiquidity = reserveDataBeforeAction.totalLiquidity.plus(debtAccrued);

    expectedReserveData.totalVariableDebt = reserveDataBeforeAction.totalVariableDebt;

    expectedReserveData.totalStableDebt = reserveDataBeforeAction.totalStableDebt.plus(
      variableDebt
    );
    expectedReserveData.averageStableBorrowRate = calcExpectedAverageStableBorrowRate(
      reserveDataBeforeAction.averageStableBorrowRate,
      reserveDataBeforeAction.totalStableDebt,
      variableDebt,
      reserveDataBeforeAction.stableBorrowRate
    );
  }

  expectedReserveData.utilizationRate = calcExpectedUtilizationRate(
    expectedReserveData.totalStableDebt,
    expectedReserveData.totalVariableDebt,
    expectedReserveData.totalLiquidity
  );

  const rates = calcExpectedInterestRates(
    reserveDataBeforeAction.symbol,
    reserveDataBeforeAction.marketStableRate,
    expectedReserveData.utilizationRate,
    expectedReserveData.totalStableDebt,
    expectedReserveData.totalVariableDebt,
    expectedReserveData.averageStableBorrowRate
  );
  expectedReserveData.liquidityRate = rates[0];

  expectedReserveData.stableBorrowRate = rates[1];

  expectedReserveData.variableBorrowRate = rates[2];

  expectedReserveData.liquidityIndex = calcExpectedLiquidityIndex(
    reserveDataBeforeAction,
    txTimestamp
  );
  expectedReserveData.variableBorrowIndex = calcExpectedVariableBorrowIndex(
    reserveDataBeforeAction,
    txTimestamp
  );

  return expectedReserveData;
};

export const calcExpectedUserDataAfterSwapRateMode = (
  reserveDataBeforeAction: ReserveData,
  expectedDataAfterAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  rateMode: string,
  txCost: BigNumber,
  txTimestamp: BigNumber
): UserReserveData => {
  const expectedUserData = {...userDataBeforeAction};

  const variableBorrowBalance = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  const stableBorrowBalance = calcExpectedStableDebtTokenBalance(
    userDataBeforeAction.principalStableDebt,
    userDataBeforeAction.stableBorrowRate,
    userDataBeforeAction.stableRateLastUpdated,
    txTimestamp
  );

  expectedUserData.currentATokenBalance = calcExpectedATokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  if (rateMode === RateMode.Stable) {
    // swap to variable
    expectedUserData.currentStableDebt = expectedUserData.principalStableDebt = new BigNumber(0);

    expectedUserData.stableBorrowRate = new BigNumber(0);

    expectedUserData.principalVariableDebt = expectedUserData.currentVariableDebt = userDataBeforeAction.currentVariableDebt.plus(
      stableBorrowBalance
    );
    expectedUserData.variableBorrowIndex = expectedDataAfterAction.variableBorrowIndex;
    expectedUserData.stableRateLastUpdated = new BigNumber(0);
  } else {
    expectedUserData.principalStableDebt = expectedUserData.currentStableDebt = userDataBeforeAction.currentStableDebt.plus(
      variableBorrowBalance
    );

    //weighted average of the previous and the current
    expectedUserData.stableBorrowRate = calcExpectedUserStableRate(
      userDataBeforeAction.principalStableDebt,
      userDataBeforeAction.stableBorrowRate,
      variableBorrowBalance,
      reserveDataBeforeAction.stableBorrowRate
    );

    expectedUserData.stableRateLastUpdated = txTimestamp;

    expectedUserData.currentVariableDebt = expectedUserData.principalVariableDebt = new BigNumber(
      0
    );

    expectedUserData.variableBorrowIndex = new BigNumber(0);
  }

  expectedUserData.liquidityRate = expectedDataAfterAction.liquidityRate;

  return expectedUserData;
};

export const calcExpectedReserveDataAfterStableRateRebalance = (
  reserveDataBeforeAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber
): ReserveData => {
  const expectedReserveData: ReserveData = <ReserveData>{};

  expectedReserveData.address = reserveDataBeforeAction.address;

  const stableBorrowBalance = calcExpectedStableDebtTokenBalance(
    userDataBeforeAction.principalStableDebt,
    userDataBeforeAction.stableBorrowRate,
    userDataBeforeAction.stableRateLastUpdated,
    txTimestamp
  );

  const debtAccrued = stableBorrowBalance.minus(userDataBeforeAction.principalStableDebt);

  expectedReserveData.totalLiquidity = reserveDataBeforeAction.totalLiquidity.plus(debtAccrued);

  expectedReserveData.availableLiquidity = reserveDataBeforeAction.availableLiquidity;

  //removing the stable liquidity at the old rate

  const avgRateBefore = calcExpectedAverageStableBorrowRate(
    reserveDataBeforeAction.averageStableBorrowRate,
    reserveDataBeforeAction.totalStableDebt.plus(debtAccrued),
    stableBorrowBalance.negated(),
    userDataBeforeAction.stableBorrowRate
  );
  // adding it again at the new rate

  expectedReserveData.averageStableBorrowRate = calcExpectedAverageStableBorrowRate(
    avgRateBefore,
    reserveDataBeforeAction.totalStableDebt.minus(userDataBeforeAction.principalStableDebt),
    stableBorrowBalance,
    reserveDataBeforeAction.stableBorrowRate
  );

  expectedReserveData.totalVariableDebt = reserveDataBeforeAction.totalVariableDebt;
  expectedReserveData.totalStableDebt = reserveDataBeforeAction.totalStableDebt.plus(debtAccrued);

  expectedReserveData.utilizationRate = calcExpectedUtilizationRate(
    expectedReserveData.totalStableDebt,
    expectedReserveData.totalVariableDebt,
    expectedReserveData.totalLiquidity
  );

  const rates = calcExpectedInterestRates(
    reserveDataBeforeAction.symbol,
    reserveDataBeforeAction.marketStableRate,
    expectedReserveData.utilizationRate,
    expectedReserveData.totalStableDebt,
    expectedReserveData.totalVariableDebt,
    expectedReserveData.averageStableBorrowRate
  );

  expectedReserveData.liquidityRate = rates[0];

  expectedReserveData.stableBorrowRate = rates[1];

  expectedReserveData.variableBorrowRate = rates[2];

  expectedReserveData.liquidityIndex = calcExpectedLiquidityIndex(
    reserveDataBeforeAction,
    txTimestamp
  );
  expectedReserveData.variableBorrowIndex = calcExpectedVariableBorrowIndex(
    reserveDataBeforeAction,
    txTimestamp
  );

  return expectedReserveData;
};

export const calcExpectedUserDataAfterStableRateRebalance = (
  reserveDataBeforeAction: ReserveData,
  expectedDataAfterAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txCost: BigNumber,
  txTimestamp: BigNumber
): UserReserveData => {
  const expectedUserData = {...userDataBeforeAction};

  expectedUserData.principalVariableDebt = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );
  expectedUserData.currentStableDebt = expectedUserData.principalStableDebt = calcExpectedStableDebtTokenBalance(
    userDataBeforeAction.principalStableDebt,
    userDataBeforeAction.stableBorrowRate,
    userDataBeforeAction.stableRateLastUpdated,
    txTimestamp
  );

  expectedUserData.stableRateLastUpdated = txTimestamp;

  expectedUserData.principalVariableDebt = userDataBeforeAction.principalVariableDebt;

  expectedUserData.stableBorrowRate = reserveDataBeforeAction.stableBorrowRate;

  expectedUserData.liquidityRate = expectedDataAfterAction.liquidityRate;

  expectedUserData.currentATokenBalance = calcExpectedATokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  return expectedUserData;
};

const calcExpectedScaledATokenBalance = (
  userDataBeforeAction: UserReserveData,
  index: BigNumber,
  amountAdded: BigNumber,
  amountTaken: BigNumber
) => {
  return userDataBeforeAction.scaledATokenBalance
    .plus(amountAdded.rayDiv(index))
    .minus(amountTaken.rayDiv(index));
};

export const calcExpectedATokenBalance = (
  reserveData: ReserveData,
  userData: UserReserveData,
  currentTimestamp: BigNumber
) => {
  const index = calcExpectedReserveNormalizedIncome(reserveData, currentTimestamp);

  const {scaledATokenBalance: scaledBalanceBeforeAction} = userData;

  return scaledBalanceBeforeAction.rayMul(index);
};

const calcExpectedAverageStableBorrowRate = (
  avgStableRateBefore: BigNumber,
  totalStableDebtBefore: BigNumber,
  amountChanged: string | BigNumber,
  rate: BigNumber
) => {
  const weightedTotalBorrows = avgStableRateBefore.multipliedBy(totalStableDebtBefore);
  const weightedAmountBorrowed = rate.multipliedBy(amountChanged);
  const totalBorrowedStable = totalStableDebtBefore.plus(new BigNumber(amountChanged));

  if (totalBorrowedStable.eq(0)) return new BigNumber('0');

  return weightedTotalBorrows
    .plus(weightedAmountBorrowed)
    .div(totalBorrowedStable)
    .decimalPlaces(0, BigNumber.ROUND_DOWN);
};

const calcExpectedVariableDebtUserIndex = (
  reserveDataBeforeAction: ReserveData,
  expectedUserBalanceAfterAction: BigNumber,
  currentTimestamp: BigNumber
) => {
  if (expectedUserBalanceAfterAction.eq(0)) {
    return new BigNumber(0);
  }
  return calcExpectedReserveNormalizedDebt(reserveDataBeforeAction, currentTimestamp);
};

export const calcExpectedVariableDebtTokenBalance = (
  reserveData: ReserveData,
  userData: UserReserveData,
  currentTimestamp: BigNumber
) => {
  const normalizedDebt = calcExpectedReserveNormalizedDebt(reserveData, currentTimestamp);

  const {scaledVariableDebt} = userData;

  return scaledVariableDebt.rayMul(normalizedDebt);
};

export const calcExpectedStableDebtTokenBalance = (
  principalStableDebt: BigNumber,
  stableBorrowRate: BigNumber,
  stableRateLastUpdated: BigNumber,
  currentTimestamp: BigNumber
) => {
  if (
    stableBorrowRate.eq(0) ||
    currentTimestamp.eq(stableRateLastUpdated) ||
    stableRateLastUpdated.eq(0)
  ) {
    return principalStableDebt;
  }

  const cumulatedInterest = calcCompoundedInterest(
    stableBorrowRate,
    currentTimestamp,
    stableRateLastUpdated
  );

  return principalStableDebt.rayMul(cumulatedInterest);
};

const calcLinearInterest = (
  rate: BigNumber,
  currentTimestamp: BigNumber,
  lastUpdateTimestamp: BigNumber
) => {
  const timeDifference = currentTimestamp.minus(lastUpdateTimestamp).wadToRay();

  const timeDelta = timeDifference.rayDiv(new BigNumber(ONE_YEAR).wadToRay());

  const cumulatedInterest = rate.rayMul(timeDelta).plus(RAY);

  return cumulatedInterest;
};

const calcCompoundedInterest = (
  rate: BigNumber,
  currentTimestamp: BigNumber,
  lastUpdateTimestamp: BigNumber
) => {
  const timeDifference = currentTimestamp.minus(lastUpdateTimestamp);

  if (timeDifference.eq(0)) {
    return new BigNumber(RAY);
  }

  const expMinusOne = timeDifference.minus(1);
  const expMinusTwo = timeDifference.gt(2) ? timeDifference.minus(2) : 0;

  const ratePerSecond = rate.div(ONE_YEAR);

  const basePowerTwo = ratePerSecond.rayMul(ratePerSecond);
  const basePowerThree = basePowerTwo.rayMul(ratePerSecond);

  const secondTerm = timeDifference.times(expMinusOne).times(basePowerTwo).div(2);
  const thirdTerm = timeDifference
    .times(expMinusOne)
    .times(expMinusTwo)
    .times(basePowerThree)
    .div(6);

  return new BigNumber(RAY)
    .plus(ratePerSecond.times(timeDifference))
    .plus(secondTerm)
    .plus(thirdTerm);
};

const calcExpectedInterestRates = (
  reserveSymbol: string,
  marketStableRate: BigNumber,
  utilizationRate: BigNumber,
  totalStableDebt: BigNumber,
  totalVariableDebt: BigNumber,
  averageStableBorrowRate: BigNumber
): BigNumber[] => {
  const {reservesParams} = configuration;

  const reserveIndex = Object.keys(reservesParams).findIndex((value) => value === reserveSymbol);
  const [, reserveConfiguration] = (Object.entries(reservesParams) as [string, IReserveParams][])[
    reserveIndex
  ];

  let stableBorrowRate: BigNumber = marketStableRate;
  let variableBorrowRate: BigNumber = new BigNumber(reserveConfiguration.baseVariableBorrowRate);

  if (utilizationRate.gt(OPTIMAL_UTILIZATION_RATE)) {
    const excessUtilizationRateRatio = utilizationRate
      .minus(OPTIMAL_UTILIZATION_RATE)
      .rayDiv(EXCESS_UTILIZATION_RATE);

    stableBorrowRate = stableBorrowRate
      .plus(reserveConfiguration.stableRateSlope1)
      .plus(
        new BigNumber(reserveConfiguration.stableRateSlope2).rayMul(excessUtilizationRateRatio)
      );

    variableBorrowRate = variableBorrowRate
      .plus(reserveConfiguration.variableRateSlope1)
      .plus(
        new BigNumber(reserveConfiguration.variableRateSlope2).rayMul(excessUtilizationRateRatio)
      );
  } else {
    stableBorrowRate = stableBorrowRate.plus(
      new BigNumber(reserveConfiguration.stableRateSlope1).rayMul(
        utilizationRate.rayDiv(new BigNumber(OPTIMAL_UTILIZATION_RATE))
      )
    );

    variableBorrowRate = variableBorrowRate.plus(
      utilizationRate
        .rayDiv(OPTIMAL_UTILIZATION_RATE)
        .rayMul(new BigNumber(reserveConfiguration.variableRateSlope1))
    );
  }

  const expectedOverallRate = calcExpectedOverallBorrowRate(
    totalStableDebt,
    totalVariableDebt,
    variableBorrowRate,
    averageStableBorrowRate
  );
  const liquidityRate = expectedOverallRate.rayMul(utilizationRate);

  return [liquidityRate, stableBorrowRate, variableBorrowRate];
};

const calcExpectedOverallBorrowRate = (
  totalStableDebt: BigNumber,
  totalVariableDebt: BigNumber,
  currentVariableBorrowRate: BigNumber,
  currentAverageStableBorrowRate: BigNumber
): BigNumber => {
  const totalBorrows = totalStableDebt.plus(totalVariableDebt);

  if (totalBorrows.eq(0)) return strToBN('0');

  const weightedVariableRate = totalVariableDebt.wadToRay().rayMul(currentVariableBorrowRate);

  const weightedStableRate = totalStableDebt.wadToRay().rayMul(currentAverageStableBorrowRate);

  const overallBorrowRate = weightedVariableRate
    .plus(weightedStableRate)
    .rayDiv(totalBorrows.wadToRay());

  return overallBorrowRate;
};

const calcExpectedUtilizationRate = (
  totalStableDebt: BigNumber,
  totalVariableDebt: BigNumber,
  totalLiquidity: BigNumber
): BigNumber => {
  if (totalStableDebt.eq('0') && totalVariableDebt.eq('0')) {
    return strToBN('0');
  }

  const utilization = totalStableDebt.plus(totalVariableDebt).rayDiv(totalLiquidity);

  return utilization;
};

const calcExpectedReserveNormalizedIncome = (
  reserveData: ReserveData,
  currentTimestamp: BigNumber
) => {
  const {liquidityRate, liquidityIndex, lastUpdateTimestamp} = reserveData;

  //if utilization rate is 0, nothing to compound
  if (liquidityRate.eq('0')) {
    return liquidityIndex;
  }

  const cumulatedInterest = calcLinearInterest(
    liquidityRate,
    currentTimestamp,
    lastUpdateTimestamp
  );

  const income = cumulatedInterest.rayMul(liquidityIndex);

  return income;
};

const calcExpectedReserveNormalizedDebt = (
  reserveData: ReserveData,
  currentTimestamp: BigNumber
) => {
  const {variableBorrowRate, variableBorrowIndex, lastUpdateTimestamp} = reserveData;

  //if utilization rate is 0, nothing to compound
  if (variableBorrowRate.eq('0')) {
    return variableBorrowIndex;
  }

  const cumulatedInterest = calcCompoundedInterest(
    variableBorrowRate,
    currentTimestamp,
    lastUpdateTimestamp
  );

  const debt = cumulatedInterest.rayMul(variableBorrowIndex);

  return debt;
};

const calcExpectedUserStableRate = (
  balanceBefore: BigNumber,
  rateBefore: BigNumber,
  amount: BigNumber,
  rateNew: BigNumber
) => {
  return balanceBefore
    .times(rateBefore)
    .plus(amount.times(rateNew))
    .div(balanceBefore.plus(amount));
};

const calcExpectedLiquidityIndex = (reserveData: ReserveData, timestamp: BigNumber) => {
  //if utilization rate is 0, nothing to compound
  if (reserveData.utilizationRate.eq('0')) {
    return reserveData.liquidityIndex;
  }

  const cumulatedInterest = calcLinearInterest(
    reserveData.liquidityRate,
    timestamp,
    reserveData.lastUpdateTimestamp
  );

  return cumulatedInterest.rayMul(reserveData.liquidityIndex);
};

const calcExpectedVariableBorrowIndex = (reserveData: ReserveData, timestamp: BigNumber) => {
  //if totalVariableDebt is 0, nothing to compound
  if (reserveData.totalVariableDebt.eq('0')) {
    return reserveData.variableBorrowIndex;
  }

  const cumulatedInterest = calcCompoundedInterest(
    reserveData.variableBorrowRate,
    timestamp,
    reserveData.lastUpdateTimestamp
  );

  return cumulatedInterest.rayMul(reserveData.variableBorrowIndex);
};

const calcExpectedTotalStableDebt = (reserveData: ReserveData, timestamp: BigNumber) => {
  const cumulatedInterest = calcCompoundedInterest(
    reserveData.averageStableBorrowRate,
    timestamp,
    reserveData.lastUpdateTimestamp
  );

  return cumulatedInterest.rayMul(reserveData.principalStableDebt);
};

const calcExpectedTotalVariableDebt = (
  reserveData: ReserveData,
  expectedVariableDebtIndex: BigNumber
) => {
  return reserveData.scaledVariableDebt.rayMul(expectedVariableDebtIndex);
};
