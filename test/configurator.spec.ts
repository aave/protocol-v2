import {TestEnv, makeSuite} from './helpers/make-suite';
import {RAY} from '../helpers/constants';
import {convertToCurrencyDecimals} from '../helpers/contracts-helpers';
import {ProtocolErrors} from '../helpers/types';
import {CommonsConfig} from '../config/commons';

const APPROVAL_AMOUNT_LENDING_POOL =
  CommonsConfig.ProtocolGlobalParams.ApprovalAmountLendingPoolCore;

const {expect} = require('chai');

makeSuite('LendingPoolConfigurator', (testEnv: TestEnv) => {
  const {
    CALLER_NOT_AAVE_ADMIN,
    RESERVE_LIQUIDITY_NOT_0,
    INVALID_LTV,
    INVALID_LIQ_THRESHOLD,
    INVALID_LIQ_BONUS,
    INVALID_DECIMALS,
    INVALID_RESERVE_FACTOR,
  } = ProtocolErrors;

  it('Reverts trying to set an invalid LTV', async () => {
    const {configurator, weth} = testEnv;

    const invalidLtv = 65536;

    await expect(configurator.setLtv(weth.address, invalidLtv)).to.be.revertedWith(INVALID_LTV);
  });

  it('Reverts trying to set an invalid liquidation threshold', async () => {
    const {configurator, weth} = testEnv;

    const invalidLiqThreshold = 65536;

    await expect(
      configurator.setLiquidationThreshold(weth.address, invalidLiqThreshold)
    ).to.be.revertedWith(INVALID_LIQ_THRESHOLD);
  });

  it('Reverts trying to set an invalid liquidation bonus', async () => {
    const {configurator, weth} = testEnv;

    const invalidLiqBonus = 65536;

    await expect(
      configurator.setLiquidationBonus(weth.address, invalidLiqBonus)
    ).to.be.revertedWith(INVALID_LIQ_BONUS);
  });

  it('Reverts trying to set an invalid reserve decimals', async () => {
    const {configurator, weth} = testEnv;

    const invalidDecimals = 256;

    await expect(configurator.setReserveDecimals(weth.address, invalidDecimals)).to.be.revertedWith(
      INVALID_DECIMALS
    );
  });

  it('Reverts trying to set an invalid reserve factor', async () => {
    const {configurator, weth} = testEnv;

    const invalidReserveFactor = 65536;

    await expect(
      configurator.setReserveFactor(weth.address, invalidReserveFactor)
    ).to.be.revertedWith(INVALID_RESERVE_FACTOR);
  });

  it('Deactivates the ETH reserve', async () => {
    const {configurator, weth, helpersContract} = testEnv;
    await configurator.deactivateReserve(weth.address);
    const {isActive} = await helpersContract.getReserveConfigurationData(weth.address);
    expect(isActive).to.be.equal(false);
  });

  it('Rectivates the ETH reserve', async () => {
    const {configurator, weth, helpersContract} = testEnv;
    await configurator.activateReserve(weth.address);

    const {isActive} = await helpersContract.getReserveConfigurationData(weth.address);
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
    const {configurator, pool, weth, helpersContract} = testEnv;
    await configurator.freezeReserve(weth.address);
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(true);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(7500);
    expect(liquidationThreshold).to.be.equal(8000);
    expect(liquidationBonus).to.be.equal(10500);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(0);
  });

  it('Unfreezes the ETH reserve', async () => {
    const {configurator, helpersContract, weth} = testEnv;
    await configurator.unfreezeReserve(weth.address);

    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(7500);
    expect(liquidationThreshold).to.be.equal(8000);
    expect(liquidationBonus).to.be.equal(10500);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(0);
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
    const {configurator, helpersContract, weth} = testEnv;
    await configurator.disableBorrowingOnReserve(weth.address);
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(false);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(7500);
    expect(liquidationThreshold).to.be.equal(8000);
    expect(liquidationBonus).to.be.equal(10500);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(0);
  });

  it('Activates the ETH reserve for borrowing', async () => {
    const {configurator, weth, helpersContract} = testEnv;
    await configurator.enableBorrowingOnReserve(weth.address, true);
    const {variableBorrowIndex} = await helpersContract.getReserveData(weth.address);

    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(7500);
    expect(liquidationThreshold).to.be.equal(8000);
    expect(liquidationBonus).to.be.equal(10500);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(0);

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
    
    const {configurator, helpersContract, weth} = testEnv;
    await configurator.configureReserveAsCollateral(weth.address, 0, 0, 0);

    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(0);
    expect(liquidationThreshold).to.be.equal(0);
    expect(liquidationBonus).to.be.equal(0);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(0);
  });

  it('Activates the ETH reserve as collateral', async () => {
    const {configurator, helpersContract, weth} = testEnv;
    await configurator.configureReserveAsCollateral(weth.address, '7500', '8000', '10500');

    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(7500);
    expect(liquidationThreshold).to.be.equal(8000);
    expect(liquidationBonus).to.be.equal(10500);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(0);
  });

  it('Check the onlyAaveAdmin on enableReserveAsCollateral ', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .configureReserveAsCollateral(weth.address, '75', '80', '105'),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Disable stable borrow rate on the ETH reserve', async () => {
    const {configurator, helpersContract, weth} = testEnv;
    await configurator.disableReserveStableRate(weth.address);
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(7500);
    expect(liquidationThreshold).to.be.equal(8000);
    expect(liquidationBonus).to.be.equal(10500);
    expect(stableBorrowRateEnabled).to.be.equal(false);
    expect(reserveFactor).to.be.equal(0);
  });

  it('Enables stable borrow rate on the ETH reserve', async () => {
    const {configurator, helpersContract, weth} = testEnv;
    await configurator.enableReserveStableRate(weth.address);
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(7500);
    expect(liquidationThreshold).to.be.equal(8000);
    expect(liquidationBonus).to.be.equal(10500);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(0);
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
    const {configurator, helpersContract, weth} = testEnv;
    await configurator.setLtv(weth.address, '6000');
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(6000);
    expect(liquidationThreshold).to.be.equal(8000);
    expect(liquidationBonus).to.be.equal(10500);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(0);
  });

  it('Check the onlyAaveAdmin on setLtv', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).setLtv(weth.address, '75'),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Changes the reserve factor of the reserve', async () => {
    const {configurator, helpersContract, weth} = testEnv;
    await configurator.setReserveFactor(weth.address, '1000');
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(6000);
    expect(liquidationThreshold).to.be.equal(8000);
    expect(liquidationBonus).to.be.equal(10500);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(1000);
  });

  it('Check the onlyLendingPoolManager on setReserveFactor', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).setReserveFactor(weth.address, '2000'),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Changes liquidation threshold of the reserve', async () => {
    const {configurator, helpersContract, weth} = testEnv;
    await configurator.setLiquidationThreshold(weth.address, '7500');
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(6000);
    expect(liquidationThreshold).to.be.equal(7500);
    expect(liquidationBonus).to.be.equal(10500);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(1000);
  });

  it('Check the onlyAaveAdmin on setLiquidationThreshold', async () => {
    const {configurator, users, weth} = testEnv;
    await expect(
      configurator.connect(users[2].signer).setLiquidationThreshold(weth.address, '80'),
      CALLER_NOT_AAVE_ADMIN
    ).to.be.revertedWith(CALLER_NOT_AAVE_ADMIN);
  });

  it('Changes liquidation bonus of the reserve', async () => {
    const {configurator, helpersContract, weth} = testEnv;
    await configurator.setLiquidationBonus(weth.address, '11000');
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(6000);
    expect(liquidationThreshold).to.be.equal(7500);
    expect(liquidationBonus).to.be.equal(11000);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(1000);
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
