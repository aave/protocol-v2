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

export function wei(value: TemplateStringsArray) {
  if (!value) {
    return '0';
  }
  const [amountText, unit = 'wei'] = value[0]
    .trim()
    .split(' ')
    .filter((v) => !!v);
  if (!Number.isFinite(+amountText)) {
    throw new Error(`Amount ${amountText} is not a number`);
  }
  const amount = new BigNumber(amountText);

  switch (unit) {
    case 'wei':
      return amount.toFixed(0);
    case 'kwei':
      return amount.multipliedBy(10 ** 3).toFixed(0);
    case 'mwei':
      return amount.multipliedBy(10 ** 6).toFixed(0);
    case 'gwei':
      return amount.multipliedBy(10 ** 9).toFixed(0);
    case 'microether':
      return amount.multipliedBy(10 ** 12).toFixed(0);
    case 'milliether':
      return amount.multipliedBy(10 ** 15).toFixed(0);
    case 'ether':
      return amount.multipliedBy(10 ** 18).toFixed(0);
    default:
      throw new Error(`Unknown unit "${unit}"`);
  }
}

export function toWei(amount: number | string | ethers.BigNumber) {
  if (hre.ethers.BigNumber.isBigNumber(amount)) {
    return amount.toString();
  }
  return new BigNumber(ONE_WAD).multipliedBy(amount).toFixed(0, 1);
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
        expectedLiquidityIndexIncrementAfterFlashLoan(totalSupply, flashLoanAmount)
      )
    )
    .toString();
};

export const expectedLiquidityIndexAfterFlashLoan = (
  liquidityIndex: string,
  totalSupply: string,
  flashLoanAmount: string
) => {
  const result = expectedLiquidityIndexIncrementAfterFlashLoan(totalSupply, flashLoanAmount)
    .plus(new BigNumber(ONE_RAY))
    .rayMul(new BigNumber(liquidityIndex));
  return result.toFixed(0, 1);
};

const expectedLiquidityIndexIncrementAfterFlashLoan = (
  totalSupply: string,
  flashLoanAmount: string
) => {
  const premium = expectedFlashLoanPremium(flashLoanAmount);
  return new BigNumber(premium).wadToRay().rayDiv(new BigNumber(totalSupply).wadToRay());
};
