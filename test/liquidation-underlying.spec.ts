import BigNumber from 'bignumber.js';

import {BRE} from '../helpers/misc-utils';
import {APPROVAL_AMOUNT_LENDING_POOL, MOCK_ETH_ADDRESS, oneEther} from '../helpers/constants';
import {convertToCurrencyDecimals} from '../helpers/contracts-helpers';
import {makeSuite} from './helpers/make-suite';
import {ProtocolErrors, RateMode} from '../helpers/types';
import {borrow} from './helpers/actions';
import {calcExpectedStableDebtTokenBalance} from './helpers/utils/calculations';
import { getUserData } from './helpers/utils/helpers';

const chai = require('chai');
chai.use(require('chai-bignumber')());

const {expect} = chai;

const almostEqual: any = function (this: any, expected: any, actual: any): any {
  this.assert(
    expected.plus(new BigNumber(1)).eq(actual) ||
      expected.plus(new BigNumber(2)).eq(actual) ||
      actual.plus(new BigNumber(1)).eq(expected) ||
      actual.plus(new BigNumber(2)).eq(expected) ||
      expected.eq(actual),
    'expected #{act} to be almost equal #{exp}',
    'expected #{act} to be different from #{exp}',
    expected.toString(),
    actual.toString()
  );
};

chai.use(function (chai: any, utils: any) {
  chai.Assertion.overwriteMethod('almostEqual', function (original: any) {
    return function (this: any, value: any) {
      if (utils.flag(this, 'bignumber')) {
        var expected = new BigNumber(value);
        var actual = new BigNumber(this._obj);
        almostEqual.apply(this, [expected, actual]);
      } else {
        original.apply(this, arguments);
      }
    };
  });
});

