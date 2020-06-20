import {TestEnv, makeSuite} from './helpers/make-suite';
import {MOCK_ETH_ADDRESS, APPROVAL_AMOUNT_LENDING_POOL, oneRay} from '../helpers/constants';
import {
  convertToCurrencyDecimals,
  getMockFlashLoanReceiver,
  getTokenDistributor,
} from '../helpers/contracts-helpers';
import {ethers} from 'ethers';
import {MockFlashLoanReceiver} from '../types/MockFlashLoanReceiver';
import {TokenDistributor} from '../types/TokenDistributor';
import {BRE} from '../helpers/misc-utils';
import {ProtocolErrors} from '../helpers/types';
import BigNumber from 'bignumber.js';

const {expect} = require('chai');

makeSuite('LendingPool FlashLoan function', (testEnv: TestEnv) => {
  let _mockFlashLoanReceiver = {} as MockFlashLoanReceiver;
  let _tokenDistributor = {} as TokenDistributor;
  const {
    INCONSISTENT_PROTOCOL_BALANCE,
    TOO_SMALL_FLASH_LOAN,
    NOT_ENOUGH_LIQUIDITY_TO_BORROW,
  } = ProtocolErrors;

  before(async () => {
    _mockFlashLoanReceiver = await getMockFlashLoanReceiver();
    _tokenDistributor = await getTokenDistributor();
  });

  it('Deposits ETH into the reserve', async () => {
    const {pool} = testEnv;
    const amountToDeposit = ethers.utils.parseEther('1');

    await pool.deposit(MOCK_ETH_ADDRESS, amountToDeposit, '0', {
      value: amountToDeposit,
    });
  });

  it('Takes ETH flashloan, returns the funds correctly', async () => {
    const {pool, deployer} = testEnv;

    // move funds to the MockFlashLoanReceiver contract to pay the fee
    await deployer.signer.sendTransaction({
      value: ethers.utils.parseEther('0.5'),
      to: _mockFlashLoanReceiver.address,
    });

    await pool.flashLoan(
      _mockFlashLoanReceiver.address,
      MOCK_ETH_ADDRESS,
      ethers.utils.parseEther('0.8'),
      '0x10'
    );

    ethers.utils.parseUnits('10000');

    const reserveData: any = await pool.getReserveData(MOCK_ETH_ADDRESS);
    const tokenDistributorBalance = await BRE.ethers.provider.getBalance(_tokenDistributor.address);

    const currentLiquidityRate = reserveData.liquidityRate;
    const currentLiquidityIndex = reserveData.liquidityIndex;

    expect(reserveData.totalLiquidity).to.be.bignumber.equal('1000504000000000000');
    expect(currentLiquidityRate).to.be.bignumber.equal('0');
    expect(currentLiquidityIndex).to.be.bignumber.equal('1000504000000000000000000000');
    expect(tokenDistributorBalance).to.be.bignumber.equal('216000000000000');
  });

  it('Takes an ETH flashloan as big as the available liquidity', async () => {
    const {pool, deployer} = testEnv;

    // move funds to the MockFlashLoanReceiver contract to pay the fee
    await deployer.signer.sendTransaction({
      value: ethers.utils.parseEther('0.5'),
      to: _mockFlashLoanReceiver.address,
    });

    const txResult = await pool.flashLoan(
      _mockFlashLoanReceiver.address,
      MOCK_ETH_ADDRESS,
      '1000504000000000000',
      '0x10'
    );

    const reserveData: any = await pool.getReserveData(MOCK_ETH_ADDRESS);
    const tokenDistributorBalance = await BRE.ethers.provider.getBalance(_tokenDistributor.address);

    const currentLiqudityRate = reserveData.liquidityRate;
    const currentLiquidityIndex = reserveData.liquidityIndex;

    expect(reserveData.totalLiquidity).to.be.bignumber.equal('1001134317520000000');
    expect(currentLiqudityRate).to.be.bignumber.equal('0');
    expect(currentLiquidityIndex).to.be.bignumber.equal('1001134317520000000000000000');
    expect(tokenDistributorBalance).to.be.bignumber.equal('486136080000000');
  });

  it('Takes ETH flashloan, does not return the funds (revert expected)', async () => {
    const {pool, deployer} = testEnv;

    // move funds to the MockFlashLoanReceiver contract to pay the fee
    await deployer.signer.sendTransaction({
      value: ethers.utils.parseEther('0.5'),
      to: _mockFlashLoanReceiver.address,
    });

    await _mockFlashLoanReceiver.setFailExecutionTransfer(true);

    await expect(
      pool.flashLoan(
        _mockFlashLoanReceiver.address,
        MOCK_ETH_ADDRESS,
        ethers.utils.parseEther('0.8'),
        '0x10'
      ),
      INCONSISTENT_PROTOCOL_BALANCE
    ).to.be.revertedWith(INCONSISTENT_PROTOCOL_BALANCE);
  });

  it('tries to take a very small flashloan, which would result in 0 fees (revert expected)', async () => {
    const {pool} = testEnv;

    await expect(
      pool.flashLoan(
        _mockFlashLoanReceiver.address,
        MOCK_ETH_ADDRESS,
        '1', //1 wei loan
        '0x10'
      ),
      TOO_SMALL_FLASH_LOAN
    ).to.be.revertedWith(TOO_SMALL_FLASH_LOAN);
  });

  it('tries to take a flashloan that is bigger than the available liquidity (revert expected)', async () => {
    const {pool} = testEnv;

    await expect(
      pool.flashLoan(
        _mockFlashLoanReceiver.address,
        MOCK_ETH_ADDRESS,
        '1004415000000000000', //slightly higher than the available liquidity
        '0x10'
      ),
      NOT_ENOUGH_LIQUIDITY_TO_BORROW
    ).to.be.revertedWith(NOT_ENOUGH_LIQUIDITY_TO_BORROW);
  });

  it('tries to take a flashloan using a non contract address as receiver (revert expected)', async () => {
    const {pool, deployer} = testEnv;

    await expect(pool.flashLoan(deployer.address, MOCK_ETH_ADDRESS, '1000000000000000000', '0x10'))
      .to.be.reverted;
  });

  it('Deposits DAI into the reserve', async () => {
    const {dai,  pool} = testEnv;

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

    const expectedLiquidity = ethers.utils.parseEther('1000.315');

    const tokenDistributorBalance = await dai.balanceOf(_tokenDistributor.address);

    expect(totalLiquidity).to.be.equal(expectedLiquidity, 'Invalid total liquidity');
    expect(currentLiqudityRate).to.be.equal('0', 'Invalid liquidity rate');
    expect(currentLiquidityIndex).to.be.equal(
      new BigNumber('1.000315').multipliedBy(oneRay).toFixed(),
      'Invalid liquidity index'
    );
    expect(currentUserBalance.toString()).to.be.equal(expectedLiquidity, 'Invalid user balance');

    expect(tokenDistributorBalance.toString()).to.be.equal(
      ethers.utils.parseEther('0.135'),
      'Invalid token distributor balance'
    );
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
      INCONSISTENT_PROTOCOL_BALANCE
    ).to.be.revertedWith(INCONSISTENT_PROTOCOL_BALANCE);
  });
});
