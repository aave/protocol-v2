import {TestEnv, makeSuite} from './helpers/make-suite';
import {APPROVAL_AMOUNT_LENDING_POOL, oneRay} from '../helpers/constants';
import {convertToCurrencyDecimals, getMockFlashLoanReceiver} from '../helpers/contracts-helpers';
import {ethers} from 'ethers';
import {MockFlashLoanReceiver} from '../types/MockFlashLoanReceiver';
import {ProtocolErrors} from '../helpers/types';
import BigNumber from 'bignumber.js';

const {expect} = require('chai');

makeSuite('LendingPool FlashLoan function', (testEnv: TestEnv) => {
  let _mockFlashLoanReceiver = {} as MockFlashLoanReceiver;
  const {
    INCONSISTENT_PROTOCOL_ACTUAL_BALANCE,
    REQUESTED_AMOUNT_TO_SMALL,
    NOT_ENOUGH_LIQUIDITY_TO_BORROW,
  } = ProtocolErrors;

  before(async () => {
    _mockFlashLoanReceiver = await getMockFlashLoanReceiver();
  });

  it('Deposits ETH into the reserve', async () => {
    const {pool, weth} = testEnv;
    const amountToDeposit = ethers.utils.parseEther('1');

    await weth.mint(amountToDeposit);

    await weth.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool.deposit(weth.address, amountToDeposit, '0');
  });

  it('Takes ETH flashloan, returns the funds correctly', async () => {
    const {pool, deployer, weth} = testEnv;

    await pool.flashLoan(
      _mockFlashLoanReceiver.address,
      weth.address,
      ethers.utils.parseEther('0.8'),
      '0x10'
    );

    ethers.utils.parseUnits('10000');

    const reserveData = await pool.getReserveData(weth.address);

    const currentLiquidityRate = reserveData.liquidityRate;
    const currentLiquidityIndex = reserveData.liquidityIndex;

    const totalLiquidity = new BigNumber(reserveData.availableLiquidity.toString())
      .plus(reserveData.totalBorrowsStable.toString())
      .plus(reserveData.totalBorrowsVariable.toString());

    expect(totalLiquidity.toString()).to.be.equal('1000720000000000000');
    expect(currentLiquidityRate.toString()).to.be.equal('0');
    expect(currentLiquidityIndex.toString()).to.be.equal('1000720000000000000000000000');
  });

  it('Takes an ETH flashloan as big as the available liquidity', async () => {
    const {pool, weth} = testEnv;

    const reserveDataBefore = await pool.getReserveData(weth.address);

    console.log('Total liquidity is ', reserveDataBefore.availableLiquidity.toString());

    const txResult = await pool.flashLoan(
      _mockFlashLoanReceiver.address,
      weth.address,
      '1000720000000000000',
      '0x10'
    );

    const reserveData = await pool.getReserveData(weth.address);

    const currentLiqudityRate = reserveData.liquidityRate;
    const currentLiquidityIndex = reserveData.liquidityIndex;

    const totalLiquidity = new BigNumber(reserveData.availableLiquidity.toString())
      .plus(reserveData.totalBorrowsStable.toString())
      .plus(reserveData.totalBorrowsVariable.toString());

    expect(totalLiquidity.toString()).to.be.equal('1001620648000000000');
    expect(currentLiqudityRate.toString()).to.be.equal('0');
    expect(currentLiquidityIndex.toString()).to.be.equal('1001620648000000000000000000');
  });

  it('Takes WETH flashloan, does not return the funds (revert expected)', async () => {
    const {pool, deployer, weth} = testEnv;

    // move funds to the MockFlashLoanReceiver contract to pay the fee

    await _mockFlashLoanReceiver.setFailExecutionTransfer(true);

    await expect(
      pool.flashLoan(
        _mockFlashLoanReceiver.address,
        weth.address,
        ethers.utils.parseEther('0.8'),
        '0x10'
      )
    ).to.be.revertedWith(INCONSISTENT_PROTOCOL_ACTUAL_BALANCE);
  });

  it('tries to take a very small flashloan, which would result in 0 fees (revert expected)', async () => {
    const {pool, weth} = testEnv;

    await expect(
      pool.flashLoan(
        _mockFlashLoanReceiver.address,
        weth.address,
        '1', //1 wei loan
        '0x10'
      )
    ).to.be.revertedWith(REQUESTED_AMOUNT_TO_SMALL);
  });

  it('tries to take a flashloan that is bigger than the available liquidity (revert expected)', async () => {
    const {pool, weth} = testEnv;

    await expect(
      pool.flashLoan(
        _mockFlashLoanReceiver.address,
        weth.address,
        '1004415000000000000', //slightly higher than the available liquidity
        '0x10'
      ),
      NOT_ENOUGH_LIQUIDITY_TO_BORROW
    ).to.be.revertedWith(NOT_ENOUGH_LIQUIDITY_TO_BORROW);
  });

  it('tries to take a flashloan using a non contract address as receiver (revert expected)', async () => {
    const {pool, deployer, weth} = testEnv;

    await expect(pool.flashLoan(deployer.address, weth.address, '1000000000000000000', '0x10')).to
      .be.reverted;
  });

  it('Deposits DAI into the reserve', async () => {
    const {dai, pool} = testEnv;

    await dai.mint(await convertToCurrencyDecimals(dai.address, '1000'));

    await dai.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const amountToDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await pool.deposit(dai.address, amountToDeposit, '0');
  });

  it('Takes out a 500 DAI flashloan, returns the funds correctly', async () => {
    const {dai, pool, deployer: depositor} = testEnv;

    await _mockFlashLoanReceiver.setFailExecutionTransfer(false);

    await pool.flashLoan(
      _mockFlashLoanReceiver.address,
      dai.address,
      ethers.utils.parseEther('500'),
      '0x10'
    );

    const reserveData = await pool.getReserveData(dai.address);
    const userData = await pool.getUserReserveData(dai.address, depositor.address);

    const totalLiquidity = reserveData.availableLiquidity
      .add(reserveData.totalBorrowsStable)
      .add(reserveData.totalBorrowsVariable)
      .toString();
    const currentLiqudityRate = reserveData.liquidityRate.toString();
    const currentLiquidityIndex = reserveData.liquidityIndex.toString();
    const currentUserBalance = userData.currentATokenBalance.toString();

    const expectedLiquidity = ethers.utils.parseEther('1000.450');

    expect(totalLiquidity).to.be.equal(expectedLiquidity, 'Invalid total liquidity');
    expect(currentLiqudityRate).to.be.equal('0', 'Invalid liquidity rate');
    expect(currentLiquidityIndex).to.be.equal(
      new BigNumber('1.00045').multipliedBy(oneRay).toFixed(),
      'Invalid liquidity index'
    );
    expect(currentUserBalance.toString()).to.be.equal(expectedLiquidity, 'Invalid user balance');
  });

  it('Takes out a 500 DAI flashloan, does not return the funds (revert expected)', async () => {
    const {dai, pool} = testEnv;

    await _mockFlashLoanReceiver.setFailExecutionTransfer(true);

    await expect(
      pool.flashLoan(
        _mockFlashLoanReceiver.address,
        dai.address,
        ethers.utils.parseEther('500'),
        '0x10'
      ),
      INCONSISTENT_PROTOCOL_ACTUAL_BALANCE
    ).to.be.revertedWith(INCONSISTENT_PROTOCOL_ACTUAL_BALANCE);
  });
});
