import {TestEnv, makeSuite} from './helpers/make-suite';
import {RAY, APPROVAL_AMOUNT_LENDING_POOL} from '../helpers/constants';
import {convertToCurrencyDecimals} from '../helpers/contracts-helpers';
import {ProtocolErrors} from '../helpers/types';

const {expect} = require('chai');

makeSuite('LendingPoolConfigurator', (testEnv: TestEnv) => {
  const {CALLER_NOT_AAVE_ADMIN, RESERVE_LIQUIDITY_NOT_0} = ProtocolErrors;

  it('Deactivates the ETH reserve', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.deactivateReserve(weth.address);
    const {isActive} = await pool.getReserveConfigurationData(weth.address);
    expect(isActive).to.be.equal(false);
  });

  it('Rectivates the ETH reserve', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.activateReserve(weth.address);

    const {isActive} = await pool.getReserveConfigurationData(weth.address);
    expect(isActive).to.be.equal(true);
  });

  it('Check the onlyAaveAdmin on deactivateReserve ', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).deactivateReserve(weth.address),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Check the onlyAaveAdmin on activateReserve ', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).activateReserve(weth.address),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Freezes the ETH reserve', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.freezeReserve(weth.address);
    const {isFreezed} = await pool.getReserveConfigurationData(weth.address);
    expect(isFreezed).to.be.equal(true);
  });

  it('Unfreezes the ETH reserve', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.unfreezeReserve(weth.address);

    const {isFreezed} = await pool.getReserveConfigurationData(weth.address);
    expect(isFreezed).to.be.equal(false);
  });

  it('Check the onlyAaveAdmin on freezeReserve ', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).freezeReserve(weth.address),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Check the onlyAaveAdmin on unfreezeReserve ', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).unfreezeReserve(weth.address),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Deactivates the ETH reserve for borrowing', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.disableBorrowingOnReserve(weth.address);
    const {borrowingEnabled} = await pool.getReserveConfigurationData(weth.address);
    expect(borrowingEnabled).to.be.equal(false);
  });

  it('Activates the ETH reserve for borrowing', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.enableBorrowingOnReserve(weth.address, true);
    const {borrowingEnabled} = await pool.getReserveConfigurationData(weth.address);
    const {variableBorrowIndex} = await pool.getReserveData(weth.address);
    expect(borrowingEnabled).to.be.equal(true);
    expect(variableBorrowIndex.toString()).to.be.equal(RAY);
  });

  it('Check the onlyAaveAdmin on disableBorrowingOnReserve ', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).disableBorrowingOnReserve(weth.address),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Check the onlyAaveAdmin on enableBorrowingOnReserve ', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).enableBorrowingOnReserve(weth.address, true),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Deactivates the ETH reserve as collateral', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.disableReserveAsCollateral(weth.address);
    const {usageAsCollateralEnabled} = await pool.getReserveConfigurationData(weth.address);
    expect(usageAsCollateralEnabled).to.be.equal(false);
  });

  it('Activates the ETH reserve as collateral', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.enableReserveAsCollateral(weth.address, '75', '80', '105');

    const {usageAsCollateralEnabled} = await pool.getReserveConfigurationData(weth.address);
    expect(usageAsCollateralEnabled).to.be.equal(true);
  });

  it('Check the onlyAaveAdmin on disableReserveAsCollateral ', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).disableReserveAsCollateral(weth.address),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Check the onlyAaveAdmin on enableReserveAsCollateral ', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .enableReserveAsCollateral(weth.address, '75', '80', '105'),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Disable stable borrow rate on the ETH reserve', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.disableReserveStableRate(weth.address);
    const {stableBorrowRateEnabled} = await pool.getReserveConfigurationData(weth.address);
    expect(stableBorrowRateEnabled).to.be.equal(false);
  });

  it('Enables stable borrow rate on the ETH reserve', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.enableReserveStableRate(weth.address);
    const {stableBorrowRateEnabled} = await pool.getReserveConfigurationData(weth.address);
    expect(stableBorrowRateEnabled).to.be.equal(true);
  });

  it('Check the onlyAaveAdmin on disableReserveStableRate', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).disableReserveStableRate(weth.address),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Check the onlyAaveAdmin on enableReserveStableRate', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).enableReserveStableRate(weth.address),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Changes LTV of the reserve', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.setLtv(weth.address, '60');
    const {ltv} = await pool.getReserveConfigurationData(weth.address);
    expect(ltv.toString()).to.be.bignumber.equal('60', 'Invalid LTV');
  });

  it('Check the onlyAaveAdmin on setLtv', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).setLtv(weth.address, '75'),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });


  it('Changes the reserve factor of the reserve', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.setReserveFactor(weth.address, '1000');
    const {reserveFactor} = await pool.getReserveConfigurationData(weth.address);
    expect(reserveFactor.toString()).to.be.bignumber.equal('1000', 'Invalid reserve factor');
  });

  it('Check the onlyLendingPoolManager on setReserveFactor', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).setReserveFactor(weth.address, '2000'),
      CALLER_NOT_LENDING_POOL_MANAGER
    ).to.be.revertedWith(CALLER_NOT_LENDING_POOL_MANAGER);
  });


  it('Changes liquidation threshold of the reserve', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.setLiquidationThreshold(weth.address, '75');
    const {liquidationThreshold} = await pool.getReserveConfigurationData(weth.address);
    expect(liquidationThreshold.toString()).to.be.bignumber.equal(
      '75',
      'Invalid Liquidation threshold'
    );
  });

  it('Check the onlyAaveAdmin on setLiquidationThreshold', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).setLiquidationThreshold(weth.address, '80'),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Changes liquidation bonus of the reserve', async () => {
    const {configurator, pool, weth} = testEnv;
    await configurator.setLiquidationBonus(weth.address, '110');
    const {liquidationBonus} = await pool.getReserveConfigurationData(weth.address);
    expect(liquidationBonus.toString()).to.be.bignumber.equal(
      '110',
      'Invalid Liquidation discount'
    );
  });

  it('Check the onlyAaveAdmin on setLiquidationBonus', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).setLiquidationBonus(weth.address, '80'),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Check the onlyAaveAdmin on setReserveDecimals', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).setReserveDecimals(weth.address, '80'),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Check the onlyAaveAdmin on setLiquidationBonus', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).setLiquidationBonus(weth.address, '80'),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Reverts when trying to disable the DAI reserve with liquidity on it', async () => {
    const {dai, pool, configurator} = testEnv;
    const userAddress = await pool.signer.getAddress();
    await dai.mint(await convertToCurrencyDecimals(dai.address, '1000'));

    //approve protocol to access depositor wallet
    await dai.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    //user 1 deposits 1000 DAI
    await pool.deposit(dai.address, amountDAItoDeposit, userAddress, '0');

    await expect(
      configurator.deactivateReserve(dai.address),
      RESERVE_LIQUIDITY_NOT_0
    ).to.be.revertedWith(RESERVE_LIQUIDITY_NOT_0);
  });
});
