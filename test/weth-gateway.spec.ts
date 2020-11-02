import {MAX_UINT_AMOUNT} from '../helpers/constants';
import {convertToCurrencyDecimals} from '../helpers/contracts-helpers';
import {makeSuite, TestEnv} from './helpers/make-suite';
import {parseEther} from 'ethers/lib/utils';
import {BRE, waitForTx} from '../helpers/misc-utils';
import {BigNumber} from 'ethers';
import {getStableDebtToken, getVariableDebtToken} from '../helpers/contracts-getters';

const {expect} = require('chai');

makeSuite('Use native ETH at LendingPool via WETHGateway', (testEnv: TestEnv) => {
  const zero = BigNumber.from('0');
  const depositSize = parseEther('5');

  it('Deposit WETH', async () => {
    const {users, wethGateway, aWETH} = testEnv;

    const user = users[1];

    // Deposit with native ETH
    await wethGateway.connect(user.signer).depositETH(user.address, '0', {value: depositSize});

    const aTokensBalance = await aWETH.balanceOf(user.address);

    expect(aTokensBalance).to.be.gt(zero);
    expect(aTokensBalance).to.be.gte(depositSize);
  });

  it('Withdraw WETH - Partial', async () => {
    const {users, wethGateway, aWETH} = testEnv;

    const user = users[1];
    const priorEthersBalance = await user.signer.getBalance();
    const aTokensBalance = await aWETH.balanceOf(user.address);

    expect(aTokensBalance).to.be.gt(zero, 'User should have aTokens.');

    // Partially withdraw native ETH
    const partialWithdraw = await convertToCurrencyDecimals(aWETH.address, '2');

    // Approve the aTokens to Gateway so Gateway can withdraw and convert to Ether
    const approveTx = await aWETH
      .connect(user.signer)
      .approve(wethGateway.address, MAX_UINT_AMOUNT);
    const {gasUsed: approveGas} = await waitForTx(approveTx);

    // Partial Withdraw and send native Ether to user
    const {gasUsed: withdrawGas} = await waitForTx(
      await wethGateway.connect(user.signer).withdrawETH(partialWithdraw, user.address)
    );

    const afterPartialEtherBalance = await user.signer.getBalance();
    const afterPartialATokensBalance = await aWETH.balanceOf(user.address);
    const gasCosts = approveGas.add(withdrawGas).mul(approveTx.gasPrice);

    expect(afterPartialEtherBalance).to.be.equal(
      priorEthersBalance.add(partialWithdraw).sub(gasCosts),
      'User ETHER balance should contain the partial withdraw'
    );
    expect(afterPartialATokensBalance).to.be.equal(
      aTokensBalance.sub(partialWithdraw),
      'User aWETH balance should be substracted'
    );
  });

  it('Withdraw WETH - Full', async () => {
    const {users, aWETH, wethGateway} = testEnv;

    const user = users[1];
    const priorEthersBalance = await user.signer.getBalance();
    const aTokensBalance = await aWETH.balanceOf(user.address);

    expect(aTokensBalance).to.be.gt(zero, 'User should have aTokens.');

    // Approve the aTokens to Gateway so Gateway can withdraw and convert to Ether
    const approveTx = await aWETH
      .connect(user.signer)
      .approve(wethGateway.address, MAX_UINT_AMOUNT);
    const {gasUsed: approveGas} = await waitForTx(approveTx);

    // Full withdraw
    const {gasUsed: withdrawGas} = await waitForTx(
      await wethGateway.connect(user.signer).withdrawETH(MAX_UINT_AMOUNT, user.address)
    );

    const afterFullEtherBalance = await user.signer.getBalance();
    const afterFullATokensBalance = await aWETH.balanceOf(user.address);
    const gasCosts = approveGas.add(withdrawGas).mul(approveTx.gasPrice);

    expect(afterFullEtherBalance).to.be.eq(
      priorEthersBalance.add(aTokensBalance).sub(gasCosts),
      'User ETHER balance should contain the full withdraw'
    );
    expect(afterFullATokensBalance).to.be.eq(0, 'User aWETH balance should be zero');
  });

  it('Borrow stable WETH and Full Repay with ETH', async () => {
    const {users, wethGateway, aWETH, weth, pool, helpersContract} = testEnv;
    const borrowSize = parseEther('1');
    const repaySize = borrowSize.add(borrowSize.mul(5).div(100));
    const user = users[1];

    const {stableDebtTokenAddress} = await helpersContract.getReserveTokensAddresses(weth.address);

    const stableDebtToken = await getStableDebtToken(stableDebtTokenAddress);

    // Deposit with native ETH
    await wethGateway.connect(user.signer).depositETH(user.address, '0', {value: depositSize});

    const aTokensBalance = await aWETH.balanceOf(user.address);

    expect(aTokensBalance).to.be.gt(zero);
    expect(aTokensBalance).to.be.gte(depositSize);

    // Borrow WETH with WETH as collateral
    await waitForTx(
      await pool.connect(user.signer).borrow(weth.address, borrowSize, '1', '0', user.address)
    );

    const debtBalance = await stableDebtToken.balanceOf(user.address);

    expect(debtBalance).to.be.gt(zero);

    // Full Repay WETH with native ETH
    await waitForTx(
      await wethGateway
        .connect(user.signer)
        .repayETH(MAX_UINT_AMOUNT, '1', user.address, {value: repaySize})
    );

    const debtBalanceAfterRepay = await stableDebtToken.balanceOf(user.address);
    expect(debtBalanceAfterRepay).to.be.eq(zero);
  });

  it('Borrow variable WETH and Full Repay with ETH', async () => {
    const {users, wethGateway, aWETH, weth, pool, helpersContract} = testEnv;
    const borrowSize = parseEther('1');
    const repaySize = borrowSize.add(borrowSize.mul(5).div(100));
    const user = users[1];

    const {variableDebtTokenAddress} = await helpersContract.getReserveTokensAddresses(
      weth.address
    );

    const varDebtToken = await getVariableDebtToken(variableDebtTokenAddress);

    // Deposit with native ETH
    await wethGateway.connect(user.signer).depositETH(user.address, '0', {value: depositSize});

    const aTokensBalance = await aWETH.balanceOf(user.address);

    expect(aTokensBalance).to.be.gt(zero);
    expect(aTokensBalance).to.be.gte(depositSize);

    // Borrow WETH with WETH as collateral
    await waitForTx(
      await pool.connect(user.signer).borrow(weth.address, borrowSize, '2', '0', user.address)
    );

    const debtBalance = await varDebtToken.balanceOf(user.address);

    expect(debtBalance).to.be.gt(zero);

    // Partial Repay WETH loan with native ETH
    const partialPayment = repaySize.div(2);
    await waitForTx(
      await wethGateway
        .connect(user.signer)
        .repayETH(partialPayment, '2', user.address, {value: partialPayment})
    );

    const debtBalanceAfterPartialRepay = await varDebtToken.balanceOf(user.address);
    expect(debtBalanceAfterPartialRepay).to.be.lt(debtBalance);

    // Full Repay WETH loan with native ETH
    await waitForTx(
      await wethGateway
        .connect(user.signer)
        .repayETH(MAX_UINT_AMOUNT, '2', user.address, {value: repaySize})
    );
    const debtBalanceAfterFullRepay = await varDebtToken.balanceOf(user.address);
    expect(debtBalanceAfterFullRepay).to.be.eq(zero);
  });
});
