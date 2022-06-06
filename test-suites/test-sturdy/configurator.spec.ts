import { TestEnv, makeSuite } from './helpers/make-suite';
import { APPROVAL_AMOUNT_LENDING_POOL, RAY } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { ProtocolErrors } from '../../helpers/types';
import { strategySTETH } from '../../markets/sturdy/reservesConfigs';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';

const { expect } = require('chai');

makeSuite('LendingPoolConfigurator', (testEnv: TestEnv) => {
  const {
    CALLER_NOT_POOL_ADMIN,
    LPC_RESERVE_LIQUIDITY_NOT_0,
    RC_INVALID_LTV,
    RC_INVALID_LIQ_THRESHOLD,
    RC_INVALID_LIQ_BONUS,
    RC_INVALID_DECIMALS,
    RC_INVALID_RESERVE_FACTOR,
  } = ProtocolErrors;

  it('Reverts trying to set an invalid reserve factor', async () => {
    const { configurator, lido } = testEnv;

    const invalidReserveFactor = 65536;

    await expect(
      configurator.setReserveFactor(lido.address, invalidReserveFactor)
    ).to.be.revertedWith(RC_INVALID_RESERVE_FACTOR);
  });

  it('Deactivates the ETH reserve', async () => {
    const { configurator, lido, helpersContract } = testEnv;
    await configurator.deactivateReserve(lido.address);
    const { isActive } = await helpersContract.getReserveConfigurationData(lido.address);
    expect(isActive).to.be.equal(false);
  });

  it('Rectivates the ETH reserve', async () => {
    const { configurator, lido, helpersContract } = testEnv;
    await configurator.activateReserve(lido.address);

    const { isActive } = await helpersContract.getReserveConfigurationData(lido.address);
    expect(isActive).to.be.equal(true);
  });

  it('Check the onlySturdyAdmin on deactivateReserve ', async () => {
    const { configurator, users, lido } = testEnv;
    await expect(
      configurator.connect(users[2].signer).deactivateReserve(lido.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlySturdyAdmin on activateReserve ', async () => {
    const { configurator, users, lido } = testEnv;
    await expect(
      configurator.connect(users[2].signer).activateReserve(lido.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Freezes the ETH reserve', async () => {
    const { configurator, lido, helpersContract } = testEnv;

    await configurator.freezeReserve(lido.address);
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
    } = await helpersContract.getReserveConfigurationData(lido.address);

    expect(borrowingEnabled).to.be.equal(false);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(true);
    expect(decimals).to.be.equal(strategySTETH.reserveDecimals);
    expect(ltv).to.be.equal(strategySTETH.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategySTETH.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategySTETH.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(strategySTETH.stableBorrowRateEnabled);
    expect(reserveFactor).to.be.equal(strategySTETH.reserveFactor);
  });

  it('Unfreezes the ETH reserve', async () => {
    const { configurator, helpersContract, lido } = testEnv;
    await configurator.unfreezeReserve(lido.address);

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
    } = await helpersContract.getReserveConfigurationData(lido.address);

    expect(borrowingEnabled).to.be.equal(false);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategySTETH.reserveDecimals);
    expect(ltv).to.be.equal(strategySTETH.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategySTETH.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategySTETH.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(strategySTETH.stableBorrowRateEnabled);
    expect(reserveFactor).to.be.equal(strategySTETH.reserveFactor);
  });

  it('Check the onlySturdyAdmin on freezeReserve ', async () => {
    const { configurator, users, lido } = testEnv;
    await expect(
      configurator.connect(users[2].signer).freezeReserve(lido.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlySturdyAdmin on unfreezeReserve ', async () => {
    const { configurator, users, lido } = testEnv;
    await expect(
      configurator.connect(users[2].signer).unfreezeReserve(lido.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Deactivates the ETH reserve for borrowing', async () => {
    const { configurator, helpersContract, lido } = testEnv;
    await configurator.disableBorrowingOnReserve(lido.address);
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
    } = await helpersContract.getReserveConfigurationData(lido.address);

    expect(borrowingEnabled).to.be.equal(false);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategySTETH.reserveDecimals);
    expect(ltv).to.be.equal(strategySTETH.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategySTETH.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategySTETH.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(strategySTETH.stableBorrowRateEnabled);
    expect(reserveFactor).to.be.equal(strategySTETH.reserveFactor);
  });

  it('Activates the ETH reserve for borrowing', async () => {
    const { configurator, lido, helpersContract } = testEnv;
    await configurator.enableBorrowingOnReserve(lido.address, true);
    const { variableBorrowIndex } = await helpersContract.getReserveData(lido.address);

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
    } = await helpersContract.getReserveConfigurationData(lido.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategySTETH.reserveDecimals);
    expect(ltv).to.be.equal(strategySTETH.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategySTETH.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategySTETH.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(strategySTETH.reserveFactor);

    expect(variableBorrowIndex.toString()).to.be.equal(RAY);
  });

  it('Check the onlySturdyAdmin on disableBorrowingOnReserve ', async () => {
    const { configurator, users, lido } = testEnv;
    await expect(
      configurator.connect(users[2].signer).disableBorrowingOnReserve(lido.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlySturdyAdmin on enableBorrowingOnReserve ', async () => {
    const { configurator, users, lido } = testEnv;
    await expect(
      configurator.connect(users[2].signer).enableBorrowingOnReserve(lido.address, true),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Deactivates the ETH reserve as collateral', async () => {
    const { configurator, helpersContract, lido } = testEnv;
    await configurator.configureReserveAsCollateral(lido.address, 0, 0, 0);

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
    } = await helpersContract.getReserveConfigurationData(lido.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(0);
    expect(liquidationThreshold).to.be.equal(0);
    expect(liquidationBonus).to.be.equal(0);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(strategySTETH.reserveFactor);
  });

  it('Activates the ETH reserve as collateral', async () => {
    const { configurator, helpersContract, lido } = testEnv;
    await configurator.configureReserveAsCollateral(lido.address, '7000', '7500', '10750');

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
    } = await helpersContract.getReserveConfigurationData(lido.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategySTETH.reserveDecimals);
    expect(ltv).to.be.equal(strategySTETH.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategySTETH.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategySTETH.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(strategySTETH.reserveFactor);
  });

  it('Check the onlySturdyAdmin on configureReserveAsCollateral ', async () => {
    const { configurator, users, lido } = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .configureReserveAsCollateral(lido.address, '7500', '8000', '10500'),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Disable stable borrow rate on the ETH reserve', async () => {
    const { configurator, helpersContract, lido } = testEnv;
    await configurator.disableReserveStableRate(lido.address);
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
    } = await helpersContract.getReserveConfigurationData(lido.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategySTETH.reserveDecimals);
    expect(ltv).to.be.equal(strategySTETH.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategySTETH.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategySTETH.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(false);
    expect(reserveFactor).to.be.equal(strategySTETH.reserveFactor);
  });

  it('Enables stable borrow rate on the ETH reserve', async () => {
    const { configurator, helpersContract, lido } = testEnv;
    await configurator.enableReserveStableRate(lido.address);
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
    } = await helpersContract.getReserveConfigurationData(lido.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategySTETH.reserveDecimals);
    expect(ltv).to.be.equal(strategySTETH.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategySTETH.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategySTETH.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(strategySTETH.reserveFactor);
  });

  it('Check the onlySturdyAdmin on disableReserveStableRate', async () => {
    const { configurator, users, lido } = testEnv;
    await expect(
      configurator.connect(users[2].signer).disableReserveStableRate(lido.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlySturdyAdmin on enableReserveStableRate', async () => {
    const { configurator, users, lido } = testEnv;
    await expect(
      configurator.connect(users[2].signer).enableReserveStableRate(lido.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Changes the reserve factor of stETH', async () => {
    const { configurator, helpersContract, lido } = testEnv;
    await configurator.setReserveFactor(lido.address, '1000');
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
    } = await helpersContract.getReserveConfigurationData(lido.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategySTETH.reserveDecimals);
    expect(ltv).to.be.equal(strategySTETH.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategySTETH.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategySTETH.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(1000);
  });

  it('Check the onlyLendingPoolManager on setReserveFactor', async () => {
    const { configurator, users, lido } = testEnv;
    await expect(
      configurator.connect(users[2].signer).setReserveFactor(lido.address, '2000'),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Reverts when trying to disable the DAI reserve with liquidity on it', async () => {
    const { dai, pool, configurator, deployer } = testEnv;
    const userAddress = await pool.signer.getAddress();
    const daiOwnerAddress = '0xC2c7D100d234D23cd7233066a5FEE97f56DB171C';
    const ethers = (DRE as any).ethers;

    await impersonateAccountsHardhat([daiOwnerAddress]);
    const signer = await ethers.provider.getSigner(daiOwnerAddress);

    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');
    await dai.connect(signer).transfer(deployer.address, amountDAItoDeposit);

    //approve protocol to access depositor wallet
    await dai.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    await pool.deposit(dai.address, amountDAItoDeposit, userAddress, '0');

    await expect(
      configurator.deactivateReserve(dai.address),
      LPC_RESERVE_LIQUIDITY_NOT_0
    ).to.be.revertedWith(LPC_RESERVE_LIQUIDITY_NOT_0);
  });
});
