import hre from 'hardhat';
import ethers from 'ethers';
import { expect } from 'chai';
import BigNumber from 'bignumber.js';

interface ReserveDataInfo {
  availableLiquidity: ethers.BigNumber;
  liquidityIndex: ethers.BigNumber;
}

export const ONE_RAY = '1000000000000000000000000000';

export function wei(amount: number | string | ethers.BigNumber) {
  if (hre.ethers.BigNumber.isBigNumber(amount)) {
    return amount.toString();
  }
  return hre.ethers.utils.parseEther(Number(amount).toFixed(4)).toString();
}

export function ray(amount: number | string | ethers.BigNumber) {
  if (hre.ethers.BigNumber.isBigNumber(amount)) {
    return amount.toString();
  }
  return new BigNumber(amount).multipliedBy(ONE_RAY).toFixed(0, 1);
}

export function assertBalance(actual: string, expected: string, epsilon: string = '1') {
  const lowerBound = new BigNumber(expected).minus(epsilon).toString();
  const upperBound = new BigNumber(expected).plus(epsilon).toString();
  expect(actual).to.be.bignumber.gte(lowerBound).lte(upperBound);
}

export const advanceTimeAndBlock = async function (forwardTime: number) {
  const currentBlockNumber = await hre.ethers.provider.getBlockNumber();
  const currentBlock = await hre.ethers.provider.getBlock(currentBlockNumber);

  if (currentBlock === null) {
    /* Workaround for https://github.com/nomiclabs/hardhat/issues/1183
     */
    await hre.ethers.provider.send('evm_increaseTime', [forwardTime]);
    await hre.ethers.provider.send('evm_mine', []);
    //Set the next blocktime back to 15 seconds
    await hre.ethers.provider.send('evm_increaseTime', [15]);
    return;
  }
  const currentTime = currentBlock.timestamp;
  const futureTime = currentTime + forwardTime;
  await hre.ethers.provider.send('evm_setNextBlockTimestamp', [futureTime]);
  await hre.ethers.provider.send('evm_mine', []);
};

export const expectedBalanceAfterRebase = (balance: string, rebaseAmount: number) => {
  return new BigNumber(balance).multipliedBy(1 + rebaseAmount).toFixed(0, 1);
};

export const expectedFlashLoanPremium = (amount: string) => {
  const flashLoanFactor = 9;
  return new BigNumber(amount).multipliedBy(flashLoanFactor).div(10000).toFixed(0, 1);
};

export const expectedBalanceAfterFlashLoan = (
  balanceBeforeFlashLoan: string,
  reserveDataBeforeFlashLoan: ReserveDataInfo,
  flashLoanAmount: string
) => {
  return new BigNumber(balanceBeforeFlashLoan)
    .plus(
      new BigNumber(balanceBeforeFlashLoan).rayMul(
        expectedLiquidityIndexGrowAfterFlashLoan(reserveDataBeforeFlashLoan, flashLoanAmount)
      )
    )
    .toString();
};

export const expectedLiquidityIndexAfterFlashLoan = (
  reserveDataBeforeFlashLoan: ReserveDataInfo,
  flashLoanAmount: string
) => {
  const premium = expectedFlashLoanPremium(flashLoanAmount);
  const amountToLiquidityRatio = new BigNumber(premium)
    .wadToRay()
    .rayDiv(new BigNumber(reserveDataBeforeFlashLoan.availableLiquidity.toString()).wadToRay());
  const result = amountToLiquidityRatio
    .plus(new BigNumber(ONE_RAY))
    .rayMul(new BigNumber(reserveDataBeforeFlashLoan.liquidityIndex.toString()));
  return result.toFixed(0, 1);
};

const expectedLiquidityIndexGrowAfterFlashLoan = (
  reserveDataBeforeFlashLoan: ReserveDataInfo,
  flashLoanAmount: string
) => {
  const premium = expectedFlashLoanPremium(flashLoanAmount);
  return new BigNumber(premium)
    .wadToRay()
    .rayDiv(new BigNumber(reserveDataBeforeFlashLoan.availableLiquidity.toString()).wadToRay());
};
