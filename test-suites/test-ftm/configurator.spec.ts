import { TestEnv, makeSuite } from './helpers/make-suite';
import { APPROVAL_AMOUNT_LENDING_POOL, RAY } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { ProtocolErrors } from '../../helpers/types';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { strategyYVWFTM } from '../../markets/ftm/reservesConfigs';
import { strategyUSDC } from '../../markets/ftm/reservesConfigs';

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
    const { configurator, yvwftm } = testEnv;

    const invalidReserveFactor = 65536;

    await expect(
      configurator.setReserveFactor(yvwftm.address, invalidReserveFactor)
    ).to.be.revertedWith(RC_INVALID_RESERVE_FACTOR);
  });

  it('Deactivates the yvWFTM reserve', async () => {
    const { configurator, yvwftm, helpersContract } = testEnv;
    await configurator.deactivateReserve(yvwftm.address);
    const { isActive } = await helpersContract.getReserveConfigurationData(yvwftm.address);
    expect(isActive).to.be.equal(false);
  });

  it('Rectivates the yvWFTM reserve', async () => {
    const { configurator, yvwftm, helpersContract } = testEnv;
    await configurator.activateReserve(yvwftm.address);

    const { isActive } = await helpersContract.getReserveConfigurationData(yvwftm.address);
    expect(isActive).to.be.equal(true);
  });

  it('Check the onlySturdyAdmin on deactivateReserve ', async () => {
    const { configurator, users, yvwftm } = testEnv;
    await expect(
      configurator.connect(users[2].signer).deactivateReserve(yvwftm.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlySturdyAdmin on activateReserve ', async () => {
    const { configurator, users, yvwftm } = testEnv;
    await expect(
      configurator.connect(users[2].signer).activateReserve(yvwftm.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Freezes the yvWFTM reserve', async () => {
    const { configurator, yvwftm, helpersContract } = testEnv;

    await configurator.freezeReserve(yvwftm.address);
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
    } = await helpersContract.getReserveConfigurationData(yvwftm.address);

    expect(borrowingEnabled).to.be.equal(false);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(true);
    expect(decimals).to.be.equal(strategyYVWFTM.reserveDecimals);
    expect(ltv).to.be.equal(strategyYVWFTM.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyYVWFTM.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyYVWFTM.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(strategyYVWFTM.stableBorrowRateEnabled);
    expect(reserveFactor).to.be.equal(strategyYVWFTM.reserveFactor);
  });

  it('Unfreezes the yvWFTM reserve', async () => {
    const { configurator, helpersContract, yvwftm } = testEnv;
    await configurator.unfreezeReserve(yvwftm.address);

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
    } = await helpersContract.getReserveConfigurationData(yvwftm.address);

    expect(borrowingEnabled).to.be.equal(false);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyYVWFTM.reserveDecimals);
    expect(ltv).to.be.equal(strategyYVWFTM.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyYVWFTM.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyYVWFTM.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(strategyYVWFTM.stableBorrowRateEnabled);
    expect(reserveFactor).to.be.equal(strategyYVWFTM.reserveFactor);
  });

  it('Check the onlySturdyAdmin on freezeReserve ', async () => {
    const { configurator, users, yvwftm } = testEnv;
    await expect(
      configurator.connect(users[2].signer).freezeReserve(yvwftm.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlySturdyAdmin on unfreezeReserve ', async () => {
    const { configurator, users, yvwftm } = testEnv;
    await expect(
      configurator.connect(users[2].signer).unfreezeReserve(yvwftm.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Deactivates the yvWFTM reserve for borrowing', async () => {
    const { configurator, helpersContract, yvwftm } = testEnv;
    await configurator.disableBorrowingOnReserve(yvwftm.address);
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
    } = await helpersContract.getReserveConfigurationData(yvwftm.address);

    expect(borrowingEnabled).to.be.equal(false);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyYVWFTM.reserveDecimals);
    expect(ltv).to.be.equal(strategyYVWFTM.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyYVWFTM.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyYVWFTM.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(strategyYVWFTM.stableBorrowRateEnabled);
    expect(reserveFactor).to.be.equal(strategyYVWFTM.reserveFactor);
  });

  it('Activates the USDC reserve for borrowing', async () => {
    const { configurator, usdc, helpersContract } = testEnv;
    await configurator.enableBorrowingOnReserve(usdc.address, true);
    const { variableBorrowIndex } = await helpersContract.getReserveData(usdc.address);

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
    } = await helpersContract.getReserveConfigurationData(usdc.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyUSDC.reserveDecimals);
    expect(ltv).to.be.equal(strategyUSDC.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyUSDC.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyUSDC.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(strategyUSDC.reserveFactor);

    expect(variableBorrowIndex.toString()).to.be.equal(RAY);
  });

  it('Check the onlySturdyAdmin on disableBorrowingOnReserve ', async () => {
    const { configurator, users, usdc } = testEnv;
    await expect(
      configurator.connect(users[2].signer).disableBorrowingOnReserve(usdc.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlySturdyAdmin on enableBorrowingOnReserve ', async () => {
    const { configurator, users, usdc } = testEnv;
    await expect(
      configurator.connect(users[2].signer).enableBorrowingOnReserve(usdc.address, true),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Deactivates the yvWFTM reserve as collateral', async () => {
    const { configurator, helpersContract, yvwftm } = testEnv;
    await configurator.configureReserveAsCollateral(yvwftm.address, 0, 0, 0);

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
    } = await helpersContract.getReserveConfigurationData(yvwftm.address);

    expect(borrowingEnabled).to.be.equal(false);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(0);
    expect(liquidationThreshold).to.be.equal(0);
    expect(liquidationBonus).to.be.equal(0);
    expect(stableBorrowRateEnabled).to.be.equal(false);
    expect(reserveFactor).to.be.equal(strategyYVWFTM.reserveFactor);
  });

  it('Activates the yvWFTM reserve as collateral', async () => {
    const { configurator, helpersContract, yvwftm } = testEnv;
    await configurator.configureReserveAsCollateral(yvwftm.address, '7000', '7500', '10750');

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
    } = await helpersContract.getReserveConfigurationData(yvwftm.address);

    expect(borrowingEnabled).to.be.equal(false);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyYVWFTM.reserveDecimals);
    expect(ltv).to.be.equal(strategyYVWFTM.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyYVWFTM.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyYVWFTM.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(false);
    expect(reserveFactor).to.be.equal(strategyYVWFTM.reserveFactor);
  });

  it('Check the onlySturdyAdmin on configureReserveAsCollateral ', async () => {
    const { configurator, users, yvwftm } = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .configureReserveAsCollateral(yvwftm.address, '7500', '8000', '10500'),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Disable stable borrow rate on the yvWFTM reserve', async () => {
    const { configurator, helpersContract, yvwftm } = testEnv;
    await configurator.disableReserveStableRate(yvwftm.address);
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
    } = await helpersContract.getReserveConfigurationData(yvwftm.address);

    expect(borrowingEnabled).to.be.equal(false);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyYVWFTM.reserveDecimals);
    expect(ltv).to.be.equal(strategyYVWFTM.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyYVWFTM.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyYVWFTM.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(false);
    expect(reserveFactor).to.be.equal(strategyYVWFTM.reserveFactor);
  });

  it('Enables stable borrow rate on the USDC reserve', async () => {
    const { configurator, helpersContract, usdc } = testEnv;
    await configurator.enableReserveStableRate(usdc.address);
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
    } = await helpersContract.getReserveConfigurationData(usdc.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyUSDC.reserveDecimals);
    expect(ltv).to.be.equal(strategyUSDC.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyUSDC.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyUSDC.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(strategyUSDC.reserveFactor);
  });

  it('Check the onlySturdyAdmin on disableReserveStableRate', async () => {
    const { configurator, users, usdc } = testEnv;
    await expect(
      configurator.connect(users[2].signer).disableReserveStableRate(usdc.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlySturdyAdmin on enableReserveStableRate', async () => {
    const { configurator, users, usdc } = testEnv;
    await expect(
      configurator.connect(users[2].signer).enableReserveStableRate(usdc.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Changes the reserve factor of USDC', async () => {
    const { configurator, helpersContract, usdc } = testEnv;
    await configurator.setReserveFactor(usdc.address, '1000');
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
    } = await helpersContract.getReserveConfigurationData(usdc.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyUSDC.reserveDecimals);
    expect(ltv).to.be.equal(strategyUSDC.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyUSDC.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyUSDC.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(1000);
  });

  it('Check the onlyLendingPoolManager on setReserveFactor', async () => {
    const { configurator, users, usdc } = testEnv;
    await expect(
      configurator.connect(users[2].signer).setReserveFactor(usdc.address, '2000'),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Reverts when trying to disable the DAI reserve with liquidity on it', async () => {
    const { dai, pool, configurator, deployer } = testEnv;
    const userAddress = await pool.signer.getAddress();
    const daiOwnerAddress = '0x6Bf97f2534be2242dDb3A29bfb24d498212DcdED';
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