makeSuite('LendingPool liquidation - liquidator receiving the underlying asset', (testEnv) => {
  const {
    HF_IS_NOT_BELLOW_THRESHOLD,
    INVALID_HF,
    USER_DID_NOT_BORROW_SPECIFIED,
    INVALID_COLLATERAL_TO_LIQUIDATE,
  } = ProtocolErrors;

  it('LIQUIDATION - Deposits ETH, borrows DAI', async () => {
    const {dai, users, pool, oracle} = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    //mints DAI to depositor
    await dai.connect(depositor.signer).mint(await convertToCurrencyDecimals(dai.address, '1000'));

    //approve protocol to access depositor wallet
    await dai.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await pool.connect(depositor.signer).deposit(dai.address, amountDAItoDeposit, '0');
    //user 2 deposits 1 ETH
    const amountETHtoDeposit = await convertToCurrencyDecimals(MOCK_ETH_ADDRESS, '1');

    await pool.connect(borrower.signer).deposit(MOCK_ETH_ADDRESS, amountETHtoDeposit, '0', {
      value: amountETHtoDeposit,
    });

    //user 2 borrows

    const userGlobalData: any = await pool.getUserAccountData(borrower.address);
    const daiPrice = await oracle.getAssetPrice(dai.address);

    const amountDAIToBorrow = await convertToCurrencyDecimals(
      dai.address,
      new BigNumber(userGlobalData.availableBorrowsETH)
        .div(daiPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(dai.address, amountDAIToBorrow, RateMode.Stable, '0');

    const userGlobalDataAfter: any = await pool.getUserAccountData(borrower.address);

    expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
      '80',
      'Invalid liquidation threshold'
    );
  });

  it('LIQUIDATION - Drop the health factor below 1', async () => {
    const {dai, users, pool, oracle} = testEnv;
    const borrower = users[1];

    const daiPrice = await oracle.getAssetPrice(dai.address);

    await oracle.setAssetPrice(
      dai.address,
      new BigNumber(daiPrice.toString()).multipliedBy(1.25).toFixed(0)
    );

    const userGlobalData: any = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
      oneEther.toFixed(0),
      'Invalid health factor'
    );
  });

  it('LIQUIDATION - Liquidates the borrow', async () => {
    const {dai, users, pool, oracle} = testEnv;
    const liquidator = users[3];
    const borrower = users[1];

    //mints dai to the liquidator
    await dai.connect(liquidator.signer).mint(await convertToCurrencyDecimals(dai.address, '1000'));

    //approve protocol to access the liquidator wallet
    await dai.connect(liquidator.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);


    const daiReserveDataBefore: any = await pool.getReserveData(dai.address);
    const ethReserveDataBefore: any = await pool.getReserveData(MOCK_ETH_ADDRESS);

    const userReserveDataBefore: any = await getUserData(pool, dai.address, borrower.address);

    const amountToLiquidate = new BigNumber(userReserveDataBefore.currentStableDebt)
      .div(2)
      .toFixed(0);

    const tx = await pool
      .connect(liquidator.signer)
      .liquidationCall(MOCK_ETH_ADDRESS, dai.address, borrower.address, amountToLiquidate, false);

    const userReserveDataAfter: any = await getUserData(pool, dai.address, borrower.address);

    const daiReserveDataAfter: any = await pool.getReserveData(dai.address);
    const ethReserveDataAfter: any = await pool.getReserveData(MOCK_ETH_ADDRESS);

    const collateralPrice = await oracle.getAssetPrice(MOCK_ETH_ADDRESS);
    const principalPrice = await oracle.getAssetPrice(dai.address);

    const collateralDecimals = (
      await pool.getReserveConfigurationData(MOCK_ETH_ADDRESS)
    ).decimals.toString();
    const principalDecimals = (
      await pool.getReserveConfigurationData(dai.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
      .times(new BigNumber(amountToLiquidate).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(
        new BigNumber(collateralPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
      )
      .div(100)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    if (!tx.blockNumber) {
      expect(false, 'Invalid block number');
      return;
    }
    const txTimestamp = new BigNumber(
      (await BRE.ethers.provider.getBlock(tx.blockNumber)).timestamp
    );

    const stableDebtBeforeTx = calcExpectedStableDebtTokenBalance(
      userReserveDataBefore,
      txTimestamp.plus(2)
    );

    expect(userReserveDataAfter.currentStableDebt.toString()).to.be.bignumber.almostEqual(
      new BigNumber(stableDebtBeforeTx).minus(amountToLiquidate).toFixed(0),
      'Invalid user debt after liquidation'
    );

    expect(daiReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(daiReserveDataBefore.availableLiquidity).plus(amountToLiquidate).toFixed(0),
      'Invalid principal available liquidity'
    );

    expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(ethReserveDataBefore.availableLiquidity)
        .minus(expectedCollateralLiquidated)
        .toFixed(0),
      'Invalid collateral available liquidity'
    );
  });

  it('User 3 deposits 1000 USDC, user 4 1 ETH, user 4 borrows - drops HF, liquidates the borrow', async () => {
    const {usdc, users, pool, oracle, addressesProvider} = testEnv;

    const depositor = users[3];
    const borrower = users[4];
    const liquidator = users[5];

    //mints USDC to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //depositor deposits 1000 USDC
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');

    await pool.connect(depositor.signer).deposit(usdc.address, amountUSDCtoDeposit, '0');

    //borrower deposits 1 ETH
    const amountETHtoDeposit = await convertToCurrencyDecimals(MOCK_ETH_ADDRESS, '1');

    await pool.connect(borrower.signer).deposit(MOCK_ETH_ADDRESS, amountETHtoDeposit, '0', {
      value: amountETHtoDeposit,
    });

    //borrower borrows
    const userGlobalData: any = await pool.getUserAccountData(borrower.address);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH)
        .div(usdcPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Stable, '0');

    //drops HF below 1
    await oracle.setAssetPrice(
      usdc.address,
      new BigNumber(usdcPrice.toString()).multipliedBy(1.2).toFixed(0)
    );

    //mints dai to the liquidator

    await usdc
      .connect(liquidator.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(liquidator.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const userReserveDataBefore: any = await pool.getUserReserveData(
      usdc.address,
      borrower.address
    );

    const usdcReserveDataBefore: any = await pool.getReserveData(usdc.address);
    const ethReserveDataBefore: any = await pool.getReserveData(MOCK_ETH_ADDRESS);

    const amountToLiquidate = new BigNumber(userReserveDataBefore.currentStableDebt)
      .div(2)
      .decimalPlaces(0, BigNumber.ROUND_DOWN)
      .toFixed(0);

    await pool
      .connect(liquidator.signer)
      .liquidationCall(MOCK_ETH_ADDRESS, usdc.address, borrower.address, amountToLiquidate, false);

    const userReserveDataAfter: any = await pool.getUserReserveData(usdc.address, borrower.address);

    const userGlobalDataAfter: any = await pool.getUserAccountData(borrower.address);

    const usdcReserveDataAfter: any = await pool.getReserveData(usdc.address);
    const ethReserveDataAfter: any = await pool.getReserveData(MOCK_ETH_ADDRESS);

    const collateralPrice = await oracle.getAssetPrice(MOCK_ETH_ADDRESS);
    const principalPrice = await oracle.getAssetPrice(usdc.address);

    const collateralDecimals = (await pool.getReserveConfigurationData(MOCK_ETH_ADDRESS)).decimals.toString();
    const principalDecimals = (await pool.getReserveConfigurationData(usdc.address)).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
      .times(new BigNumber(amountToLiquidate).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(
        new BigNumber(collateralPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
      )
      .div(100)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    expect(userGlobalDataAfter.healthFactor.toString()).to.be.bignumber.gt(
      oneEther.toFixed(0),
      'Invalid health factor'
    );

    expect(userReserveDataAfter.currentStableDebt.toString()).to.be.bignumber.almostEqual(
      new BigNumber(userReserveDataBefore.currentStableDebt.toString())
        .minus(amountToLiquidate)
        .toFixed(0),
      'Invalid user borrow balance after liquidation'
    );

    expect(usdcReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(usdcReserveDataBefore.availableLiquidity).plus(amountToLiquidate).toFixed(0),
      'Invalid principal available liquidity'
    );

    expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(ethReserveDataBefore.availableLiquidity)
        .minus(expectedCollateralLiquidated)
        .toFixed(0),
      'Invalid collateral available liquidity'
    );
  });

  it('User 4 deposits 1000 LEND - drops HF, liquidates the LEND, which results on a lower amount being liquidated', async () => {
    const {lend, usdc, users, pool, oracle} = testEnv;

    const depositor = users[3];
    const borrower = users[4];
    const liquidator = users[5];

    //mints LEND to borrower
    await lend.connect(borrower.signer).mint(await convertToCurrencyDecimals(lend.address, '1000'));

    //approve protocol to access the borrower wallet
    await lend.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //borrower deposits 1000 LEND
    const amountLENDtoDeposit = await convertToCurrencyDecimals(lend.address, '1000');

    await pool.connect(borrower.signer).deposit(lend.address, amountLENDtoDeposit, '0');
    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    //drops HF below 1
    await oracle.setAssetPrice(
      usdc.address,
      new BigNumber(usdcPrice.toString()).multipliedBy(1.12).toFixed(0)
    );

    //mints usdc to the liquidator
    await usdc.connect(liquidator.signer).mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(liquidator.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const userReserveDataBefore: any = await pool.getUserReserveData(
      usdc.address,
      borrower.address
    );

    const usdcReserveDataBefore: any = await pool.getReserveData(usdc.address);
    const lendReserveDataBefore: any = await pool.getReserveData(lend.address);

    const amountToLiquidate = new BigNumber(userReserveDataBefore.currentStableDebt)
      .div(2)
      .decimalPlaces(0, BigNumber.ROUND_DOWN)
      .toFixed(0);

    const collateralPrice = await oracle.getAssetPrice(lend.address);
    const principalPrice = await oracle.getAssetPrice(usdc.address);

    await pool
      .connect(liquidator.signer)
      .liquidationCall(lend.address, usdc.address, borrower.address, amountToLiquidate, false);

    const userReserveDataAfter: any = await pool.getUserReserveData(usdc.address, borrower.address);

    const userGlobalDataAfter: any = await pool.getUserAccountData(borrower.address);

    const usdcReserveDataAfter: any = await pool.getReserveData(usdc.address);
    const lendReserveDataAfter: any = await pool.getReserveData(lend.address);

    const collateralDecimals = (await pool.getReserveConfigurationData(lend.address)).decimals.toString();
    const principalDecimals = (await pool.getReserveConfigurationData(usdc.address)).decimals.toString();

    const expectedCollateralLiquidated = oneEther.multipliedBy('1000');

    const liquidationBonus = (await pool.getReserveConfigurationData(lend.address)).liquidationBonus.toString();

    const expectedPrincipal = new BigNumber(collateralPrice.toString())
      .times(expectedCollateralLiquidated)
      .times(new BigNumber(10).pow(principalDecimals))
      .div(
        new BigNumber(principalPrice.toString()).times(new BigNumber(10).pow(collateralDecimals))
      )
      .times(100)
      .div(liquidationBonus.toString())
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    expect(userGlobalDataAfter.healthFactor.toString()).to.be.bignumber.gt(
      oneEther.toFixed(0),
      'Invalid health factor'
    );

    expect(userReserveDataAfter.currentStableDebt.toString()).to.be.bignumber.almostEqual(
      new BigNumber(userReserveDataBefore.currentStableDebt).minus(expectedPrincipal).toFixed(0),
      'Invalid user borrow balance after liquidation'
    );

    expect(usdcReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(usdcReserveDataBefore.availableLiquidity).plus(expectedPrincipal).toFixed(0),
      'Invalid principal available liquidity'
    );

    expect(lendReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(lendReserveDataBefore.availableLiquidity)
        .minus(expectedCollateralLiquidated)
        .toFixed(0),
      'Invalid collateral available liquidity'
    );
  });
});
