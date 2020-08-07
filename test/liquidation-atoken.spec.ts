import BigNumber from 'bignumber.js';

import {BRE} from '../helpers/misc-utils';
import {APPROVAL_AMOUNT_LENDING_POOL, MOCK_ETH_ADDRESS, oneEther} from '../helpers/constants';
import {convertToCurrencyDecimals} from '../helpers/contracts-helpers';
import {makeSuite} from './helpers/make-suite';
import {ProtocolErrors, RateMode} from '../helpers/types';
import {calcExpectedVariableDebtTokenBalance} from './helpers/utils/calculations';
import {getUserData, getReserveData} from './helpers/utils/helpers';

const chai = require('chai');
chai.use(require('chai-bignumber')());
const {expect} = chai;

makeSuite('LendingPool liquidation - liquidator receiving aToken', (testEnv) => {
  const {
    HF_IS_NOT_BELLOW_THRESHOLD,
    INVALID_HF,
    USER_DID_NOT_BORROW_SPECIFIED,
    THE_COLLATERAL_CHOSEN_CANNOT_BE_LIQUIDATED,
  } = ProtocolErrors;

  it('LIQUIDATION - Deposits ETH, borrows DAI/Check liquidation fails because health factor is above 1', async () => {
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
    await pool
      .connect(borrower.signer)
      .deposit(MOCK_ETH_ADDRESS, amountETHtoDeposit, '0', {value: amountETHtoDeposit});

    await pool.connect(borrower.signer).deposit(MOCK_ETH_ADDRESS, amountETHtoDeposit, '0', {
      value: amountETHtoDeposit,
    });

    //user 2 borrows
    const userGlobalData = await pool.getUserAccountData(borrower.address);
    const daiPrice = await oracle.getAssetPrice(dai.address);

    const amountDAIToBorrow = await convertToCurrencyDecimals(
      dai.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(daiPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(dai.address, amountDAIToBorrow, RateMode.Variable, '0');

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    expect(userGlobalDataAfter.currentLiquidationThreshold).to.be.bignumber.equal(
      '8000',
      'Invalid liquidation threshold'
    );

    //someone tries to liquidate user 2
    await expect(
      pool.liquidationCall(MOCK_ETH_ADDRESS, dai.address, borrower.address, 1, true)
    ).to.be.revertedWith(HF_IS_NOT_BELLOW_THRESHOLD);
  });

  it('LIQUIDATION - Drop the health factor below 1', async () => {
    const {dai, users, pool, oracle} = testEnv;
    const borrower = users[1];

    const daiPrice = await oracle.getAssetPrice(dai.address);

    await oracle.setAssetPrice(
      dai.address,
      new BigNumber(daiPrice.toString()).multipliedBy(1.15).toFixed(0)
    );

    const userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(oneEther, INVALID_HF);
  });

  it('LIQUIDATION - Tries to liquidate a different currency than the loan principal', async () => {
    const {pool, users} = testEnv;
    const borrower = users[1];
    //user 2 tries to borrow
    await expect(
      pool.liquidationCall(
        MOCK_ETH_ADDRESS,
        MOCK_ETH_ADDRESS,
        borrower.address,
        oneEther.toString(),
        true
      )
    ).revertedWith(USER_DID_NOT_BORROW_SPECIFIED);
  });

  it('LIQUIDATION - Tries to liquidate a different collateral than the borrower collateral', async () => {
    const {pool, dai, users} = testEnv;
    const borrower = users[1];

    await expect(
      pool.liquidationCall(dai.address, dai.address, borrower.address, oneEther.toString(), true)
    ).revertedWith(THE_COLLATERAL_CHOSEN_CANNOT_BE_LIQUIDATED);
  });

  it('LIQUIDATION - Liquidates the borrow', async () => {
    const {pool, dai, users, oracle} = testEnv;
    const borrower = users[1];

    //mints dai to the caller

    await dai.mint(await convertToCurrencyDecimals(dai.address, '1000'));

    //approve protocol to access depositor wallet
    await dai.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const daiReserveDataBefore = await getReserveData(pool, dai.address);
    const ethReserveDataBefore = await pool.getReserveData(MOCK_ETH_ADDRESS);

    const userReserveDataBefore = await getUserData(pool, dai.address, borrower.address);

    const amountToLiquidate = new BigNumber(userReserveDataBefore.currentVariableDebt.toString())
      .div(2)
      .toFixed(0);

    const tx = await pool.liquidationCall(
      MOCK_ETH_ADDRESS,
      dai.address,
      borrower.address,
      amountToLiquidate,
      true
    );

    const userReserveDataAfter = await pool.getUserReserveData(dai.address, borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    const daiReserveDataAfter = await pool.getReserveData(dai.address);
    const ethReserveDataAfter = await pool.getReserveData(MOCK_ETH_ADDRESS);

    const collateralPrice = (await oracle.getAssetPrice(MOCK_ETH_ADDRESS)).toString();
    const principalPrice = (await oracle.getAssetPrice(dai.address)).toString();

    const collateralDecimals = (
      await pool.getReserveConfigurationData(MOCK_ETH_ADDRESS)
    ).decimals.toString();
    const principalDecimals = (
      await pool.getReserveConfigurationData(dai.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice)
      .times(new BigNumber(amountToLiquidate).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(new BigNumber(collateralPrice).times(new BigNumber(10).pow(principalDecimals)))
      .decimalPlaces(0, BigNumber.ROUND_DOWN);

    if (!tx.blockNumber) {
      expect(false, 'Invalid block number');
      return;
    }

    const txTimestamp = new BigNumber(
      (await BRE.ethers.provider.getBlock(tx.blockNumber)).timestamp
    );

    const variableDebtBeforeTx = calcExpectedVariableDebtTokenBalance(
      daiReserveDataBefore,
      userReserveDataBefore,
      txTimestamp
    );

    expect(userGlobalDataAfter.healthFactor.toString()).to.be.bignumber.gt(
      oneEther.toFixed(0),
      'Invalid health factor'
    );

    expect(userReserveDataAfter.currentVariableDebt).to.be.bignumber.almostEqual(
      new BigNumber(variableDebtBeforeTx).minus(amountToLiquidate).toFixed(0),
      'Invalid user borrow balance after liquidation'
    );

    expect(daiReserveDataAfter.availableLiquidity).to.be.bignumber.almostEqual(
      new BigNumber(daiReserveDataBefore.availableLiquidity.toString())
        .plus(amountToLiquidate)
        .toFixed(0),
      'Invalid principal available liquidity'
    );

    //the liquidity index of the principal reserve needs to be bigger than the index before
    expect(daiReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gt(
      daiReserveDataBefore.liquidityIndex.toString(),
      'Invalid liquidity index'
    );

    //the principal APY after a liquidation needs to be lower than the APY before
    expect(daiReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lt(
      daiReserveDataBefore.liquidityRate.toString(),
      'Invalid liquidity APY'
    );

    expect(ethReserveDataAfter.availableLiquidity).to.be.bignumber.almostEqual(
      new BigNumber(ethReserveDataBefore.availableLiquidity.toString()).toFixed(0),
      'Invalid collateral available liquidity'
    );
  });

  it('User 3 deposits 1000 USDC, user 4 1 ETH, user 4 borrows - drops HF, liquidates the borrow', async () => {
    const {users, pool, usdc, oracle, addressesProvider} = testEnv;
    const depositor = users[3];
    const borrower = users[4];
    //mints USDC to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 3 deposits 1000 USDC
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');

    await pool.connect(depositor.signer).deposit(usdc.address, amountUSDCtoDeposit, '0');

    //user 4 deposits 1 ETH
    const amountETHtoDeposit = await convertToCurrencyDecimals(MOCK_ETH_ADDRESS, '1');

    await pool.connect(borrower.signer).deposit(MOCK_ETH_ADDRESS, amountETHtoDeposit, '0', {
      value: amountETHtoDeposit,
    });

    //user 4 borrows
    const userGlobalData = await pool.getUserAccountData(borrower.address);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
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

    await usdc.mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const userReserveDataBefore = await pool.getUserReserveData(usdc.address, borrower.address);

    const usdcReserveDataBefore = await pool.getReserveData(usdc.address);
    const ethReserveDataBefore = await pool.getReserveData(MOCK_ETH_ADDRESS);

    const amountToLiquidate = new BigNumber(userReserveDataBefore.currentStableDebt.toString())
      .div(2)
      .toFixed(0);

    await pool.liquidationCall(
      MOCK_ETH_ADDRESS,
      usdc.address,
      borrower.address,
      amountToLiquidate,
      true
    );

    const userReserveDataAfter = await pool.getUserReserveData(usdc.address, borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    const usdcReserveDataAfter = await pool.getReserveData(usdc.address);
    const ethReserveDataAfter = await pool.getReserveData(MOCK_ETH_ADDRESS);

    const collateralPrice = (await oracle.getAssetPrice(MOCK_ETH_ADDRESS)).toString();
    const principalPrice = (await oracle.getAssetPrice(usdc.address)).toString();

    const collateralDecimals = (
      await pool.getReserveConfigurationData(MOCK_ETH_ADDRESS)
    ).decimals.toString();
    const principalDecimals = (
      await pool.getReserveConfigurationData(usdc.address)
    ).decimals.toString();

    const expectedCollateralLiquidated = new BigNumber(principalPrice)
      .times(new BigNumber(amountToLiquidate).times(105))
      .times(new BigNumber(10).pow(collateralDecimals))
      .div(new BigNumber(collateralPrice).times(new BigNumber(10).pow(principalDecimals)))
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
      new BigNumber(usdcReserveDataBefore.availableLiquidity.toString())
        .plus(amountToLiquidate)
        .toFixed(0),
      'Invalid principal available liquidity'
    );

    //the liquidity index of the principal reserve needs to be bigger than the index before
    expect(usdcReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gt(
      usdcReserveDataBefore.liquidityIndex.toString(),
      'Invalid liquidity index'
    );

    //the principal APY after a liquidation needs to be lower than the APY before
    expect(usdcReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lt(
      usdcReserveDataBefore.liquidityRate.toString(),
      'Invalid liquidity APY'
    );

    expect(ethReserveDataAfter.availableLiquidity).to.be.bignumber.almostEqual(
      new BigNumber(ethReserveDataBefore.availableLiquidity.toString()).toFixed(0),
      'Invalid collateral available liquidity'
    );
  });
});
