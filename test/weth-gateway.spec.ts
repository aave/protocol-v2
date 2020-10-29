import BigNumber from 'bignumber.js';
import {MAX_UINT_AMOUNT} from '../helpers/constants';
import {convertToCurrencyDecimals} from '../helpers/contracts-helpers';
import {deposit} from './helpers/actions';
import {makeSuite, TestEnv} from './helpers/make-suite';
import {parseEther} from 'ethers/lib/utils';

const chai = require('chai');
const {expect} = chai;

makeSuite('Use native ETH at LendingPool via WETHGateway', (testEnv: TestEnv) => {
  const zero = new BigNumber('0');
  const depositSize = parseEther('5');

  console.log(depositSize.toString());
  it('Deposit WETH', async () => {
    const {users, weth, wethGateway, aWETH} = testEnv;

    const user = users[1];

    // Deposit with native ETH
    await wethGateway.connect(user.signer).depositETH(user.address, '0', {value: depositSize});

    const aTokensBalance = await aWETH.balanceOf(user.address);

    expect(aTokensBalance.toString()).to.be.bignumber.gt(zero.toString());
    expect(aTokensBalance.toString()).to.be.bignumber.gte(depositSize.toString());
  });

  it('Withdraw WETH', async () => {
    const {users, weth, wethGateway, aWETH} = testEnv;

    const user = users[1];
    const priorEthersBalance = await user.signer.getBalance();
    const aTokensBalance = await aWETH.balanceOf(user.address);

    expect(aTokensBalance.toString()).to.be.bignumber.gt(
      zero.toString(),
      'User should have aTokens.'
    );
    expect(aTokensBalance.toString()).to.be.bignumber.gte(
      depositSize.toString(),
      'User should have the deposited aTokens.'
    );

    // Partially withdraw native ETH
    console.log('prior partial');
    const partialWithdraw = await convertToCurrencyDecimals(weth.address, '2');
    await wethGateway.connect(user.signer).withdrawETH(partialWithdraw.toString());
    console.log('after partial');

    const afterPartialEtherBalance = await user.signer.getBalance();
    expect(afterPartialEtherBalance.toString()).to.be.bignumber.eq(
      priorEthersBalance.add(partialWithdraw).toString(),
      'User ETHER balance should contain the partial withdraw'
    );

    console.log('prior full');
    // Full withdraw
    await wethGateway.connect(user.signer).withdrawETH(MAX_UINT_AMOUNT);
    const afterFullEtherBalance = await user.signer.getBalance();
    expect(afterFullEtherBalance.toString()).to.be.bignumber.gte(
      afterPartialEtherBalance.add('3').toString(),
      'User ETHER balance should contain the full withdraw'
    );
  });

  xit('Borrow and Repay WETH', async () => {});
});
