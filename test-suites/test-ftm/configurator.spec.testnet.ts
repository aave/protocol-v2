import { TestEnv, makeSuite } from './helpers/make-suite';
import { APPROVAL_AMOUNT_LENDING_POOL, RAY } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { ProtocolErrors } from '../../helpers/types';
import { strategyYVWFTM } from '../../markets/ftm/reservesConfigs';
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
    const { configurator, yvwftm, deployer } = testEnv;

    const invalidReserveFactor = 65536;

    await expect(
      configurator.connect(deployer.signer).setReserveFactor(yvwftm.address, invalidReserveFactor)
    ).to.be.revertedWith(RC_INVALID_RESERVE_FACTOR);
  });

  // Disabled due to forked test network.
  // it('Deactivates the FTM reserve', async () => {
  //   const { configurator, yvwftm, helpersContract, deployer } = testEnv;
  //   await configurator.connect(deployer.signer).deactivateReserve(yvwftm.address);
  //   const { isActive } = await helpersContract.getReserveConfigurationData(yvwftm.address);
  //   expect(isActive).to.be.equal(false);
  // });

  it('Rectivates the FTM reserve', async () => {
    const { configurator, yvwftm, helpersContract, deployer } = testEnv;
    await configurator.connect(deployer.signer).activateReserve(yvwftm.address);

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

  it('Freezes the FTM reserve', async () => {
    const { configurator, yvwftm, helpersContract, deployer } = testEnv;

    await configurator.connect(deployer.signer).freezeReserve(yvwftm.address);
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

  it('Unfreezes the FTM reserve', async () => {
    const { configurator, helpersContract, yvwftm, deployer } = testEnv;
    await configurator.connect(deployer.signer).unfreezeReserve(yvwftm.address);

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

  it('Deactivates the FTM reserve for borrowing', async () => {
    const { configurator, helpersContract, yvwftm, deployer } = testEnv;
    await configurator.connect(deployer.signer).disableBorrowingOnReserve(yvwftm.address);
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

  it('Activates the FTM reserve for borrowing', async () => {
    const { configurator, yvwftm, helpersContract, deployer } = testEnv;
    await configurator.connect(deployer.signer).enableBorrowingOnReserve(yvwftm.address, true);
    const { variableBorrowIndex } = await helpersContract.getReserveData(yvwftm.address);

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

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyYVWFTM.reserveDecimals);
    expect(ltv).to.be.equal(strategyYVWFTM.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyYVWFTM.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyYVWFTM.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(strategyYVWFTM.reserveFactor);

    expect(variableBorrowIndex.toString()).to.be.equal(RAY);
  });

  it('Check the onlySturdyAdmin on disableBorrowingOnReserve ', async () => {
    const { configurator, users, yvwftm } = testEnv;
    await expect(
      configurator.connect(users[2].signer).disableBorrowingOnReserve(yvwftm.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlySturdyAdmin on enableBorrowingOnReserve ', async () => {
    const { configurator, users, yvwftm } = testEnv;
    await expect(
      configurator.connect(users[2].signer).enableBorrowingOnReserve(yvwftm.address, true),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  // Disabled due to forked test network.
  // it('Deactivates the FTM reserve as collateral', async () => {
  //   const { configurator, helpersContract, yvwftm, deployer } = testEnv;
  //   await configurator.connect(deployer.signer).configureReserveAsCollateral(yvwftm.address, 0, 0, 0);

  //   const {
  //     decimals,
  //     ltv,
  //     liquidationBonus,
  //     liquidationThreshold,
  //     reserveFactor,
  //     stableBorrowRateEnabled,
  //     borrowingEnabled,
  //     isActive,
  //     isFrozen,
  //   } = await helpersContract.getReserveConfigurationData(yvwftm.address);

  //   expect(borrowingEnabled).to.be.equal(true);
  //   expect(isActive).to.be.equal(true);
  //   expect(isFrozen).to.be.equal(false);
  //   expect(decimals).to.be.equal(18);
  //   expect(ltv).to.be.equal(0);
  //   expect(liquidationThreshold).to.be.equal(0);
  //   expect(liquidationBonus).to.be.equal(0);
  //   expect(stableBorrowRateEnabled).to.be.equal(true);
  //   expect(reserveFactor).to.be.equal(strategyYVWFTM.reserveFactor);
  // });

  it('Activates the FTM reserve as collateral', async () => {
    const { configurator, helpersContract, yvwftm, deployer } = testEnv;
    await configurator
      .connect(deployer.signer)
      .configureReserveAsCollateral(yvwftm.address, '7000', '7500', '10750');

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

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyYVWFTM.reserveDecimals);
    expect(ltv).to.be.equal(strategyYVWFTM.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyYVWFTM.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyYVWFTM.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(true);
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

  it('Disable stable borrow rate on the FTM reserve', async () => {
    const { configurator, helpersContract, yvwftm, deployer } = testEnv;
    await configurator.connect(deployer.signer).disableReserveStableRate(yvwftm.address);
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

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyYVWFTM.reserveDecimals);
    expect(ltv).to.be.equal(strategyYVWFTM.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyYVWFTM.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyYVWFTM.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(false);
    expect(reserveFactor).to.be.equal(strategyYVWFTM.reserveFactor);
  });

  it('Enables stable borrow rate on the FTM reserve', async () => {
    const { configurator, helpersContract, yvwftm, deployer } = testEnv;
    await configurator.connect(deployer.signer).enableReserveStableRate(yvwftm.address);
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

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyYVWFTM.reserveDecimals);
    expect(ltv).to.be.equal(strategyYVWFTM.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyYVWFTM.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyYVWFTM.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(strategyYVWFTM.reserveFactor);
  });

  it('Check the onlySturdyAdmin on disableReserveStableRate', async () => {
    const { configurator, users, yvwftm } = testEnv;
    await expect(
      configurator.connect(users[2].signer).disableReserveStableRate(yvwftm.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlySturdyAdmin on enableReserveStableRate', async () => {
    const { configurator, users, yvwftm } = testEnv;
    await expect(
      configurator.connect(users[2].signer).enableReserveStableRate(yvwftm.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Changes the reserve factor of yvWFTM', async () => {
    const { configurator, helpersContract, yvwftm, deployer } = testEnv;
    await configurator.connect(deployer.signer).setReserveFactor(yvwftm.address, '1000');
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

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyYVWFTM.reserveDecimals);
    expect(ltv).to.be.equal(strategyYVWFTM.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyYVWFTM.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyYVWFTM.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(1000);
  });

  it('Check the onlyLendingPoolManager on setReserveFactor', async () => {
    const { configurator, users, yvwftm } = testEnv;
    await expect(
      configurator.connect(users[2].signer).setReserveFactor(yvwftm.address, '2000'),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Reverts when trying to disable the DAI reserve with liquidity on it', async () => {
    const { dai, pool, configurator, deployer, aDai } = testEnv;
    const userAddress = await pool.signer.getAddress();
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    //approve protocol to access depositor wallet
    await dai.connect(deployer.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    await pool.connect(deployer.signer).deposit(dai.address, amountDAItoDeposit, userAddress, '0');

    await expect(
      configurator.connect(deployer.signer).deactivateReserve(dai.address),
      LPC_RESERVE_LIQUIDITY_NOT_0
    ).to.be.revertedWith(LPC_RESERVE_LIQUIDITY_NOT_0);
  });
});
