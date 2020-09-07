import {makeSuite, TestEnv} from './helpers/make-suite';
import {MockSwapAdapter} from '../types/MockSwapAdapter';
import {getMockSwapAdapter} from '../helpers/contracts-helpers';
import {ProtocolErrors} from '../helpers/types';
import {ethers} from 'ethers';
import {APPROVAL_AMOUNT_LENDING_POOL} from '../helpers/constants';

const {expect} = require('chai');

makeSuite('LendingPool CollateralSwap function', (testEnv: TestEnv) => {
  let _mockSwapAdapter = {} as MockSwapAdapter;
  const {HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD} = ProtocolErrors;

  before(async () => {
    _mockSwapAdapter = await getMockSwapAdapter();
  });

  it('Deposits WETH into the reserve', async () => {
    const {pool, weth, users} = testEnv;
    const amountToDeposit = ethers.utils.parseEther('1');

    for (const signer of [weth.signer, users[2].signer]) {
      const connectedWETH = weth.connect(signer);
      await connectedWETH.mint(amountToDeposit);
      await connectedWETH.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
      await pool.connect(signer).deposit(weth.address, amountToDeposit, '0');
    }
  });
  it('User tries to swap more then he can', async () => {
    const {pool, weth, dai} = testEnv;
    await expect(
      pool.collateralSwap(
        _mockSwapAdapter.address,
        weth.address,
        dai.address,
        ethers.utils.parseEther('1.1'),
        '0x10'
      )
    ).to.be.revertedWith('ERC20: burn amount exceeds balance');
  });

  it('User tries to swap more then available on the reserve', async () => {
    const {pool, weth, dai, users, aEth} = testEnv;

    await pool.borrow(weth.address, ethers.utils.parseEther('0.1'), 1, 0);
    await pool.connect(users[2].signer).withdraw(weth.address, ethers.utils.parseEther('1'));

    await expect(
      pool.collateralSwap(
        _mockSwapAdapter.address,
        weth.address,
        dai.address,
        ethers.utils.parseEther('1'),
        '0x10'
      )
    ).to.be.revertedWith('SafeMath: subtraction overflow');
    await weth.mint(ethers.utils.parseEther('0.1'));
    await pool.repay(
      weth.address,
      ethers.utils.parseEther('0.2'),
      1,
      await pool.signer.getAddress()
    );
  });

  it('User tries to swap correct amount', async () => {
    const {pool, weth, dai, aEth, aDai} = testEnv;
    const userAddress = await pool.signer.getAddress();
    const amountToSwap = ethers.utils.parseEther('0.25');

    const amountToReturn = ethers.utils.parseEther('0.5');
    await _mockSwapAdapter.setAmountToReturn(amountToReturn);

    const reserveBalanceWETHBefore = await weth.balanceOf(aEth.address);
    const reserveBalanceDAIBefore = await dai.balanceOf(aDai.address);

    const userATokenBalanceWETHBefore = await aEth.balanceOf(userAddress);
    const userATokenBalanceDAIBefore = await aDai.balanceOf(userAddress);

    await pool.collateralSwap(
      _mockSwapAdapter.address,
      weth.address,
      dai.address,
      amountToSwap,
      '0x10'
    );
    const userATokenBalanceWETHAfter = await aEth.balanceOf(userAddress);
    const userATokenBalanceDAIAfter = await aDai.balanceOf(userAddress);

    const reserveBalanceWETHAfter = await weth.balanceOf(aEth.address);
    const reserveBalanceDAIAfter = await dai.balanceOf(aDai.address);

    expect(userATokenBalanceWETHAfter.toString()).to.be.equal(
      userATokenBalanceWETHBefore.sub(amountToSwap).toString(),
      'was burned incorrect amount of user funds'
    );
    expect(userATokenBalanceDAIAfter.toString()).to.be.equal(
      userATokenBalanceDAIBefore.add(amountToReturn).toString(),
      'was minted incorrect amount of user funds'
    );

    expect(reserveBalanceWETHAfter.toString()).to.be.equal(
      reserveBalanceWETHBefore.sub(amountToSwap).toString(),
      'was sent incorrect amount if reserve funds'
    );
    expect(reserveBalanceDAIAfter.toString()).to.be.equal(
      reserveBalanceDAIBefore.add(amountToReturn).toString(),
      'was received incorrect amount if reserve funds'
    );
  });
});
