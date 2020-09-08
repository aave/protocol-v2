import {TestEnv, makeSuite} from './helpers/make-suite';
import {APPROVAL_AMOUNT_LENDING_POOL, oneEther} from '../helpers/constants';
import {ethers} from 'ethers';
import BigNumber from 'bignumber.js';
import {
  calcExpectedVariableDebtTokenBalance,
  calcExpectedStableDebtTokenBalance,
} from './helpers/utils/calculations';
import {getContractsData} from './helpers/actions';
import {waitForTx} from './__setup.spec';
import {timeLatest} from '../helpers/misc-utils';
import {tEthereumAddress, ProtocolErrors} from '../helpers/types';
import {convertToCurrencyDecimals} from '../helpers/contracts-helpers';

const {expect} = require('chai');
const {parseUnits, parseEther} = ethers.utils;

const expectRepayWithCollateralEvent = (
  events: ethers.Event[],
  pool: tEthereumAddress,
  collateral: tEthereumAddress,
  borrowing: tEthereumAddress,
  user: tEthereumAddress
) => {
  if (!events || events.length < 14) {
    expect(false, 'INVALID_EVENTS_LENGTH_ON_REPAY_COLLATERAL');
  }

  const repayWithCollateralEvent = events[13];

  expect(repayWithCollateralEvent.address).to.be.equal(pool);
  expect(`0x${repayWithCollateralEvent.topics[1].slice(26)}`.toLowerCase()).to.be.equal(
    collateral.toLowerCase()
  );
  expect(`0x${repayWithCollateralEvent.topics[2].slice(26)}`).to.be.equal(borrowing.toLowerCase());
  expect(`0x${repayWithCollateralEvent.topics[3].slice(26)}`.toLowerCase()).to.be.equal(
    user.toLowerCase()
  );
};

makeSuite('LendingPool. repayWithCollateral() with liquidator', (testEnv: TestEnv) => {
  const {INVALID_HF} = ProtocolErrors;

  it('User 1 provides some liquidity for others to borrow', async () => {
    const {pool, weth, dai, usdc} = testEnv;

    await weth.mint(parseEther('200'));
    await weth.approve(pool.address, parseEther('200'));
    await pool.deposit(weth.address, parseEther('200'), 0);
    await dai.mint(parseEther('20000'));
    await dai.approve(pool.address, parseEther('20000'));
    await pool.deposit(dai.address, parseEther('20000'), 0);
    await usdc.mint(parseEther('20000'));
    await usdc.approve(pool.address, parseEther('20000'));
    await pool.deposit(usdc.address, parseEther('20000'), 0);
  });

  it('User 5 liquidate User 3 collateral, all his variable debt and part of the stable', async () => {
    const {pool, weth, usdc, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[2];
    const liquidator = users[4];
    const amountToDeposit = parseEther('20');
    const amountToBorrow = parseUnits('40', 6);

    await weth.connect(user.signer).mint(amountToDeposit);

    await weth.connect(user.signer).approve(pool.address, amountToDeposit);
    await pool.connect(user.signer).deposit(weth.address, amountToDeposit, '0');

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    await pool.connect(user.signer).borrow(usdc.address, amountToBorrow, 2, 0);

    await pool.connect(user.signer).borrow(usdc.address, amountToBorrow, 1, 0);

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

    await pool.connect(user.signer).deposit(weth.address, amountToDeposit, '0');

    const userGlobalData = await pool.getUserAccountData(user.address);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await pool.connect(user.signer).borrow(usdc.address, amountUSDCToBorrow, 2, 0);
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
    ).to.be.revertedWith('revert CURRRENCY_NOT_BORROWED');

    await oracle.setAssetPrice(usdc.address, usdcPrice);
  });

  it('User 2 deposit WETH and borrows DAI at Variable', async () => {
    const {pool, weth, dai, users, oracle} = testEnv;
    const user = users[1];
    const amountToDeposit = ethers.utils.parseEther('1');

    await weth.connect(user.signer).mint(amountToDeposit);

    await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool.connect(user.signer).deposit(weth.address, amountToDeposit, '0');

    const userGlobalData = await pool.getUserAccountData(user.address);

    const daiPrice = await oracle.getAssetPrice(dai.address);

    const amountDAIToBorrow = await convertToCurrencyDecimals(
      dai.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(daiPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await pool.connect(user.signer).borrow(dai.address, amountDAIToBorrow, 2, 0);
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
    ).to.be.revertedWith('HEALTH_FACTOR_ABOVE_THRESHOLD');
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
    const amountToRepay = daiReserveDataBefore.totalBorrowsVariable.dividedBy(2).toString();

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

    // Repay the remaining DAI
    const amountToRepay = daiReserveDataBefore.totalBorrowsVariable.toString();

    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    await waitForTx(
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
  });

  it.skip('WIP Liquidator tries to repay 4 user a bigger amount that what can be swapped of a particular collateral, repaying only the maximum allowed by that collateral', async () => {
    const {pool, weth, dai, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[3];
    const liquidator = users[5];

    const amountToDepositWeth = parseEther('0.1');
    const amountToDepositDAI = parseEther('500');
    const amountToBorrowVariable = parseEther('80');

    await weth.connect(user.signer).mint(amountToDepositWeth);
    await dai.connect(user.signer).mint(amountToDepositDAI);
    await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await dai.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool.connect(user.signer).deposit(weth.address, amountToDepositWeth, '0');
    await pool.connect(user.signer).deposit(dai.address, amountToDepositDAI, '0');

    await pool.connect(user.signer).borrow(dai.address, amountToBorrowVariable, 2, 0);

    const amountToRepay = parseEther('80');

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
    const wethPrice = await oracle.getAssetPrice(weth.address);
    // Set HF below 1
    await oracle.setAssetPrice(
      weth.address,
      new BigNumber(wethPrice.toString()).multipliedBy(0.1).toFixed(0)
    );
    const userGlobalDataPrior = await pool.getUserAccountData(user.address);
    expect(userGlobalDataPrior.healthFactor.toString()).to.be.bignumber.lt(oneEther, INVALID_HF);
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

    const collateralConfig = await pool.getReserveConfigurationData(weth.address);

    const collateralDecimals = collateralConfig.decimals.toString();
    const principalDecimals = (
      await pool.getReserveConfigurationData(dai.address)
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
      daiReserveDataBefore,
      daiUserDataBefore,
      new BigNumber(repayWithCollateralTimestamp)
    ).minus(daiUserDataBefore.currentVariableDebt);

    expect(daiUserDataAfter.currentVariableDebt).to.be.bignumber.equal(
      new BigNumber(daiUserDataBefore.currentVariableDebt)
        .minus(expectedDebtCovered.toString())
        .plus(expectedVariableDebtIncrease),
      'INVALID_VARIABLE_DEBT_POSITION'
    );

    expect(wethUserDataAfter.currentATokenBalance).to.be.bignumber.equal(0);
    // Resets WETH Price
    await oracle.setAssetPrice(weth.address, wethPrice);
  });
});
