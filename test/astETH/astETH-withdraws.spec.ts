import hre from 'hardhat';
import { expect } from 'chai';
import { zeroAddress } from 'ethereumjs-util';
import { MAX_UINT_AMOUNT } from '../../helpers/constants';
import { ProtocolErrors } from '../../helpers/types';
import { assertBalance, ONE_RAY, wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Withdraws:', function () {
  it('Withdraw all max uint256: should withdraw correct amount', async () => {
    const { lenderA } = setup.lenders;
    await lenderA.depositStEth(wei(10));
    await withdrawStEthAndValidate(lenderA);
  });
  it('Withdraw all sum: should withdraw correct amount', async () => {
    const { lenderA } = setup.lenders;
    await lenderA.depositStEth(wei(10));
    await withdrawStEthAndValidate(lenderA, wei(10));
  });
  it('Partial withdraw: should withdraw correct amount', async () => {
    const { lenderA } = setup.lenders;
    await lenderA.depositStEth(wei(10));
    await withdrawStEthAndValidate(lenderA, wei(5));
  });
  it('Multiple withdraws: should withdraw correct amount', async () => {
    const { lenderA, lenderB } = setup.lenders;
    await Promise.all([lenderA.depositStEth(wei(10)), lenderB.depositStEth(wei(20))]);
    await withdrawStEthAndValidate(lenderA, wei(5));
    await withdrawStEthAndValidate(lenderB);
  });
  it('Withdraw after rebase: should withdraw correct amount', async () => {
    const { lenderA, lenderB } = setup.lenders;
    await Promise.all([lenderA.depositStEth(wei(10)), lenderB.depositStEth(wei(20))]);
    // positive rebase
    await setup.rebaseStETH(0.1);
    assertBalance(await lenderA.astEthBalance(), wei(11));
    assertBalance(await lenderB.astEthBalance(), wei(22));

    await withdrawStEthAndValidate(lenderA, wei(10));
    await withdrawStEthAndValidate(lenderB);
  });
  it('Withdraw scaled amount is zero: should revert with correct message', async () => {
    const { lenderA } = setup.lenders;
    await lenderA.depositStEth(wei(1));
    // rebase 200%
    await setup.rebaseStETH(2);
    // try to withdraw 1 wei after rebase happened
    // which will be 0 after scaling
    await expect(lenderA.withdrawStEth(1)).to.revertedWith(ProtocolErrors.CT_INVALID_BURN_AMOUNT);
  });
});

async function assertStEthWithdrawEvents(astETH, withdrawer, receiverOfUnderlying, tx, amount) {
  await expect(Promise.resolve(tx))
    .to.emit(astETH, 'Transfer')
    .withArgs(withdrawer.address, zeroAddress(), amount)
    .to.emit(astETH, 'Burn')
    .withArgs(withdrawer.address, receiverOfUnderlying.address, amount, ONE_RAY);
}

export async function withdrawStEthAndValidate(lender, withdrawAmount = MAX_UINT_AMOUNT) {
  const [balanceBefore, totalSupplyBefore] = await Promise.all([
    lender.astEthBalance(),
    lender.astETH.totalSupply(),
  ]);
  const tx = await lender.withdrawStEth(withdrawAmount);
  await assertStEthWithdrawEvents(
    lender.astETH,
    lender,
    lender,
    tx,
    withdrawAmount === MAX_UINT_AMOUNT ? balanceBefore : withdrawAmount
  );

  const expectedBalance =
    withdrawAmount === MAX_UINT_AMOUNT
      ? '0'
      : hre.ethers.BigNumber.from(balanceBefore).sub(withdrawAmount).toString();
  assertBalance(await lender.astEthBalance(), expectedBalance);

  const expectedTotalSupply = hre.ethers.BigNumber.from(totalSupplyBefore)
    .sub(withdrawAmount === MAX_UINT_AMOUNT ? balanceBefore : withdrawAmount)
    .toString();
  await assertBalance(await lender.astETH.totalSupply().then(wei), expectedTotalSupply);
  return tx;
}
