import {TestEnv, makeSuite} from "./helpers/make-suite";
import {
  MOCK_ETH_ADDRESS,
  RAY,
  APPROVAL_AMOUNT_LENDING_POOL,
} from "../helpers/constants";
import {convertToCurrencyDecimals} from "../helpers/contracts-helpers";
import {ProtocolErrors} from "../helpers/types";

const {expect} = require("chai");

makeSuite("LendingPoolConfigurator", (testEnv: TestEnv) => {
  const {INVALID_POOL_MANAGER_CALLER_MSG} = ProtocolErrors;

  it("Deactivates the ETH reserve", async () => {
    const {configurator, pool} = testEnv;
    await configurator.deactivateReserve(MOCK_ETH_ADDRESS);
    const isActive = await pool.getReserveIsActive(MOCK_ETH_ADDRESS);
    expect(isActive).to.be.equal(false);
  });

  it("Rectivates the ETH reserve", async () => {
    const {configurator, pool} = testEnv;
    await configurator.activateReserve(MOCK_ETH_ADDRESS);

    const isActive = await pool.getReserveIsActive(MOCK_ETH_ADDRESS);
    expect(isActive).to.be.equal(true);
  });

  it("Check the onlyLendingPoolManager on deactivateReserve ", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator.connect(users[2].signer).deactivateReserve(MOCK_ETH_ADDRESS),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Check the onlyLendingPoolManager on activateReserve ", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator.connect(users[2].signer).activateReserve(MOCK_ETH_ADDRESS),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Freezes the ETH reserve", async () => {
    const {configurator, pool} = testEnv;
    await configurator.freezeReserve(MOCK_ETH_ADDRESS);
    const isFreezed = await pool.getReserveIsFreezed(MOCK_ETH_ADDRESS);
    expect(isFreezed).to.be.equal(true);
  });

  it("Unfreezes the ETH reserve", async () => {
    const {configurator, pool} = testEnv;
    await configurator.unfreezeReserve(MOCK_ETH_ADDRESS);

    const isFreezed = await pool.getReserveIsFreezed(MOCK_ETH_ADDRESS);
    expect(isFreezed).to.be.equal(false);
  });

  it("Check the onlyLendingPoolManager on freezeReserve ", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator.connect(users[2].signer).freezeReserve(MOCK_ETH_ADDRESS),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Check the onlyLendingPoolManager on unfreezeReserve ", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator.connect(users[2].signer).unfreezeReserve(MOCK_ETH_ADDRESS),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Deactivates the ETH reserve for borrowing", async () => {
    const {configurator, pool} = testEnv;
    await configurator.disableBorrowingOnReserve(MOCK_ETH_ADDRESS);
    const isEnabled = await pool.isReserveBorrowingEnabled(MOCK_ETH_ADDRESS);
    expect(isEnabled).to.be.equal(false);
  });

  it("Activates the ETH reserve for borrowing", async () => {
    const {configurator, pool} = testEnv;
    await configurator.enableBorrowingOnReserve(MOCK_ETH_ADDRESS, true);
    const isEnabled = await pool.isReserveBorrowingEnabled(MOCK_ETH_ADDRESS);
    const interestIndex = await pool.getReserveLiquidityCumulativeIndex(
      MOCK_ETH_ADDRESS
    );
    expect(isEnabled).to.be.equal(true);
    expect(interestIndex.toString()).to.be.equal(RAY);
  });

  it("Check the onlyLendingPoolManager on disableBorrowingOnReserve ", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .disableBorrowingOnReserve(MOCK_ETH_ADDRESS),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Check the onlyLendingPoolManager on enableBorrowingOnReserve ", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .enableBorrowingOnReserve(MOCK_ETH_ADDRESS, true),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Deactivates the ETH reserve as collateral", async () => {
    const {configurator, pool} = testEnv;
    await configurator.disableReserveAsCollateral(MOCK_ETH_ADDRESS);
    const isEnabled = await pool.isReserveUsageAsCollateralEnabled(
      MOCK_ETH_ADDRESS
    );
    expect(isEnabled).to.be.equal(false);
  });

  it("Activates the ETH reserve as collateral", async () => {
    const {configurator, pool} = testEnv;
    await configurator.enableReserveAsCollateral(
      MOCK_ETH_ADDRESS,
      "75",
      "80",
      "105"
    );

    const isEnabled = await pool.isReserveUsageAsCollateralEnabled(
      MOCK_ETH_ADDRESS
    );
    expect(isEnabled).to.be.equal(true);
  });

  it("Check the onlyLendingPoolManager on disableReserveAsCollateral ", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .disableReserveAsCollateral(MOCK_ETH_ADDRESS),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Check the onlyLendingPoolManager on enableReserveAsCollateral ", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .enableReserveAsCollateral(MOCK_ETH_ADDRESS, "75", "80", "105"),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Disable stable borrow rate on the ETH reserve", async () => {
    const {configurator, pool} = testEnv;
    await configurator.disableReserveStableBorrowRate(MOCK_ETH_ADDRESS);
    const isEnabled = await pool.getReserveIsStableBorrowRateEnabled(
      MOCK_ETH_ADDRESS
    );
    expect(isEnabled).to.be.equal(false);
  });

  it("Enables stable borrow rate on the ETH reserve", async () => {
    const {configurator, pool} = testEnv;
    await configurator.enableReserveStableBorrowRate(MOCK_ETH_ADDRESS);
    const isEnabled = await pool.getReserveIsStableBorrowRateEnabled(
      MOCK_ETH_ADDRESS
    );
    expect(isEnabled).to.be.equal(true);
  });

  it("Check the onlyLendingPoolManager on disableReserveStableBorrowRate", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .disableReserveStableBorrowRate(MOCK_ETH_ADDRESS),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Check the onlyLendingPoolManager on enableReserveStableBorrowRate", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .enableReserveStableBorrowRate(MOCK_ETH_ADDRESS),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Changes LTV of the reserve", async () => {
    const {configurator, pool} = testEnv;
    await configurator.setReserveBaseLTVasCollateral(MOCK_ETH_ADDRESS, "60");
    const {ltv}: any = await pool.getReserveConfigurationData(MOCK_ETH_ADDRESS);
    expect(ltv).to.be.bignumber.equal("60", "Invalid LTV");
  });

  it("Check the onlyLendingPoolManager on setReserveBaseLTVasCollateral", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .setReserveBaseLTVasCollateral(MOCK_ETH_ADDRESS, "75"),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Changes liquidation threshold of the reserve", async () => {
    const {configurator, pool} = testEnv;
    await configurator.setReserveLiquidationThreshold(MOCK_ETH_ADDRESS, "75");
    const {liquidationThreshold}: any = await pool.getReserveConfigurationData(
      MOCK_ETH_ADDRESS
    );
    expect(liquidationThreshold).to.be.bignumber.equal(
      "75",
      "Invalid Liquidation threshold"
    );
  });

  it("Check the onlyLendingPoolManager on setReserveLiquidationThreshold", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .setReserveLiquidationThreshold(MOCK_ETH_ADDRESS, "80"),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Changes liquidation bonus of the reserve", async () => {
    const {configurator, pool} = testEnv;
    await configurator.setReserveLiquidationBonus(MOCK_ETH_ADDRESS, "110");
    const liquidationBonus = await pool.getReserveLiquidationBonus(
      MOCK_ETH_ADDRESS
    );
    expect(liquidationBonus).to.be.bignumber.equal(
      "110",
      "Invalid Liquidation discount"
    );
  });

  it("Check the onlyLendingPoolManager on setReserveLiquidationBonus", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .setReserveLiquidationBonus(MOCK_ETH_ADDRESS, "80"),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Check the onlyLendingPoolManager on setReserveDecimals", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .setReserveDecimals(MOCK_ETH_ADDRESS, "80"),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Removes the last added reserve", async () => {
    const {configurator, pool} = testEnv;
    const reservesBefore = await pool.getReserves();

    const lastReserve = reservesBefore[reservesBefore.length - 1];

    await configurator.removeLastAddedReserve(lastReserve);

    const reservesAfter = await pool.getReserves();

    expect(reservesAfter.length).to.be.equal(
      reservesBefore.length - 1,
      "Invalid number of reserves after removal"
    );
  });

  it("Check the onlyLendingPoolManager on setReserveLiquidationBonus", async () => {
    const {configurator, users} = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .setReserveLiquidationBonus(MOCK_ETH_ADDRESS, "80"),
      INVALID_POOL_MANAGER_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_MANAGER_CALLER_MSG);
  });

  it("Reverts when trying to disable the DAI reserve with liquidity on it", async () => {
    const {dai,  pool, configurator} = testEnv;

    await dai.mint(await convertToCurrencyDecimals(dai.address, "1000"));

    //approve protocol to access depositor wallet
    await dai.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    const amountDAItoDeposit = await convertToCurrencyDecimals(
      dai.address,
      "1000"
    );

    //user 1 deposits 1000 DAI
    await pool.deposit(dai.address, amountDAItoDeposit, "0");

    await expect(
      configurator.deactivateReserve(dai.address),
      "The liquidity of the reserve needs to be 0"
    ).to.be.revertedWith("The liquidity of the reserve needs to be 0");
  });
});
