import {TestEnv, makeSuite} from './helpers/make-suite';
import {APPROVAL_AMOUNT_LENDING_POOL} from '../helpers/constants';
import {ethers} from 'ethers';
import BigNumber from 'bignumber.js';
import {
  calcExpectedVariableDebtTokenBalance,
  calcExpectedStableDebtTokenBalance,
} from './helpers/utils/calculations';
import {getContractsData} from './helpers/actions';
import {waitForTx} from './__setup.spec';
import {timeLatest} from '../helpers/misc-utils';
import {tEthereumAddress} from '../helpers/types';
import {parse} from 'path';

const {expect} = require('chai');
const {parseUnits, parseEther} = ethers.utils;

export const expectRepayWithCollateralEvent = (
  events: ethers.Event[],
  pool: tEthereumAddress,
  collateral: tEthereumAddress,
  borrowing: tEthereumAddress,
  user: tEthereumAddress
) => {
  if (!events || events.length < 16) {
    expect(false, 'INVALID_EVENTS_LENGTH_ON_REPAY_COLLATERAL');
  }

  const repayWithCollateralEvent = events[15];

  expect(repayWithCollateralEvent.address).to.be.equal(pool);
  expect(`0x${repayWithCollateralEvent.topics[1].slice(26)}`.toLowerCase()).to.be.equal(
    collateral.toLowerCase()
  );
  expect(`0x${repayWithCollateralEvent.topics[2].slice(26)}`).to.be.equal(borrowing.toLowerCase());
  expect(`0x${repayWithCollateralEvent.topics[3].slice(26)}`.toLowerCase()).to.be.equal(
    user.toLowerCase()
  );
};

