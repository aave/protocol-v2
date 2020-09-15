import {TestEnv, makeSuite} from './helpers/make-suite';
import {APPROVAL_AMOUNT_LENDING_POOL, oneEther} from '../helpers/constants';
import {ethers} from 'ethers';
import BigNumber from 'bignumber.js';
import {
  calcExpectedVariableDebtTokenBalance,
  calcExpectedStableDebtTokenBalance,
} from './helpers/utils/calculations';
import {getContractsData} from './helpers/actions';
import {timeLatest, BRE, increaseTime, waitForTx} from '../helpers/misc-utils';
import {ProtocolErrors} from '../helpers/types';
import {convertToCurrencyDecimals} from '../helpers/contracts-helpers';
import {expectRepayWithCollateralEvent} from './repay-with-collateral.spec';

const {expect} = require('chai');
const {parseUnits, parseEther} = ethers.utils;

makeSuite('LendingPool. repayWithCollateral() with liquidator', (testEnv: TestEnv) => {
  const {INVALID_HF, COLLATERAL_CANNOT_BE_LIQUIDATED, IS_PAUSED} = ProtocolErrors;

  it('User 1 provides some liquidity for others to borrow', async () => {
    const {pool, weth, dai, usdc, deployer} = testEnv;

    await weth.mint(parseEther('200'));
    await weth.approve(pool.address, parseEther('200'));
    await pool.deposit(weth.address, parseEther('200'), deployer.address, 0);
    await dai.mint(parseEther('20000'));
    await dai.approve(pool.address, parseEther('20000'));
    await pool.deposit(dai.address, parseEther('20000'), deployer.address, 0);
    await usdc.mint(parseEther('20000'));
    await usdc.approve(pool.address, parseEther('20000'));
    await pool.deposit(usdc.address, parseEther('20000'), deployer.address, 0);
  });

  it('User 5 liquidate User 3 collateral, all his variable debt and part of the stable', async () => {
    const {pool, weth, usdc, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[2];
    const liquidator = users[4];
    const amountToDeposit = parseEther('20');
    const amountToBorrow = parseUnits('40', 6);

    await weth.connect(user.signer).mint(amountToDeposit);

    await weth.connect(user.signer).approve(pool.address, amountToDeposit);
    await pool.connect(user.signer).deposit(weth.address, amountToDeposit, user.address, '0');

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    await pool.connect(user.signer).borrow(usdc.address, amountToBorrow, 2, 0, user.address);

    await pool.connect(user.signer).borrow(usdc.address, amountToBorrow, 1, 0, user.address);

    const {userData: wethUserDataBefore} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {
      reserveData: usdcReserveDataBefore,
      userData: usdcUserDataBefore,
    } = await getContractsData(usdc.address, user.address, testEnv);

    // Set HF below 1
    await oracle.setAssetPrice(
      usdc.address,
      new BigNumber(usdcPrice.toString()).multipliedBy(60).toFixed(0)
    );
    const userGlobalDataPrior = await pool.getUserAccountData(user.address);
    expect(userGlobalDataPrior.healthFactor.toString()).to.be.bignumber.lt(oneEther, INVALID_HF);

    const amountToRepay = parseUnits('80', 6);

    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    const txReceipt = await waitForTx(
      await pool
        .connect(liquidator.signer)
        .repayWithCollateral(
          weth.address,
          usdc.address,
          user.address,
          amountToRepay,
          mockSwapAdapter.address,
          '0x'
        )
    );
    const repayWithCollateralTimestamp = await timeLatest();

    const {userData: wethUserDataAfter} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {userData: usdcUserDataAfter} = await getContractsData(
      usdc.address,
      user.address,
      testEnv
    );

    const collateralPrice = await oracle.getAssetPrice(weth.address);
    const principalPrice = await oracle.getAssetPrice(usdc.address);

    const collateralDecimals = (
      await pool.getReserveConfigurationData(weth.address)
    ).decimals.toString();
    const principalDecimals = (
      await pool.getReserveConfigurationData(usdc.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
      .times(new BigNumber(amountToRepay.toString()).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(
        new BigNumber(collateralPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
      )
      .div(100)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    const expectedVariableDebtIncrease = calcExpectedVariableDebtTokenBalance(
      usdcReserveDataBefore,
      usdcUserDataBefore,
      new BigNumber(repayWithCollateralTimestamp)
    ).minus(usdcUserDataBefore.currentVariableDebt);

    const expectedStableDebtIncrease = calcExpectedStableDebtTokenBalance(
      usdcUserDataBefore,
      new BigNumber(repayWithCollateralTimestamp)
    ).minus(usdcUserDataBefore.currentStableDebt);

    expect(usdcUserDataAfter.currentVariableDebt).to.be.bignumber.equal(
      new BigNumber(usdcUserDataBefore.currentVariableDebt)
        .minus(amountToRepay.toString())
        .plus(expectedVariableDebtIncrease)
        .gte(0)
        ? new BigNumber(usdcUserDataBefore.currentVariableDebt)
            .minus(amountToRepay.toString())
            .plus(expectedVariableDebtIncrease)
            .toString()
        : '0',
      'INVALID_VARIABLE_DEBT_POSITION'
    );

    const stableDebtRepaid = new BigNumber(usdcUserDataBefore.currentVariableDebt)
      .minus(amountToRepay.toString())
      .plus(expectedVariableDebtIncrease)
      .abs();

    expect(usdcUserDataAfter.currentStableDebt).to.be.bignumber.equal(
      new BigNumber(usdcUserDataBefore.currentStableDebt)
        .minus(stableDebtRepaid)
        .plus(expectedStableDebtIncrease)
        .gte(0)
        ? new BigNumber(usdcUserDataBefore.currentStableDebt)
            .minus(stableDebtRepaid)
            .plus(expectedStableDebtIncrease)
            .toString()
        : '0',
      'INVALID_STABLE_DEBT_POSITION'
    );

    expect(wethUserDataAfter.currentATokenBalance).to.be.bignumber.equal(
      new BigNumber(wethUserDataBefore.currentATokenBalance).minus(
        expectedCollateralLiquidated.toString()
      ),
      'INVALID_COLLATERAL_POSITION'
    );

    const eventsEmitted = txReceipt.events || [];

    expectRepayWithCollateralEvent(
      eventsEmitted,
      pool.address,
      weth.address,
      usdc.address,
      user.address
    );
    // Resets USDC Price
    await oracle.setAssetPrice(usdc.address, usdcPrice);
  });

  it('User 3 deposits WETH and borrows USDC at Variable', async () => {
    const {pool, weth, usdc, users, oracle} = testEnv;
    const user = users[2];
    const amountToDeposit = parseEther('10');

    await weth.connect(user.signer).mint(amountToDeposit);

    await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool.connect(user.signer).deposit(weth.address, amountToDeposit, user.address, '0');

    const userGlobalData = await pool.getUserAccountData(user.address);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await pool.connect(user.signer).borrow(usdc.address, amountUSDCToBorrow, 2, 0, user.address);
  });

  it('User 5 liquidates half the USDC loan of User 3 by swapping his WETH collateral', async () => {
    const {pool, weth, usdc, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[2];
    const liquidator = users[4];
    // Sets USDC Price higher to decrease health factor below 1
    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    await oracle.setAssetPrice(
      usdc.address,
      new BigNumber(usdcPrice.toString()).multipliedBy(1.15).toFixed(0)
    );

    const userGlobalData = await pool.getUserAccountData(user.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(oneEther, INVALID_HF);

    const {userData: wethUserDataBefore} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {
      reserveData: usdcReserveDataBefore,
      userData: usdcUserDataBefore,
    } = await getContractsData(usdc.address, user.address, testEnv);

    const amountToRepay = usdcReserveDataBefore.totalBorrowsVariable.dividedBy(2).toFixed(0);

    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    await waitForTx(
      await pool
        .connect(liquidator.signer)
        .repayWithCollateral(
          weth.address,
          usdc.address,
          user.address,
          amountToRepay,
          mockSwapAdapter.address,
          '0x'
        )
    );
    const repayWithCollateralTimestamp = await timeLatest();

    const {userData: wethUserDataAfter} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {userData: usdcUserDataAfter} = await getContractsData(
      usdc.address,
      user.address,
      testEnv
    );

    const collateralPrice = await oracle.getAssetPrice(weth.address);
    const principalPrice = await oracle.getAssetPrice(usdc.address);

    const collateralDecimals = (
      await pool.getReserveConfigurationData(weth.address)
    ).decimals.toString();
    const principalDecimals = (
      await pool.getReserveConfigurationData(usdc.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
      .times(new BigNumber(amountToRepay.toString()).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(
        new BigNumber(collateralPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
      )
      .div(100)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    const expectedVariableDebtIncrease = calcExpectedVariableDebtTokenBalance(
      usdcReserveDataBefore,
      usdcUserDataBefore,
      new BigNumber(repayWithCollateralTimestamp)
    ).minus(usdcUserDataBefore.currentVariableDebt);

    expect(usdcUserDataAfter.currentVariableDebt).to.be.bignumber.almostEqual(
      new BigNumber(usdcUserDataBefore.currentVariableDebt)
        .minus(amountToRepay.toString())
        .plus(expectedVariableDebtIncrease)
        .toString(),
      'INVALID_DEBT_POSITION'
    );

    expect(wethUserDataAfter.currentATokenBalance).to.be.bignumber.equal(
      new BigNumber(wethUserDataBefore.currentATokenBalance).minus(
        expectedCollateralLiquidated.toString()
      ),
      'INVALID_COLLATERAL_POSITION'
    );
    expect(wethUserDataAfter.usageAsCollateralEnabled).to.be.true;

    // Resets USDC Price
    await oracle.setAssetPrice(usdc.address, usdcPrice);
  });

  it('Revert expected. User 5 tries to liquidate an User 3 collateral a currency he havent borrow', async () => {
    const {pool, weth, dai, users, oracle, mockSwapAdapter, usdc} = testEnv;
    const user = users[2];
    const liquidator = users[4];

    const amountToRepay = parseUnits('10', 6);

    // Sets USDC Price higher to decrease health factor below 1
    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    await oracle.setAssetPrice(
      usdc.address,
      new BigNumber(usdcPrice.toString()).multipliedBy(6.4).toFixed(0)
    );
    const userGlobalData = await pool.getUserAccountData(user.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(oneEther, INVALID_HF);

    await expect(
      pool
        .connect(liquidator.signer)
        .repayWithCollateral(
          weth.address,
          dai.address,
          user.address,
          amountToRepay,
          mockSwapAdapter.address,
          '0x'
        )
    ).to.be.revertedWith('40');

    await oracle.setAssetPrice(usdc.address, usdcPrice);
  });

  it('User 5 liquidates all the USDC loan of User 3 by swapping his WETH collateral', async () => {
    const {pool, weth, usdc, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[2];
    const liquidator = users[4];
    // Sets USDC Price higher to decrease health factor below 1
    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    await oracle.setAssetPrice(
      usdc.address,
      new BigNumber(usdcPrice.toString()).multipliedBy(1.35).toFixed(0)
    );

    const userGlobalData = await pool.getUserAccountData(user.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(oneEther, INVALID_HF);

    const {userData: wethUserDataBefore} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {
      reserveData: usdcReserveDataBefore,
      userData: usdcUserDataBefore,
    } = await getContractsData(usdc.address, user.address, testEnv);

    const amountToRepay = usdcReserveDataBefore.totalBorrowsVariable.toFixed(0);

    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    await waitForTx(
      await pool
        .connect(liquidator.signer)
        .repayWithCollateral(
          weth.address,
          usdc.address,
          user.address,
          amountToRepay,
          mockSwapAdapter.address,
          '0x'
        )
    );
    const repayWithCollateralTimestamp = await timeLatest();

    const {userData: wethUserDataAfter} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {userData: usdcUserDataAfter} = await getContractsData(
      usdc.address,
      user.address,
      testEnv
    );

    const collateralPrice = await oracle.getAssetPrice(weth.address);
    const principalPrice = await oracle.getAssetPrice(usdc.address);

    const collateralDecimals = (
      await pool.getReserveConfigurationData(weth.address)
    ).decimals.toString();
    const principalDecimals = (
      await pool.getReserveConfigurationData(usdc.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
      .times(new BigNumber(amountToRepay.toString()).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(
        new BigNumber(collateralPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
      )
      .div(100)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    const expectedVariableDebtIncrease = calcExpectedVariableDebtTokenBalance(
      usdcReserveDataBefore,
      usdcUserDataBefore,
      new BigNumber(repayWithCollateralTimestamp)
    ).minus(usdcUserDataBefore.currentVariableDebt);

    expect(usdcUserDataAfter.currentVariableDebt).to.be.bignumber.almostEqual(
      new BigNumber(usdcUserDataBefore.currentVariableDebt)
        .minus(amountToRepay.toString())
        .plus(expectedVariableDebtIncrease)
        .toString(),
      'INVALID_DEBT_POSITION'
    );

    expect(wethUserDataAfter.currentATokenBalance).to.be.bignumber.equal(
      new BigNumber(wethUserDataBefore.currentATokenBalance).minus(
        expectedCollateralLiquidated.toString()
      ),
      'INVALID_COLLATERAL_POSITION'
    );

    // Resets USDC Price
    await oracle.setAssetPrice(usdc.address, usdcPrice);
  });

  it('User 2 deposit WETH and borrows DAI at Variable', async () => {
    const {pool, weth, dai, users, oracle} = testEnv;
    const user = users[1];
    const amountToDeposit = ethers.utils.parseEther('2');

    await weth.connect(user.signer).mint(amountToDeposit);

    await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool.connect(user.signer).deposit(weth.address, amountToDeposit, user.address, '0');

    const userGlobalData = await pool.getUserAccountData(user.address);

    const daiPrice = await oracle.getAssetPrice(dai.address);

    const amountDAIToBorrow = await convertToCurrencyDecimals(
      dai.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(daiPrice.toString())
        .multipliedBy(0.9)
        .toFixed(0)
    );

    await pool.connect(user.signer).borrow(dai.address, amountDAIToBorrow, 2, 0, user.address);
  });

  it('It is not possible to do reentrancy on repayWithCollateral()', async () => {
    const {pool, weth, dai, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[1];
    const liquidator = users[4];

    // Sets DAI Price higher to decrease health factor below 1
    const daiPrice = await oracle.getAssetPrice(dai.address);

    await oracle.setAssetPrice(
      dai.address,
      new BigNumber(daiPrice.toString()).multipliedBy(1.4).toFixed(0)
    );

    const {reserveData: daiReserveDataBefore} = await getContractsData(
      dai.address,
      user.address,
      testEnv
    );

    const amountToRepay = daiReserveDataBefore.totalBorrowsVariable.toString();

    await waitForTx(await mockSwapAdapter.setTryReentrancy(true));

    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    await expect(
      pool
        .connect(liquidator.signer)
        .repayWithCollateral(
          weth.address,
          dai.address,
          user.address,
          amountToRepay,
          mockSwapAdapter.address,
          '0x'
        )
    ).to.be.revertedWith('53');

    // Resets DAI Price
    await oracle.setAssetPrice(dai.address, daiPrice);
    // Resets mock
    await waitForTx(await mockSwapAdapter.setTryReentrancy(false));
  });

  it('User 5 tries to liquidate  User 2 DAI Variable loan using his WETH collateral, with good HF', async () => {
    const {pool, weth, dai, users, mockSwapAdapter} = testEnv;
    const user = users[1];
    const liquidator = users[4];

    const {reserveData: daiReserveDataBefore} = await getContractsData(
      dai.address,
      user.address,
      testEnv
    );

    // First half
    const amountToRepay = daiReserveDataBefore.totalBorrowsVariable.dividedBy(2).toString();

    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    await expect(
      pool
        .connect(liquidator.signer)
        .repayWithCollateral(
          weth.address,
          dai.address,
          user.address,
          amountToRepay,
          mockSwapAdapter.address,
          '0x'
        )
    ).to.be.revertedWith('38');
  });
  it('User 5 liquidates User 2 DAI Variable loan using his WETH collateral, half the amount', async () => {
    const {pool, weth, dai, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[1];
    const liquidator = users[4];

    // Sets DAI Price higher to decrease health factor below 1
    const daiPrice = await oracle.getAssetPrice(dai.address);

    await oracle.setAssetPrice(
      dai.address,
      new BigNumber(daiPrice.toString()).multipliedBy(1.4).toFixed(0)
    );

    const userGlobalData = await pool.getUserAccountData(user.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(oneEther, INVALID_HF);

    const {userData: wethUserDataBefore} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {reserveData: daiReserveDataBefore, userData: daiUserDataBefore} = await getContractsData(
      dai.address,
      user.address,
      testEnv
    );

    // First half
    const amountToRepay = daiReserveDataBefore.totalBorrowsVariable.multipliedBy(0.6).toString();

    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    await waitForTx(
      await pool
        .connect(liquidator.signer)
        .repayWithCollateral(
          weth.address,
          dai.address,
          user.address,
          amountToRepay,
          mockSwapAdapter.address,
          '0x'
        )
    );
    const repayWithCollateralTimestamp = await timeLatest();

    const {userData: wethUserDataAfter} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {userData: daiUserDataAfter} = await getContractsData(dai.address, user.address, testEnv);

    const collateralPrice = await oracle.getAssetPrice(weth.address);
    const principalPrice = await oracle.getAssetPrice(dai.address);

    const collateralDecimals = (
      await pool.getReserveConfigurationData(weth.address)
    ).decimals.toString();
    const principalDecimals = (
      await pool.getReserveConfigurationData(dai.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
      .times(new BigNumber(amountToRepay.toString()).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(
        new BigNumber(collateralPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
      )
      .div(100)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    const expectedVariableDebtIncrease = calcExpectedVariableDebtTokenBalance(
      daiReserveDataBefore,
      daiUserDataBefore,
      new BigNumber(repayWithCollateralTimestamp)
    ).minus(daiUserDataBefore.currentVariableDebt);

    expect(daiUserDataAfter.currentVariableDebt).to.be.bignumber.almostEqual(
      new BigNumber(daiUserDataBefore.currentVariableDebt)
        .minus(amountToRepay.toString())
        .plus(expectedVariableDebtIncrease)
        .toString()
    );

    expect(wethUserDataAfter.currentATokenBalance).to.be.bignumber.equal(
      new BigNumber(wethUserDataBefore.currentATokenBalance).minus(
        expectedCollateralLiquidated.toString()
      )
    );
    expect(wethUserDataAfter.usageAsCollateralEnabled).to.be.true;

    // Resets DAI price
    await oracle.setAssetPrice(dai.address, daiPrice);
  });

  it('User 2 tries to repay remaining DAI Variable loan using his WETH collateral', async () => {
    const {pool, weth, dai, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[1];

    const {userData: wethUserDataBefore} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {reserveData: daiReserveDataBefore, userData: daiUserDataBefore} = await getContractsData(
      dai.address,
      user.address,
      testEnv
    );

    await increaseTime(1000);
    // Repay the remaining DAI
    const amountToRepay = daiReserveDataBefore.totalBorrowsVariable.toString();

    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    const receipt = await waitForTx(
      await pool
        .connect(user.signer)
        .repayWithCollateral(
          weth.address,
          dai.address,
          user.address,
          amountToRepay,
          mockSwapAdapter.address,
          '0x'
        )
    );
    const repayWithCollateralTimestamp = (await BRE.ethers.provider.getBlock(receipt.blockNumber))
      .timestamp;

    const {userData: wethUserDataAfter} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {userData: daiUserDataAfter} = await getContractsData(dai.address, user.address, testEnv);

    const collateralPrice = await oracle.getAssetPrice(weth.address);
    const principalPrice = await oracle.getAssetPrice(dai.address);

    const collateralDecimals = (
      await pool.getReserveConfigurationData(weth.address)
    ).decimals.toString();
    const principalDecimals = (
      await pool.getReserveConfigurationData(dai.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
      .times(new BigNumber(amountToRepay.toString()).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(
        new BigNumber(collateralPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
      )
      .div(100)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    const expectedVariableDebtIncrease = calcExpectedVariableDebtTokenBalance(
      daiReserveDataBefore,
      daiUserDataBefore,
      new BigNumber(repayWithCollateralTimestamp)
    ).minus(daiUserDataBefore.currentVariableDebt);

    expect(daiUserDataAfter.currentVariableDebt).to.be.bignumber.almostEqual(
      new BigNumber(daiUserDataBefore.currentVariableDebt)
        .minus(amountToRepay.toString())
        .plus(expectedVariableDebtIncrease)
        .toString()
    );

    expect(
      new BigNumber(wethUserDataBefore.currentATokenBalance).minus(
        expectedCollateralLiquidated.toString()
      )
    ).to.be.bignumber.equal(wethUserDataAfter.currentATokenBalance);
  });

  it('Liquidator tries to repay 4 user a bigger amount that what can be swapped of a particular collateral, repaying only the maximum allowed by that collateral', async () => {
    const {pool, weth, dai, usdc, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[3];
    const liquidator = users[5];

    const amountToDepositWeth = parseEther('0.1');
    const amountToDepositDAI = parseEther('500');
    const amountToBorrowVariable = parseUnits('80', '6');

    await weth.connect(user.signer).mint(amountToDepositWeth);
    await dai.connect(user.signer).mint(amountToDepositDAI);
    await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await dai.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool.connect(user.signer).deposit(weth.address, amountToDepositWeth, user.address, '0');
    await pool.connect(user.signer).deposit(dai.address, amountToDepositDAI, user.address, '0');

    await pool
      .connect(user.signer)
      .borrow(usdc.address, amountToBorrowVariable, 2, 0, user.address);

    const amountToRepay = amountToBorrowVariable;

    const {userData: wethUserDataBefore} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {
      reserveData: usdcReserveDataBefore,
      userData: usdcUserDataBefore,
    } = await getContractsData(usdc.address, user.address, testEnv);

    // Set HF below 1
    const daiPrice = await oracle.getAssetPrice(dai.address);
    await oracle.setAssetPrice(
      dai.address,
      new BigNumber(daiPrice.toString()).multipliedBy(0.1).toFixed(0)
    );
    const userGlobalDataPrior = await pool.getUserAccountData(user.address);
    expect(userGlobalDataPrior.healthFactor.toString()).to.be.bignumber.lt(oneEther, INVALID_HF);

    // Execute liquidation
    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    await waitForTx(
      await pool
        .connect(liquidator.signer)
        .repayWithCollateral(
          weth.address,
          usdc.address,
          user.address,
          amountToRepay,
          mockSwapAdapter.address,
          '0x'
        )
    );
    const repayWithCollateralTimestamp = await timeLatest();

    const {userData: wethUserDataAfter} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {userData: usdcUserDataAfter} = await getContractsData(
      usdc.address,
      user.address,
      testEnv
    );

    const collateralPrice = await oracle.getAssetPrice(weth.address);
    const principalPrice = await oracle.getAssetPrice(usdc.address);

    const collateralConfig = await pool.getReserveConfigurationData(weth.address);

    const collateralDecimals = collateralConfig.decimals.toString();
    const principalDecimals = (
      await pool.getReserveConfigurationData(usdc.address)
    ).decimals.toString();
    const collateralLiquidationBonus = collateralConfig.liquidationBonus.toString();

    const expectedDebtCovered = new BigNumber(collateralPrice.toString())
      .times(new BigNumber(wethUserDataBefore.currentATokenBalance.toString()))
      .times(new BigNumber(10).pow(principalDecimals))
      .div(
        new BigNumber(principalPrice.toString()).times(new BigNumber(10).pow(collateralDecimals))
      )
      .div(new BigNumber(collateralLiquidationBonus).div(10000).toString())
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    const expectedVariableDebtIncrease = calcExpectedVariableDebtTokenBalance(
      usdcReserveDataBefore,
      usdcUserDataBefore,
      new BigNumber(repayWithCollateralTimestamp)
    ).minus(usdcUserDataBefore.currentVariableDebt);

    expect(usdcUserDataAfter.currentVariableDebt).to.be.bignumber.equal(
      new BigNumber(usdcUserDataBefore.currentVariableDebt)
        .minus(expectedDebtCovered.toString())
        .plus(expectedVariableDebtIncrease),
      'INVALID_VARIABLE_DEBT_POSITION'
    );

    expect(wethUserDataAfter.usageAsCollateralEnabled).to.be.false;

    expect(wethUserDataAfter.currentATokenBalance).to.be.bignumber.equal(0);

    // Resets DAI Price
    await oracle.setAssetPrice(dai.address, daiPrice);
  });

  it('User 5 deposits WETH and DAI, then borrows USDC at Variable, then disables WETH as collateral', async () => {
    const {pool, weth, dai, usdc, users} = testEnv;
    const user = users[4];
    const amountWETHToDeposit = parseEther('10');
    const amountDAIToDeposit = parseEther('60');
    const amountToBorrow = parseUnits('65', 6);

    await weth.connect(user.signer).mint(amountWETHToDeposit);
    await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await pool.connect(user.signer).deposit(weth.address, amountWETHToDeposit, user.address, '0');

    await dai.connect(user.signer).mint(amountDAIToDeposit);
    await dai.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await pool.connect(user.signer).deposit(dai.address, amountDAIToDeposit, user.address, '0');

    await pool.connect(user.signer).borrow(usdc.address, amountToBorrow, 2, 0, user.address);
  });

  it('Liquidator tries to liquidates User 5 USDC loan by swapping his WETH collateral, should revert due WETH collateral disabled', async () => {
    const {pool, weth, usdc, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[4];
    const liquidator = users[5];

    const amountToRepay = parseUnits('65', 6);

    // User 5 Disable WETH as collateral
    await pool.connect(user.signer).setUserUseReserveAsCollateral(weth.address, false);

    const {userData: wethUserDataBefore} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {
      reserveData: usdcReserveDataBefore,
      userData: usdcUserDataBefore,
    } = await getContractsData(usdc.address, user.address, testEnv);

    expect(wethUserDataBefore.usageAsCollateralEnabled).to.be.false;

    // Liquidator should NOT be able to liquidate himself with WETH, even if is disabled
    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    await expect(
      pool
        .connect(liquidator.signer)
        .repayWithCollateral(
          weth.address,
          usdc.address,
          user.address,
          amountToRepay,
          mockSwapAdapter.address,
          '0x'
        )
    ).to.be.revertedWith(COLLATERAL_CANNOT_BE_LIQUIDATED);
    const repayWithCollateralTimestamp = await timeLatest();

    const {userData: wethUserDataAfter} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {userData: usdcUserDataAfter} = await getContractsData(
      usdc.address,
      user.address,
      testEnv
    );

    const expectedVariableDebtIncrease = calcExpectedVariableDebtTokenBalance(
      usdcReserveDataBefore,
      usdcUserDataBefore,
      new BigNumber(repayWithCollateralTimestamp)
    ).minus(usdcUserDataBefore.currentVariableDebt);

    expect(usdcUserDataAfter.currentVariableDebt).to.be.bignumber.almostEqual(
      new BigNumber(usdcUserDataBefore.currentVariableDebt)
        .plus(expectedVariableDebtIncrease)
        .toString(),
      'INVALID_DEBT_POSITION'
    );

    expect(wethUserDataAfter.usageAsCollateralEnabled).to.be.false;
  });
});
