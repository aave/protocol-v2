import {expect} from "chai";
import {TestEnv, makeSuite} from "./helpers/make-suite";
import {RateMode, ProtocolErrors} from "../helpers/types";
import {MOCK_ETH_ADDRESS} from "../helpers/constants";

makeSuite("LendingPoolCore: Modifiers", (testEnv: TestEnv) => {
  const {
    INVALID_CONFIGURATOR_CALLER_MSG,
    INVALID_POOL_CALLER_MSG,
  } = ProtocolErrors;

  it("Tries invoke updateStateOnDeposit ", async () => {
    const {dai, deployer, core} = testEnv;
    await expect(
      core.updateStateOnDeposit(dai.address, deployer.address, "0", false),
      INVALID_POOL_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG);
  });

  it("Tries invoke updateStateOnRedeem", async () => {
    const {dai, deployer, core} = testEnv;
    await expect(
      core.updateStateOnRedeem(dai.address, deployer.address, "0", false),
      INVALID_POOL_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG);
  });

  it("Tries invoke updateStateOnBorrow", async () => {
    const {dai, deployer, core} = testEnv;
    await expect(
      core.updateStateOnBorrow(
        dai.address,
        deployer.address,
        "0",
        "0",
        RateMode.Stable
      ),
      INVALID_POOL_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG);
  });

  it("Tries invoke updateStateOnRepay", async () => {
    const {dai, deployer, core} = testEnv;
    await expect(
      core.updateStateOnRepay(
        dai.address,
        deployer.address,
        "0",
        "0",
        "0",
        false
      ),
      INVALID_POOL_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG);
  });

  it("Tries invoke updateStateOnSwapRate", async () => {
    const {dai, deployer, core} = testEnv;
    await expect(
      core.updateStateOnSwapRate(
        dai.address,
        deployer.address,
        "0",
        "0",
        "0",
        RateMode.Stable
      ),
      INVALID_POOL_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG);
  });

  it("Tries invoke updateStateOnRebalance", async () => {
    const {dai, deployer, core} = testEnv;
    await expect(
      core.updateStateOnRebalance(dai.address, deployer.address, "0"),
      INVALID_POOL_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG);
  });

  it("Tries invoke updateStateOnLiquidation", async () => {
    const {dai, deployer, core} = testEnv;
    await expect(
      core.updateStateOnLiquidation(
        MOCK_ETH_ADDRESS,
        dai.address,
        deployer.address,
        "0",
        "0",
        "0",
        "0",
        "0",
        false
      ),
      INVALID_POOL_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG);
  });

  it("Tries invoke setUserUseReserveAsCollateral", async () => {
    const {deployer, core} = testEnv;
    await expect(
      core.setUserUseReserveAsCollateral(
        MOCK_ETH_ADDRESS,
        deployer.address,
        false
      ),
      INVALID_POOL_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG);
  });

  it("Tries invoke transferToUser", async () => {
    const {deployer, core} = testEnv;
    await expect(
      core.transferToUser(MOCK_ETH_ADDRESS, deployer.address, "0"),
      INVALID_POOL_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG);
  });

  it("Tries invoke transferToReserve", async () => {
    const {deployer, core} = testEnv;
    await expect(
      core.transferToReserve(MOCK_ETH_ADDRESS, deployer.address, "0"),
      INVALID_POOL_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG);
  });

  it("Tries invoke transferToFeeCollectionAddress", async () => {
    const {deployer, core} = testEnv;
    await expect(
      core.transferToFeeCollectionAddress(
        MOCK_ETH_ADDRESS,
        deployer.address,
        "0",
        deployer.address
      ),
      INVALID_POOL_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG);
  });

  it("Tries invoke liquidateFee", async () => {
    const {deployer, core} = testEnv;
    await expect(
      core.liquidateFee(MOCK_ETH_ADDRESS, "0", deployer.address),
      INVALID_POOL_CALLER_MSG
    ).to.be.revertedWith(INVALID_POOL_CALLER_MSG);
  });

  it("Tries invoke initReserve", async () => {
    const {deployer, core, dai} = testEnv;
    await expect(
      core.initReserve(dai.address, dai.address, "18", deployer.address),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
  });

  it("Tries invoke refreshConfiguration", async () => {
    const {core} = testEnv;
    await expect(
      core.refreshConfiguration(),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
  });

  it("Tries invoke enableBorrowingOnReserve, disableBorrowingOnReserve", async () => {
    const {core, dai} = testEnv;
    await expect(
      core.enableBorrowingOnReserve(dai.address, false),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
    await expect(
      core.refreshConfiguration(),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
  });

  it("Tries invoke freezeReserve, unfreezeReserve", async () => {
    const {core, dai} = testEnv;
    await expect(
      core.freezeReserve(dai.address),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
    await expect(
      core.unfreezeReserve(dai.address),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
  });

  it("Tries invoke enableReserveAsCollateral, disableReserveAsCollateral", async () => {
    const {core, dai} = testEnv;
    await expect(
      core.enableReserveAsCollateral(dai.address, 0, 0, 0),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
    await expect(
      core.disableReserveAsCollateral(dai.address),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
  });

  it("Tries invoke enableReserveStableBorrowRate, disableReserveStableBorrowRate", async () => {
    const {core, dai} = testEnv;
    await expect(
      core.enableReserveStableBorrowRate(dai.address),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
    await expect(
      core.disableReserveStableBorrowRate(dai.address),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
  });

  it("Tries invoke setReserveDecimals", async () => {
    const {core, dai} = testEnv;
    await expect(
      core.setReserveDecimals(dai.address, "0"),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
  });

  it("Tries invoke removeLastAddedReserve", async () => {
    const {core, dai} = testEnv;
    await expect(
      core.removeLastAddedReserve(dai.address),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
  });

  it("Tries invoke setReserveBaseLTVasCollateral", async () => {
    const {core, dai} = testEnv;
    await expect(
      core.setReserveBaseLTVasCollateral(dai.address, "0"),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
  });

  it("Tries invoke setReserveLiquidationBonus", async () => {
    const {core, dai} = testEnv;
    await expect(
      core.setReserveLiquidationBonus(dai.address, "0"),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
  });

  it("Tries invoke setReserveLiquidationThreshold", async () => {
    const {core, dai} = testEnv;
    await expect(
      core.setReserveLiquidationThreshold(dai.address, "0"),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
  });

  it("Tries invoke setReserveInterestRateStrategyAddress", async () => {
    const {core, deployer, dai} = testEnv;
    await expect(
      core.setReserveInterestRateStrategyAddress(dai.address, deployer.address),
      INVALID_CONFIGURATOR_CALLER_MSG
    ).to.be.revertedWith(INVALID_CONFIGURATOR_CALLER_MSG);
  });
});