makeSuite('LendingPool. repayWithCollateral()', (testEnv: TestEnv) => {
  it("It's not possible to repayWithCollateral() on a non-active collateral or a non active principal", async () => {
    const {configurator, weth, pool, users, dai, mockSwapAdapter} = testEnv;
    const user = users[1];
    await configurator.deactivateReserve(weth.address);

    await expect(
      pool
        .connect(user.signer)
        .repayWithCollateral(
          weth.address,
          dai.address,
          user.address,
          parseEther('100'),
          mockSwapAdapter.address,
          '0x'
        )
    ).to.be.revertedWith('2');

    await configurator.activateReserve(weth.address);

    await configurator.deactivateReserve(dai.address);

    await expect(
      pool
        .connect(user.signer)
        .repayWithCollateral(
          weth.address,
          dai.address,
          user.address,
          parseEther('100'),
          mockSwapAdapter.address,
          '0x'
        )
    ).to.be.revertedWith('2');

    await configurator.activateReserve(dai.address);
  });

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

  it('User 2 deposit WETH and borrows DAI at Variable', async () => {
    const {pool, weth, dai, users} = testEnv;
    const user = users[1];
    const amountToDeposit = ethers.utils.parseEther('1');
    const amountToBorrow = ethers.utils.parseEther('20');

    await weth.connect(user.signer).mint(amountToDeposit);

    await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool.connect(user.signer).deposit(weth.address, amountToDeposit, user.address, '0');

    await pool.connect(user.signer).borrow(dai.address, amountToBorrow, 2, 0);
  });

  it('It is not possible to do reentrancy on repayWithCollateral()', async () => {
    const {pool, weth, dai, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[1];

    const amountToRepay = parseEther('10');

    await waitForTx(await mockSwapAdapter.setTryReentrancy(true));

    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    await expect(
      pool
        .connect(user.signer)
        .repayWithCollateral(
          weth.address,
          dai.address,
          user.address,
          amountToRepay,
          mockSwapAdapter.address,
          '0x'
        )
    ).to.be.revertedWith('53');
  });

  it('User 2 tries to repay his DAI Variable loan using his WETH collateral. First half the amount, after that, the rest', async () => {
    const {pool, weth, dai, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[1];

    const amountToRepay = parseEther('10');

    await waitForTx(await mockSwapAdapter.setTryReentrancy(false));

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

    expect(wethUserDataAfter.usageAsCollateralEnabled).to.be.true;
  });

  it('User 3 deposits WETH and borrows USDC at Variable', async () => {
    const {pool, weth, usdc, users} = testEnv;
    const user = users[2];
    const amountToDeposit = parseEther('10');
    const amountToBorrow = parseUnits('40', 6);

    await weth.connect(user.signer).mint(amountToDeposit);

    await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool.connect(user.signer).deposit(weth.address, amountToDeposit, user.address, '0');

    await pool.connect(user.signer).borrow(usdc.address, amountToBorrow, 2, 0);
  });

  it('User 3 repays completely his USDC loan by swapping his WETH collateral', async () => {
    const {pool, weth, usdc, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[2];

    const amountToRepay = parseUnits('10', 6);

    const {userData: wethUserDataBefore} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {
      reserveData: usdcReserveDataBefore,
      userData: usdcUserDataBefore,
    } = await getContractsData(usdc.address, user.address, testEnv);

    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    await waitForTx(
      await pool
        .connect(user.signer)
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
  });

  it('Revert expected. User 3 tries to repay with his collateral a currency he havent borrow', async () => {
    const {pool, weth, dai, users, mockSwapAdapter} = testEnv;
    const user = users[2];

    const amountToRepay = parseUnits('10', 6);

    await expect(
      pool
        .connect(user.signer)
        .repayWithCollateral(
          weth.address,
          dai.address,
          user.address,
          amountToRepay,
          mockSwapAdapter.address,
          '0x'
        )
    ).to.be.revertedWith('40');
  });

  it('User 3 tries to repay with his collateral all his variable debt and part of the stable', async () => {
    const {pool, weth, usdc, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[2];

    const amountToDeposit = parseEther('20');
    const amountToBorrowStable = parseUnits('40', 6);
    const amountToBorrowVariable = parseUnits('40', 6);

    await weth.connect(user.signer).mint(amountToDeposit);

    await pool.connect(user.signer).deposit(weth.address, amountToDeposit, user.address, '0');

    await pool.connect(user.signer).borrow(usdc.address, amountToBorrowVariable, 2, 0);

    await pool.connect(user.signer).borrow(usdc.address, amountToBorrowStable, 1, 0);

    const amountToRepay = parseUnits('80', 6);

    const {userData: wethUserDataBefore} = await getContractsData(
      weth.address,
      user.address,
      testEnv
    );

    const {
      reserveData: usdcReserveDataBefore,
      userData: usdcUserDataBefore,
    } = await getContractsData(usdc.address, user.address, testEnv);

    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    const txReceipt = await waitForTx(
      await pool
        .connect(user.signer)
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

    expect(wethUserDataAfter.usageAsCollateralEnabled).to.be.true;
  });

  it('User 4 tries to repay a bigger amount that what can be swapped of a particular collateral, repaying only the maximum allowed by that collateral', async () => {
    const {pool, weth, dai, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[3];

    const amountToDepositWeth = parseEther('0.1');
    const amountToDepositDAI = parseEther('500');
    const amountToBorrowVariable = parseEther('80');

    await weth.connect(user.signer).mint(amountToDepositWeth);
    await dai.connect(user.signer).mint(amountToDepositDAI);
    await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await dai.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool.connect(user.signer).deposit(weth.address, amountToDepositWeth, user.address, '0');
    await pool.connect(user.signer).deposit(dai.address, amountToDepositDAI, user.address, '0');

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

    expect(wethUserDataAfter.usageAsCollateralEnabled).to.be.false;
  });

  it('User 5 deposits WETH and DAI, then borrows USDC at Variable, then disables WETH as collateral', async () => {
    const {pool, weth, dai, usdc, users} = testEnv;
    const user = users[4];
    const amountWETHToDeposit = parseEther('10');
    const amountDAIToDeposit = parseEther('120');
    const amountToBorrow = parseUnits('65', 6);

    await weth.connect(user.signer).mint(amountWETHToDeposit);
    await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await pool.connect(user.signer).deposit(weth.address, amountWETHToDeposit, user.address, '0');

    await dai.connect(user.signer).mint(amountDAIToDeposit);
    await dai.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await pool.connect(user.signer).deposit(dai.address, amountDAIToDeposit, user.address, '0');

    await pool.connect(user.signer).borrow(usdc.address, amountToBorrow, 2, 0);
  });

  it('User 5 tries to repay his USDC loan by swapping his WETH collateral, should not revert even with WETH collateral disabled', async () => {
    const {pool, weth, usdc, users, mockSwapAdapter, oracle} = testEnv;
    const user = users[4];

    const amountToRepay = parseUnits('65', 6);

    // Disable WETH as collateral
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

    // User 5 should be able to liquidate himself with WETH, even if is disabled
    await mockSwapAdapter.setAmountToReturn(amountToRepay);
    expect(
      await pool
        .connect(user.signer)
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

    expect(wethUserDataAfter.usageAsCollateralEnabled).to.be.false;
  });
});
