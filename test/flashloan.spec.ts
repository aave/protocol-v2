import BigNumber from 'bignumber.js';

import {TestEnv, makeSuite} from './helpers/make-suite';
import {APPROVAL_AMOUNT_LENDING_POOL, oneRay} from '../helpers/constants';
import {
  convertToCurrencyDecimals,
  getMockFlashLoanReceiver,
  getContract,
} from '../helpers/contracts-helpers';
import {ethers} from 'ethers';
import {MockFlashLoanReceiver} from '../types/MockFlashLoanReceiver';
import {ProtocolErrors, eContractid} from '../helpers/types';
import {VariableDebtToken} from '../types/VariableDebtToken';
import {StableDebtToken} from '../types/StableDebtToken';

const {expect} = require('chai');

makeSuite('LendingPool FlashLoan function', (testEnv: TestEnv) => {
  let _mockFlashLoanReceiver = {} as MockFlashLoanReceiver;
  const {
    COLLATERAL_BALANCE_IS_0,
    REQUESTED_AMOUNT_TOO_SMALL,
    TRANSFER_AMOUNT_EXCEEDS_BALANCE,
    INVALID_FLASHLOAN_MODE,
    SAFEERC20_LOWLEVEL_CALL,
  } = ProtocolErrors;

  before(async () => {
    _mockFlashLoanReceiver = await getMockFlashLoanReceiver();
  });

  it('Deposits WETH into the reserve', async () => {
    const {pool, weth} = testEnv;
    const amountToDeposit = ethers.utils.parseEther('1');

    await weth.mint(amountToDeposit);

    await weth.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool.deposit(weth.address, amountToDeposit, '0');
  });

  it('Takes WETH flashloan with mode = 0, returns the funds correctly', async () => {
    const {pool, deployer, weth} = testEnv;

    await pool.flashLoan(
      _mockFlashLoanReceiver.address,
      weth.address,
      ethers.utils.parseEther('0.8'),
      0,
      '0x10',
      '0'
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

  it('Takes an ETH flashloan with mode = 0 as big as the available liquidity', async () => {
    const {pool, weth} = testEnv;

    const reserveDataBefore = await pool.getReserveData(weth.address);
    const txResult = await pool.flashLoan(
      _mockFlashLoanReceiver.address,
      weth.address,
      '1000720000000000000',
      0,
      '0x10',
      '0'
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

  it('Takes WETH flashloan, does not return the funds with mode = 0. (revert expected)', async () => {
    const {pool, weth, users} = testEnv;
    const caller = users[1];
    await _mockFlashLoanReceiver.setFailExecutionTransfer(true);

    await expect(
      pool
        .connect(caller.signer)
        .flashLoan(
          _mockFlashLoanReceiver.address,
          weth.address,
          ethers.utils.parseEther('0.8'),
          0,
          '0x10',
          '0'
        )
    ).to.be.revertedWith(TRANSFER_AMOUNT_EXCEEDS_BALANCE);
  });

  it('Takes a WETH flashloan with an invalid mode. (revert expected)', async () => {
    const {pool, weth, users} = testEnv;
    const caller = users[1];
    await _mockFlashLoanReceiver.setFailExecutionTransfer(true);

    await expect(
      pool
        .connect(caller.signer)
        .flashLoan(
          _mockFlashLoanReceiver.address,
          weth.address,
          ethers.utils.parseEther('0.8'),
          4,
          '0x10',
          '0'
        )
    ).to.be.revertedWith(INVALID_FLASHLOAN_MODE);
  });

  it('Caller deposits 1000 DAI as collateral, Takes WETH flashloan with mode = 2, does not return the funds. A variable loan for caller is created', async () => {
    const {dai, pool, weth, users} = testEnv;

    const caller = users[1];

    await dai.connect(caller.signer).mint(await convertToCurrencyDecimals(dai.address, '1000'));

    await dai.connect(caller.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const amountToDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await pool.connect(caller.signer).deposit(dai.address, amountToDeposit, '0');

    await _mockFlashLoanReceiver.setFailExecutionTransfer(true);

    await pool
      .connect(caller.signer)
      .flashLoan(
        _mockFlashLoanReceiver.address,
        weth.address,
        ethers.utils.parseEther('0.8'),
        2,
        '0x10',
        '0'
      );
    const {variableDebtTokenAddress} = await pool.getReserveTokensAddresses(weth.address);

    const wethDebtToken = await getContract<VariableDebtToken>(
      eContractid.VariableDebtToken,
      variableDebtTokenAddress
    );

    const callerDebt = await wethDebtToken.balanceOf(caller.address);

    expect(callerDebt.toString()).to.be.equal('800720000000000000', 'Invalid user debt');
  });

  it('tries to take a very small flashloan, which would result in 0 fees (revert expected)', async () => {
    const {pool, weth} = testEnv;

    await expect(
      pool.flashLoan(
        _mockFlashLoanReceiver.address,
        weth.address,
        '1', //1 wei loan
        2,
        '0x10',
        '0'
      )
    ).to.be.revertedWith(REQUESTED_AMOUNT_TOO_SMALL);
  });

  it('tries to take a flashloan that is bigger than the available liquidity (revert expected)', async () => {
    const {pool, weth} = testEnv;

    await expect(
      pool.flashLoan(
        _mockFlashLoanReceiver.address,
        weth.address,
        '1004415000000000000', //slightly higher than the available liquidity
        2,
        '0x10',
        '0'
      ),
      TRANSFER_AMOUNT_EXCEEDS_BALANCE
    ).to.be.revertedWith(SAFEERC20_LOWLEVEL_CALL);
  });

  it('tries to take a flashloan using a non contract address as receiver (revert expected)', async () => {
    const {pool, deployer, weth} = testEnv;

    await expect(
      pool.flashLoan(deployer.address, weth.address, '1000000000000000000', 2, '0x10', '0')
    ).to.be.reverted;
  });

  it('Deposits USDC into the reserve', async () => {
    const {usdc, pool} = testEnv;

    await usdc.mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    await usdc.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const amountToDeposit = await convertToCurrencyDecimals(usdc.address, '1000');

    await pool.deposit(usdc.address, amountToDeposit, '0');
  });

  it('Takes out a 500 USDC flashloan, returns the funds correctly', async () => {
    const {usdc, pool, deployer: depositor} = testEnv;

    await _mockFlashLoanReceiver.setFailExecutionTransfer(false);

    const flashloanAmount = await convertToCurrencyDecimals(usdc.address, '500');

    await pool.flashLoan(
      _mockFlashLoanReceiver.address,
      usdc.address,
      flashloanAmount,
      0,
      '0x10',
      '0'
    );

    const reserveData = await pool.getReserveData(usdc.address);
    const userData = await pool.getUserReserveData(usdc.address, depositor.address);

    const totalLiquidity = reserveData.availableLiquidity
      .add(reserveData.totalBorrowsStable)
      .add(reserveData.totalBorrowsVariable)
      .toString();
    const currentLiqudityRate = reserveData.liquidityRate.toString();
    const currentLiquidityIndex = reserveData.liquidityIndex.toString();
    const currentUserBalance = userData.currentATokenBalance.toString();

    const expectedLiquidity = await convertToCurrencyDecimals(usdc.address, '1000.450');

    expect(totalLiquidity).to.be.equal(expectedLiquidity, 'Invalid total liquidity');
    expect(currentLiqudityRate).to.be.equal('0', 'Invalid liquidity rate');
    expect(currentLiquidityIndex).to.be.equal(
      new BigNumber('1.00045').multipliedBy(oneRay).toFixed(),
      'Invalid liquidity index'
    );
    expect(currentUserBalance.toString()).to.be.equal(expectedLiquidity, 'Invalid user balance');
  });

  it('Takes out a 500 USDC flashloan with mode = 0, does not return the funds. (revert expected)', async () => {
    const {usdc, pool, users} = testEnv;
    const caller = users[2];

    const flashloanAmount = await convertToCurrencyDecimals(usdc.address, '500');

    await _mockFlashLoanReceiver.setFailExecutionTransfer(true);

    await expect(
      pool
        .connect(caller.signer)
        .flashLoan(_mockFlashLoanReceiver.address, usdc.address, flashloanAmount, 2, '0x10', '0')
    ).to.be.revertedWith(COLLATERAL_BALANCE_IS_0);
  });

  it('Caller deposits 5 WETH as collateral, Takes a USDC flashloan with mode = 2, does not return the funds. A loan for caller is created', async () => {
    const {usdc, pool, weth, users} = testEnv;

    const caller = users[2];

    await weth.connect(caller.signer).mint(await convertToCurrencyDecimals(weth.address, '5'));

    await weth.connect(caller.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const amountToDeposit = await convertToCurrencyDecimals(weth.address, '5');

    await pool.connect(caller.signer).deposit(weth.address, amountToDeposit, '0');

    await _mockFlashLoanReceiver.setFailExecutionTransfer(true);

    const flashloanAmount = await convertToCurrencyDecimals(usdc.address, '500');

    await pool
      .connect(caller.signer)
      .flashLoan(_mockFlashLoanReceiver.address, usdc.address, flashloanAmount, 2, '0x10', '0');
    const {variableDebtTokenAddress} = await pool.getReserveTokensAddresses(usdc.address);

    const usdcDebtToken = await getContract<VariableDebtToken>(
      eContractid.VariableDebtToken,
      variableDebtTokenAddress
    );

    const callerDebt = await usdcDebtToken.balanceOf(caller.address);

    expect(callerDebt.toString()).to.be.equal('500450000', 'Invalid user debt');
  });

  it('Caller deposits 1000 DAI as collateral, Takes a WETH flashloan with mode = 0, does not approve the transfer of the funds', async () => {
    const {dai, pool, weth, users} = testEnv;

    const caller = users[3];

    await dai.connect(caller.signer).mint(await convertToCurrencyDecimals(dai.address, '1000'));

    await dai.connect(caller.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const amountToDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await pool.connect(caller.signer).deposit(dai.address, amountToDeposit, '0');

    const flashAmount = ethers.utils.parseEther('0.8');

    await _mockFlashLoanReceiver.setFailExecutionTransfer(false);
    await _mockFlashLoanReceiver.setAmountToApprove(flashAmount.div(2));

    await expect(
      pool
        .connect(caller.signer)
        .flashLoan(_mockFlashLoanReceiver.address, weth.address, flashAmount, 0, '0x10', '0')
    ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
  });

  it('Caller takes a WETH flashloan with mode = 1', async () => {
    const {dai, pool, weth, users} = testEnv;

    const caller = users[3];

    const flashAmount = ethers.utils.parseEther('0.8');

    await _mockFlashLoanReceiver.setFailExecutionTransfer(true);

    await pool
      .connect(caller.signer)
      .flashLoan(_mockFlashLoanReceiver.address, weth.address, flashAmount, 1, '0x10', '0');

    const {stableDebtTokenAddress} = await pool.getReserveTokensAddresses(weth.address);

    const wethDebtToken = await getContract<StableDebtToken>(
      eContractid.VariableDebtToken,
      stableDebtTokenAddress
    );

    const callerDebt = await wethDebtToken.balanceOf(caller.address);

    expect(callerDebt.toString()).to.be.equal('800720000000000000', 'Invalid user debt');
  });
});
