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

    // validate that liquidator received correct amount of astETH (liquidationAmount * liquidationBonus)
    await asserts.astEthBalance(
      liquidator,
      new BigNumber(liquidationAmount).percentMul(LIQUIDATION_BONUS).toString()
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

    // validate that liquidator received correct amount of astETH (liquidationAmount * liquidationBonus)
    await asserts.astEthBalance(
      liquidator,
      new BigNumber(liquidationAmount).percentMul(LIQUIDATION_BONUS).toString()
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
    await asserts.astEthBalance(
      liquidator,
      new BigNumber(expectedLiquidationAmount)
        .dividedBy(0.8) // price drop
        .percentMul(LIQUIDATION_BONUS) // liquidation bonus
        .plus(HALF_EPSILON) // epsilon shift
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

  it('Realistic rebase scenario', async () => {
    const { stETH, weth, lenders, priceFeed, aave } = setup;
    const borrower = lenders.lenderB;
    const liquidator = lenders.lenderC;

    // borrower deposits stETH to use as collateral
    await borrower.depositStEth(wei`20.1 ether`);
    await asserts.astEthBalance(borrower, wei`20.1 ether`);

    const borrowAmount = wei`14 ether`;
    await borrower.borrowWethVariable(borrowAmount);

    // validate that health factor is above 1
    let borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(borrowerGlobalData.healthFactor.toString(), wei`1 ether`);

    // before negative rebase price drop happens (3%). It's still not enough to close positions
    await priceFeed.setPrice(wei`0.97 ether`);
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
    asserts.gte(
      new BigNumber(await liquidator.stEthBalance())
        .minus(liquidatorStEthBalanceBeforeLiquidation)
        .toFixed(0, 1),
      new BigNumber(expectedLiquidationAmount)
        .dividedBy(0.97) // price drop factor
        .percentMul(LIQUIDATION_BONUS) // liquidation bonus
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
