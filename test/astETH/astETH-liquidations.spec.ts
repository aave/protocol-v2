import { _TypedDataEncoder } from '@ethersproject/hash';
import BigNumber from 'bignumber.js';
import { MAX_UINT_AMOUNT } from '../../helpers/constants';
import { strategySTETH } from '../../markets/aave/reservesConfigs';
import asserts from './asserts';
import { wei } from './helpers';
import { setup } from './__setup.spec';

const EPSILON = '100000000000';
const HALF_EPSILON = '50000000000';
const LIQUIDATION_BONUS = new BigNumber(strategySTETH.liquidationBonus);

describe('AStETH Liquidation', function () {
  it('liquidation on negative rebase + stable debt', async () => {
    const { stETH, weth, lenders, aave } = setup;
    const borrower = lenders.lenderA;
    const liquidator = lenders.lenderB;

    // borrower deposits stETH to use as collateral
    await borrower.depositStEth(wei`7.5 ether`);
    await asserts.astEthBalance(borrower, wei`7.5 ether`);

    const borrowAmount = wei`5 ether`;
    await borrower.borrowWethStable(borrowAmount);

    // validate that health factor is above 1
    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(userGlobalData.healthFactor.toString(), wei`1 ether`, 'Health Factor Below 1');

    // negative rebase happens
    await setup.rebaseStETH(-0.12); // negative rebase 12%
    const userGlobalDataAfterRebase = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );

    // validate that after negative rebase health factor became below 1
    asserts.lt(
      userGlobalDataAfterRebase.healthFactor.toString(),
      wei`1 ether`,
      'Health Factor Above 1'
    );

    // validate liquidator had no astETH before liquidation
    await asserts.astEthBalance(liquidator, '0');

    // liquidator deposits 10 weth to make liquidation
    const liquidatorWethBalance = wei`10 ether`;
    await liquidator.weth.deposit({ value: liquidatorWethBalance });

    // set allowance for lending pool to withdraw WETH from liquidator
    const liquidationAmount = wei`1 ether`;
    await liquidator.weth.approve(liquidator.lendingPool.address, liquidationAmount);

    // liquidator liquidates 1 ether of debt of the borrower
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      liquidationAmount,
      true
    );

    // validate that was withdrawn correct amount of WETH from liquidator
    asserts.eq(
      await liquidator.wethBalance(),
      new BigNumber(liquidatorWethBalance).minus(liquidationAmount).toString()
    );

    // validate that liquidator received correct amount of astETH
    const currentStEthToEthPriceRatio = await setup.aave.priceOracle
      .getAssetPrice(setup.stETH.address)
      .then((price) => new BigNumber(price.toString()).dividedBy(wei`1 ether`));

    await asserts.astEthBalance(
      liquidator,
      new BigNumber(liquidationAmount)
        .percentMul(LIQUIDATION_BONUS)
        .dividedBy(currentStEthToEthPriceRatio)
        .toFixed(0, 1)
    );

    const [{ healthFactor }, { currentStableDebt }] = await Promise.all([
      borrower.lendingPool.getUserAccountData(borrower.address),
      aave.protocolDataProvider.getUserReserveData(weth.address, borrower.address),
    ]);
    // validate that health factor of borrower recovered
    asserts.gt(healthFactor.toString(), wei`1 ether`);
    // validate that were burned correct amount of debt tokens
    asserts.gte(
      currentStableDebt.toString(),
      new BigNumber(borrowAmount).minus(liquidationAmount).toString(),
      EPSILON
    );
  });

  it('liquidation on negative rebase + variable debt', async () => {
    const { stETH, weth, lenders, aave } = setup;
    const borrower = lenders.lenderA;
    const liquidator = lenders.lenderB;

    // borrower deposits stETH to use as collateral
    await borrower.depositStEth(wei`7.5 ether`);
    await asserts.astEthBalance(borrower, wei`7.5 ether`);

    const borrowAmount = wei`5 ether`;
    await borrower.borrowWethVariable(borrowAmount);

    // validate that health factor is above 1
    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(userGlobalData.healthFactor.toString(), wei`1 ether`);

    // negative rebase happens
    await setup.rebaseStETH(-0.12); // negative rebase 12%
    const userGlobalDataAfterRebase = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );

    // validate that after negative rebase health factor became below 1
    asserts.lt(userGlobalDataAfterRebase.healthFactor.toString(), wei`1 ether`);

    // validate liquidator had no astETH before liquidation
    await asserts.astEthBalance(liquidator, '0');

    // liquidator deposits 10 weth to make liquidation
    const liquidatorWethBalance = wei`10 ether`;
    await liquidator.weth.deposit({ value: liquidatorWethBalance });

    // set allowance for lending pool to withdraw WETH from liquidator
    const liquidationAmount = wei`1 ether`;
    await liquidator.weth.approve(liquidator.lendingPool.address, liquidationAmount);

    // liquidator liquidates 1 ether of debt of the borrower
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      liquidationAmount,
      true
    );

    // validate that was withdrawn correct amount of WETH from liquidator
    asserts.eq(
      await liquidator.wethBalance(),
      new BigNumber(liquidatorWethBalance).minus(liquidationAmount).toString()
    );

    // validate that liquidator received correct amount of astETH
    const currentStEthToEthPriceRatio = await setup.aave.priceOracle
      .getAssetPrice(setup.stETH.address)
      .then((price) => new BigNumber(price.toString()).dividedBy(wei`1 ether`));

    await asserts.astEthBalance(
      liquidator,
      new BigNumber(liquidationAmount)
        .percentMul(LIQUIDATION_BONUS)
        .dividedBy(currentStEthToEthPriceRatio)
        .toFixed(0, 1)
    );

    const [{ healthFactor }, { currentVariableDebt }] = await Promise.all([
      borrower.lendingPool.getUserAccountData(borrower.address),
      aave.protocolDataProvider.getUserReserveData(weth.address, borrower.address),
    ]);

    // validate that health factor of borrower recovered
    asserts.gt(healthFactor.toString(), wei`1 ether`);

    // validate that were burned correct amount of debt tokens

    asserts.gte(
      currentVariableDebt.toString(),
      new BigNumber(borrowAmount).minus(liquidationAmount).toString(),
      EPSILON
    );
  });

  it('liquidation on price drop + variable debt', async () => {
    const { stETH, weth, lenders, aave, priceFeed } = setup;
    const borrower = lenders.lenderA;
    const liquidator = lenders.lenderB;

    // borrower deposits stETH to use as collateral
    await borrower.depositStEth(wei`8 ether`);
    await asserts.astEthBalance(borrower, wei`8 ether`);

    const borrowAmount = wei`5 ether`;
    await borrower.borrowWethVariable(borrowAmount);

    // validate that health factor is above 1
    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(userGlobalData.healthFactor.toString(), wei`1 ether`);

    // stETH price drop happens
    await priceFeed.setPrice(wei`0.8 ether`); // price drop 20 %
    const userGlobalDataAfterRebase = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );

    // validate that after negative rebase health factor became below 1
    asserts.lt(userGlobalDataAfterRebase.healthFactor.toString(), wei`1 ether`);

    // validate liquidator had no astETH before liquidation
    await asserts.astEthBalance(liquidator, '0');

    // liquidator deposits 10 weth to make liquidation
    const liquidatorWethBalance = wei`10 ether`;
    await liquidator.weth.deposit({ value: liquidatorWethBalance });

    // set allowance for lending pool to withdraw WETH from liquidator
    const expectedLiquidationAmount = new BigNumber(borrowAmount).div(2).toFixed(0);
    await liquidator.weth.approve(
      liquidator.lendingPool.address,
      new BigNumber(expectedLiquidationAmount).plus(EPSILON).toFixed()
    );

    // liquidator liquidates max allowed amount of debt (50%) of the borrower
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      MAX_UINT_AMOUNT,
      true
    );

    // validate that was withdrawn correct amount of WETH from liquidator
    asserts.lte(
      await liquidator.wethBalance(),
      new BigNumber(liquidatorWethBalance).minus(expectedLiquidationAmount).toFixed(),
      EPSILON
    );

    // validate that liquidator received correct amount of astETH
    const currentStEthToEthPriceRatio = await setup.aave.priceOracle
      .getAssetPrice(setup.stETH.address)
      .then((price) => new BigNumber(price.toString()).dividedBy(wei`1 ether`));

    await asserts.astEthBalance(
      liquidator,
      new BigNumber(expectedLiquidationAmount)
        .dividedBy(currentStEthToEthPriceRatio)
        .percentMul(LIQUIDATION_BONUS)
        .plus(HALF_EPSILON)
        .toFixed(0, 1),
      HALF_EPSILON
    );

    const [{ healthFactor }, { currentVariableDebt }] = await Promise.all([
      borrower.lendingPool.getUserAccountData(borrower.address),
      aave.protocolDataProvider.getUserReserveData(weth.address, borrower.address),
    ]);

    // validate that health factor of borrower recovered
    asserts.gt(healthFactor.toString(), wei`1 ether`);

    // validate that were burned correct amount of debt tokens
    asserts.gte(
      currentVariableDebt.toString(),
      new BigNumber(borrowAmount).minus(expectedLiquidationAmount).toString(),
      EPSILON
    );
  });

  it('Liquidate all astETH collateral', async () => {
    const { stETH, weth, lenders, priceFeed, aave } = setup;
    const borrower = lenders.lenderB;
    const liquidator = lenders.lenderC;

    // borrower deposits stETH to use as collateral
    await borrower.depositStEth(wei`20 ether`);
    await asserts.astEthBalance(borrower, wei`20 ether`);

    const borrowAmount = wei`10 ether`;
    await borrower.borrowWethVariable(borrowAmount);

    // validate that health factor is above 1
    let borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(borrowerGlobalData.healthFactor.toString(), wei`1 ether`);

    // negative rebase happens (75%)
    await setup.rebaseStETH(-0.75);
    borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);

    // validate that after negative rebase health factor became below 1
    asserts.lt(borrowerGlobalData.healthFactor.toString(), wei`1 ether`);

    // validate that borrower astETH balance becomes almost equal (might be 1 wei less)
    // to max allowed liquidation amount
    const maxAllowedLiquidationAmount = new BigNumber(borrowAmount).div(2).toFixed(0);
    await asserts.astEthBalance(borrower, maxAllowedLiquidationAmount);

    // validate liquidator had no astETH before liquidation
    await asserts.astEthBalance(liquidator, '0');

    // liquidator deposits 8 weth to make liquidation
    const liquidatorWethBalance = wei`8 ether`;
    await liquidator.weth.deposit({ value: liquidatorWethBalance });

    // set allowance for lending pool to withdraw WETH from liquidator
    await liquidator.weth.approve(
      liquidator.lendingPool.address,
      new BigNumber(maxAllowedLiquidationAmount).plus(EPSILON).toFixed()
    );

    const currentStEthToEthPriceRatio = await setup.aave.priceOracle
      .getAssetPrice(setup.stETH.address)
      .then((price) => new BigNumber(price.toString()).dividedBy(wei`1 ether`));
    // In the current test case, astETH balance of borrower equal (or less on 1 wei) to borrowAmount / 2
    // actual debt of user is borrowAmount ether in WETH. Max theoretical amount of weth liquidator might
    // compensate 50 % of borrow (borrowAmount / 2), but in practice, liquidation can't be greater than
    // liquidator.astEthBalance() * currentStEthToEthPriceRatio / LIQUIDATION_BONUS.
    const expectedLiquidationAmount = new BigNumber(maxAllowedLiquidationAmount)
      .multipliedBy(currentStEthToEthPriceRatio)
      .percentDiv(LIQUIDATION_BONUS);

    // liquidator liquidates max allowed amount of debt (50%) of the borrower
    // and receives stETH in return
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      MAX_UINT_AMOUNT,
      true
    );

    // validate that was withdrawn correct amount of WETH from the liquidator.
    // Amount of WETH withdrawn from liquidator might be 1 wei less than borrowAmount / 2
    // because due to shares mechanics borrower might have on balance 1 wei less astETH
    asserts.gte(
      await liquidator.wethBalance(),
      new BigNumber(liquidatorWethBalance).minus(expectedLiquidationAmount).toFixed(0, 1)
    );

    // validate that liquidator received correct amount of astETH
    await asserts.astEthBalance(
      liquidator,
      new BigNumber(expectedLiquidationAmount)
        .dividedBy(currentStEthToEthPriceRatio)
        .percentMul(LIQUIDATION_BONUS)
        .toFixed(0, 1),
      '2'
    );

    const { currentVariableDebt } = await aave.protocolDataProvider.getUserReserveData(
      weth.address,
      borrower.address
    );

    // validate that were burned correct amount of debt tokens
    asserts.gte(
      currentVariableDebt.toString(),
      new BigNumber(borrowAmount).minus(expectedLiquidationAmount).toString(),
      EPSILON
    );
  });

  it('Realistic rebase scenario', async () => {
    const { stETH, weth, lenders, priceFeed, aave } = setup;
    const borrower = lenders.lenderB;
    const liquidator = lenders.lenderC;

    // borrower deposits stETH to use as collateral
    await borrower.depositStEth(wei`20.3 ether`);
    await asserts.astEthBalance(borrower, wei`20.3 ether`);

    const borrowAmount = wei`14 ether`;
    await borrower.borrowWethVariable(borrowAmount);

    // validate that health factor is above 1
    let borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(borrowerGlobalData.healthFactor.toString(), wei`1 ether`);

    // before negative rebase price drop happens (current price diff is 4%).
    // It's still not enough to close positions
    await priceFeed.setPrice(wei`0.96 ether`);
    borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(borrowerGlobalData.healthFactor.toString(), wei`1 ether`);

    // negative rebase happens (-5%)
    await setup.rebaseStETH(-0.05);
    borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);

    // validate that after negative rebase health factor became below 1
    asserts.lt(borrowerGlobalData.healthFactor.toString(), wei`1 ether`);

    // validate liquidator had no astETH before liquidation
    await asserts.astEthBalance(liquidator, '0');

    // liquidator deposits 8 weth to make liquidation
    const liquidatorWethBalance = wei`8 ether`;
    await liquidator.weth.deposit({ value: liquidatorWethBalance });

    // set allowance for lending pool to withdraw WETH from liquidator
    const expectedLiquidationAmount = new BigNumber(borrowAmount).div(2).toFixed(0);
    await liquidator.weth.approve(
      liquidator.lendingPool.address,
      new BigNumber(expectedLiquidationAmount).plus(EPSILON).toFixed()
    );

    // liquidator liquidates max allowed amount of debt (50%) of the borrower
    // and receives stETH in return
    const liquidatorStEthBalanceBeforeLiquidation = await liquidator.stEthBalance();
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      MAX_UINT_AMOUNT,
      false
    );

    // validate that was withdrawn correct amount of WETH from liquidator
    asserts.lte(
      await liquidator.wethBalance(),
      new BigNumber(liquidatorWethBalance).minus(expectedLiquidationAmount).toFixed(),
      EPSILON
    );

    // validate that liquidator received correct amount of stETH
    const currentStEthToEthPriceRatio = await setup.aave.priceOracle
      .getAssetPrice(setup.stETH.address)
      .then((price) => new BigNumber(price.toString()).dividedBy(wei`1 ether`));
    asserts.gte(
      new BigNumber(await liquidator.stEthBalance())
        .minus(liquidatorStEthBalanceBeforeLiquidation)
        .toFixed(0, 1),
      new BigNumber(expectedLiquidationAmount)
        .dividedBy(currentStEthToEthPriceRatio)
        .percentMul(LIQUIDATION_BONUS)
        .toFixed(0, 1),
      EPSILON
    );

    const [{ healthFactor }, { currentVariableDebt }] = await Promise.all([
      borrower.lendingPool.getUserAccountData(borrower.address),
      aave.protocolDataProvider.getUserReserveData(weth.address, borrower.address),
    ]);

    // validate that health factor of borrower recovered
    asserts.gt(healthFactor.toString(), wei`1 ether`);

    // validate that were burned correct amount of debt tokens
    asserts.gte(
      currentVariableDebt.toString(),
      new BigNumber(borrowAmount).minus(expectedLiquidationAmount).toString(),
      EPSILON
    );
  });
});
