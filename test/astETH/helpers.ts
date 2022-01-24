import hre from 'hardhat';
import ethers from 'ethers';
import { expect } from 'chai';
import BigNumber from 'bignumber.js';

interface ReserveDataInfo {
  availableLiquidity: ethers.BigNumber;
  liquidityIndex: ethers.BigNumber;
}

const ONE_WAD = '1000000000000000000';
export const ONE_RAY = '1000000000000000000000000000';

export function wei(amount: number | string | ethers.BigNumber) {
  if (hre.ethers.BigNumber.isBigNumber(amount)) {
    return amount.toString();
  }
  return new BigNumber(ONE_WAD).multipliedBy(amount).toFixed(0, 1);
}

export function ray(amount: number | string | ethers.BigNumber) {
  if (hre.ethers.BigNumber.isBigNumber(amount)) {
    return amount.toString();
  }
  return new BigNumber(amount).multipliedBy(ONE_RAY).toFixed(0, 1);
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
  return new BigNumber(balance).multipliedBy(1 + rebaseAmount).toFixed(0, 0);
};

export const expectedFlashLoanPremium = (amount: string) => {
  const flashLoanFactor = 9;
  return new BigNumber(amount).multipliedBy(flashLoanFactor).div(10000).toFixed(0, 1);
};

export const expectedBalanceAfterFlashLoan = (
  balanceBeforeFlashLoan: string,
  totalSupply: string,
  flashLoanAmount: string
) => {
  return new BigNumber(balanceBeforeFlashLoan)
    .plus(
      new BigNumber(balanceBeforeFlashLoan).rayMul(
        expectedLiquidityIndexGrowAfterFlashLoan(totalSupply, flashLoanAmount)
      )
    )
    .toString();
};

export const expectedLiquidityIndexAfterFlashLoan = (
  liquidityIndex: string,
  totalSupply: string,
  flashLoanAmount: string
) => {
  const result = expectedLiquidityIndexGrowAfterFlashLoan(totalSupply, flashLoanAmount)
    .plus(new BigNumber(ONE_RAY))
    .rayMul(new BigNumber(liquidityIndex));
  return result.toFixed(0, 1);
};

const expectedLiquidityIndexGrowAfterFlashLoan = (totalSupply: string, flashLoanAmount: string) => {
  const premium = expectedFlashLoanPremium(flashLoanAmount);
  return new BigNumber(premium).wadToRay().rayDiv(new BigNumber(totalSupply).wadToRay());
};
