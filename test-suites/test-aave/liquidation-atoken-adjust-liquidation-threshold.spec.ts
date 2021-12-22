import BigNumber from 'bignumber.js';

import { DRE } from '../../helpers/misc-utils';
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { makeSuite } from './helpers/make-suite';
import { ProtocolErrors, RateMode } from '../../helpers/types';
import { calcExpectedVariableDebtTokenBalance } from './helpers/utils/calculations';
import { getUserData, getReserveData } from './helpers/utils/helpers';

const chai = require('chai');
const { expect } = chai;

makeSuite('LendingPool liquidation - liquidator receiving aToken', (testEnv) => {
  const {
    LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD,
    INVALID_HF,
    LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER,
    LPCM_COLLATERAL_CANNOT_BE_LIQUIDATED,
    LP_IS_PAUSED,
  } = ProtocolErrors;

  it('Check health factor liquidation threshold is not set in initial condition', async () => {
    const { deployer, users, liquidationThresholdManager } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    // With no deposit for both |depositor| and |borrower| both should have liquidation threshold
    // to be 0.
    var borrowerLiquidationThreshold =
      await liquidationThresholdManager.getHealthFactorLiquidationThreshold(borrower.address);
    var depositorLiquidationThreshold =
      await liquidationThresholdManager.getHealthFactorLiquidationThreshold(depositor.address);

    // Validate borrower liquidation threshold is unset.
    expect(new BigNumber(0).toString()).to.be.bignumber.equal(
      borrowerLiquidationThreshold.toString()
    );

    // Validate depositor liquidation threshold is unset.
    expect(new BigNumber(0).toString()).to.be.bignumber.equal(
      depositorLiquidationThreshold.toString()
    );

    // Set borrower liquidation threshold to 40000, and validate that it changed.
    await liquidationThresholdManager
      .connect(deployer.signer)
      .setHealthFactorLiquidationThreshold(borrower.address, 400000);
    borrowerLiquidationThreshold =
      await liquidationThresholdManager.getHealthFactorLiquidationThreshold(borrower.address);
    expect(new BigNumber(400000).toString()).to.be.bignumber.equal(
      borrowerLiquidationThreshold.toString()
    );

    // Depositor's liquidation threshold should still remain unset.
    depositorLiquidationThreshold =
      await liquidationThresholdManager.getHealthFactorLiquidationThreshold(depositor.address);
    expect(new BigNumber(0).toString()).to.be.bignumber.equal(
      depositorLiquidationThreshold.toString()
    );
  });

  it('Deposit will initialize liquidation threshold', async () => {
    const { dai, users, pool, liquidationThresholdManager } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    // With no deposit for both |depositor| and |borrower| both should have liquidation threshold
    // to be 0.
    // From previous test, |borrower|'s health factor liquidation threshold should be 400000, and
    // |depositor|'s health factor liquidation threshold should be 0.
    var borrowerLiquidationThreshold =
      await liquidationThresholdManager.getHealthFactorLiquidationThreshold(borrower.address);
    expect(new BigNumber(400000).toString()).to.be.bignumber.equal(
      borrowerLiquidationThreshold.toString()
    );
    var depositorLiquidationThreshold =
      await liquidationThresholdManager.getHealthFactorLiquidationThreshold(depositor.address);
    expect(new BigNumber(0).toString()).to.be.bignumber.equal(
      depositorLiquidationThreshold.toString()
    );
    
    // Mints 1000 DAI to borrower
    await dai.connect(borrower.signer).mint(await convertToCurrencyDecimals(dai.address, '1000'));
    //approve protocol to access borrower wallet
    await dai.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    // Mints 1000 DAI to depositor
    await dai.connect(depositor.signer).mint(await convertToCurrencyDecimals(dai.address, '1000'));
    //approve protocol to access depositor wallet
    await dai.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    // Borrower deposits 1000 DAI
    await pool
      .connect(borrower.signer)
      .deposit(dai.address, amountDAItoDeposit, borrower.address, '0');

    // Depositor deposits 1000 DAI
    await pool
      .connect(depositor.signer)
      .deposit(dai.address, amountDAItoDeposit, depositor.address, '0');

    // Deposit does not change borrower's liquidation threshold since it was already initialized.
    borrowerLiquidationThreshold =
      await liquidationThresholdManager.getHealthFactorLiquidationThreshold(borrower.address);
    expect(new BigNumber(400000).toString()).to.be.bignumber.equal(
      borrowerLiquidationThreshold.toString()
    );

    // Depositor should change depositor's liquidation threshold since it was not initialized
    // previously.
    depositorLiquidationThreshold =
      await liquidationThresholdManager.getHealthFactorLiquidationThreshold(depositor.address);
    expect(new BigNumber(oneEther).toString()).to.be.bignumber.equal(
      depositorLiquidationThreshold.toString()
    );
  });
});
