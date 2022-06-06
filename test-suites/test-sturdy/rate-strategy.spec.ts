import { TestEnv, makeSuite } from './helpers/make-suite';
import { deployDefaultReserveInterestRateStrategy } from '../../helpers/contracts-deployments';

import { APPROVAL_AMOUNT_LENDING_POOL, PERCENTAGE_FACTOR, RAY } from '../../helpers/constants';

import { rateStrategyStableTwo } from '../../markets/sturdy/rateStrategies';

import { strategyDAI } from '../../markets/sturdy/reservesConfigs';
import { AToken, DefaultReserveInterestRateStrategy, MintableERC20 } from '../../types';
import BigNumber from 'bignumber.js';
import './helpers/utils/math';

const { expect } = require('chai');

makeSuite('Interest rate strategy tests', (testEnv: TestEnv) => {
  let strategyInstance: DefaultReserveInterestRateStrategy;
  let dai: MintableERC20;
  let aDai: AToken;

  before(async () => {
    dai = testEnv.dai;
    aDai = testEnv.aDai;

    const { addressesProvider } = testEnv;

    strategyInstance = await deployDefaultReserveInterestRateStrategy(
      [
        addressesProvider.address,
        rateStrategyStableTwo.optimalUtilizationRate,
        rateStrategyStableTwo.baseVariableBorrowRate,
        rateStrategyStableTwo.variableRateSlope1,
        rateStrategyStableTwo.variableRateSlope2,
        rateStrategyStableTwo.stableRateSlope1,
        rateStrategyStableTwo.stableRateSlope2,
      ],
      false
    );
  });

  it('Checks rates at 0% utilization rate, empty reserve', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](dai.address, aDai.address, 0, 0, 0, 0, 0, strategyDAI.reserveFactor);

    expect(currentLiquidityRate.toString()).to.be.equal('0', 'Invalid liquidity rate');
    expect(currentStableBorrowRate.toString()).to.be.equal('0', 'Invalid stable rate');
    expect(currentVariableBorrowRate.toString()).to.be.equal(
      rateStrategyStableTwo.baseVariableBorrowRate,
      'Invalid variable rate'
    );
  });

  it('Checks rates at 80% utilization rate', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](
      dai.address,
      aDai.address,
      '200000000000000000',
      '0',
      '0',
      '800000000000000000',
      '0',
      strategyDAI.reserveFactor
    );

    const expectedVariableRate = new BigNumber(rateStrategyStableTwo.baseVariableBorrowRate).plus(
      rateStrategyStableTwo.variableRateSlope1
    );

    expect(currentLiquidityRate.toString()).to.be.equal(
      expectedVariableRate
        .times(0.8)
        .percentMul(new BigNumber(PERCENTAGE_FACTOR).minus(strategyDAI.reserveFactor))
        .toFixed(0),
      'Invalid liquidity rate'
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(
      expectedVariableRate.toFixed(0),
      'Invalid variable rate'
    );

    expect(currentStableBorrowRate.toString()).to.be.equal('0', 'Invalid stable rate');
  });

  it('Checks rates at 100% utilization rate', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](
      dai.address,
      aDai.address,
      '0',
      '0',
      '0',
      '800000000000000000',
      '0',
      strategyDAI.reserveFactor
    );

    const expectedVariableRate = new BigNumber(rateStrategyStableTwo.baseVariableBorrowRate)
      .plus(rateStrategyStableTwo.variableRateSlope1)
      .plus(rateStrategyStableTwo.variableRateSlope2);

    expect(currentLiquidityRate.toString()).to.be.equal(
      expectedVariableRate
        .percentMul(new BigNumber(PERCENTAGE_FACTOR).minus(strategyDAI.reserveFactor))
        .toFixed(0),
      'Invalid liquidity rate'
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(
      expectedVariableRate.toFixed(0),
      'Invalid variable rate'
    );

    expect(currentStableBorrowRate.toString()).to.be.equal('0', 'Invalid stable rate');
  });

  it('Checks rates at 100% utilization rate, 50% stable debt and 50% variable debt, with a 10% avg stable rate', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](
      dai.address,
      aDai.address,
      '0',
      '0',
      '400000000000000000',
      '400000000000000000',
      '100000000000000000000000000',
      strategyDAI.reserveFactor
    );

    const expectedVariableRate = new BigNumber(rateStrategyStableTwo.baseVariableBorrowRate)
      .plus(rateStrategyStableTwo.variableRateSlope1)
      .plus(rateStrategyStableTwo.variableRateSlope2);

    const expectedLiquidityRate = new BigNumber(
      currentVariableBorrowRate.add('100000000000000000000000000').div(2).toString()
    )
      .percentMul(new BigNumber(PERCENTAGE_FACTOR).minus(strategyDAI.reserveFactor))
      .toFixed(0);

    expect(currentLiquidityRate.toString()).to.be.equal(
      expectedLiquidityRate,
      'Invalid liquidity rate'
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(
      expectedVariableRate.toFixed(0),
      'Invalid variable rate'
    );

    expect(currentStableBorrowRate.toString()).to.be.equal('0', 'Invalid stable rate');
  });
});
