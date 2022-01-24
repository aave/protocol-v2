import { _TypedDataEncoder } from '@ethersproject/hash';
import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import { MAX_UINT_AMOUNT } from '../../helpers/constants';
import { RateMode } from '../../helpers/types';
import asserts from './asserts';
import { wei } from './helpers';
import { setup } from './__setup.spec';

const EPSILON = '100000000000';
const HALF_EPSILON = '50000000000';

describe('AStETH Liquidation', function () {
  it('liquidation negative rebase + stable debt', async () => {
    const { stETH, weth, lenders, aave } = setup;
    const borrower = lenders.lenderA;
    const liquidator = lenders.lenderB;

    await borrower.depositStEth(wei`7.5 ether`);
    await asserts.astEthBalance(borrower, wei`7.5 ether`);

    await borrower.lendingPool.borrow(
      weth.address,
      wei`5 ether`,
      RateMode.Stable,
      '0',
      borrower.address
    );
    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.gt(
      wei`1 ether`,
      'Health Factor Below 1'
    );
    await setup.rebaseStETH(-0.12); // price drop 12%
    const userGlobalDataAfterRebase = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    expect(userGlobalDataAfterRebase.healthFactor.toString()).to.be.bignumber.lt(
      wei`1 ether`,
      'Health Factor Below 1'
    );

    await liquidator.weth.deposit({ value: wei`10 ether` });
    await liquidator.weth.approve(liquidator.lendingPool.address, wei`10 ether`);
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      wei`1 ether`,
      true
    );

    asserts.eq(await liquidator.wethBalance(), wei`9 ether`);
    await asserts.astEthBalance(liquidator, wei`1.075 ether`);

    const userReserveDataAfterLiquidation = await aave.protocolDataProvider.getUserReserveData(
      weth.address,
      borrower.address
    );
    const userGlobalDataAfterLiquidation = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    asserts.gt(userGlobalDataAfterLiquidation.healthFactor.toString(), wei`1 ether`);
    asserts.gte(
      userReserveDataAfterLiquidation.currentStableDebt.toString(),
      wei`4 ether`,
      EPSILON
    );
  });
  it('liquidation negative rebase below strategy assumption: health factor must fall', async () => {
    const { stETH, weth, lenders, aave } = setup;
    const borrower = lenders.lenderA;
    const liquidator = lenders.lenderB;

    await borrower.depositStEth(wei`7.5 ether`);
    await borrower.lendingPool.borrow(
      weth.address,
      wei`5 ether`,
      RateMode.Variable,
      '0',
      borrower.address
    );
    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(userGlobalData.healthFactor.toString(), wei`1 ether`);

    await setup.rebaseStETH(-0.3); // price drop 30%
    const userGlobalDataAfterRebase = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    asserts.lt(userGlobalDataAfterRebase.healthFactor.toString(), wei`1 ether`);

    await liquidator.weth.deposit({ value: wei`10 ether` });
    await liquidator.weth.approve(liquidator.lendingPool.address, wei`10 ether`);
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      MAX_UINT_AMOUNT,
      true
    );

    await asserts.lte(await liquidator.wethBalance(), wei`7.5 ether`, EPSILON);
    await asserts.astEthBalance(liquidator, wei`2.687500002 ether`, EPSILON);

    const userReserveDataAfterLiquidation = await aave.protocolDataProvider.getUserReserveData(
      weth.address,
      borrower.address
    );
    const userGlobalDataAfterLiquidation = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );

    asserts.lt(
      userGlobalDataAfterLiquidation.healthFactor.toString(),
      userGlobalDataAfterRebase.healthFactor.toString()
    );
    asserts.gte(
      userReserveDataAfterLiquidation.currentVariableDebt.toString(),
      wei`2.5 ether`,
      EPSILON
    );
  });
  it('liquidation on negative rebase', async () => {
    const { stETH, weth, lenders, aave } = setup;
    const borrower = lenders.lenderA;
    const liquidator = lenders.lenderB;

    await borrower.depositStEth(wei`7.5 ether`);
    await asserts.astEthBalance(borrower, wei`7.5 ether`);

    await borrower.lendingPool.borrow(
      weth.address,
      wei`5 ether`,
      RateMode.Variable,
      '0',
      borrower.address
    );
    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(userGlobalData.healthFactor.toString(), wei`1 ether`);

    await setup.rebaseStETH(-0.12); // price drop 12%
    const userGlobalDataAfterRebase = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    asserts.lt(userGlobalDataAfterRebase.healthFactor.toString(), wei`1 ether`);

    await liquidator.weth.deposit({ value: wei`10 ether` });
    await liquidator.weth.approve(liquidator.lendingPool.address, wei`10 ether`);
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      wei`1 ether`,
      true
    );

    asserts.eq(await liquidator.wethBalance(), wei`9 ether`);
    await asserts.astEthBalance(liquidator, wei`1.075 ether`);

    const userReserveDataAfterLiquidation = await aave.protocolDataProvider.getUserReserveData(
      weth.address,
      borrower.address
    );
    const userGlobalDataAfterLiquidation = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    asserts.gt(userGlobalDataAfterLiquidation.healthFactor.toString(), wei`1 ether`);
    asserts.gte(
      userReserveDataAfterLiquidation.currentVariableDebt.toString(),
      wei`4 ether`,
      EPSILON
    );
  });

  it('liquidation on price drop', async () => {
    const { stETH, weth, lenders, aave, priceFeed } = setup;
    const borrower = lenders.lenderA;
    const liquidator = lenders.lenderB;

    await borrower.depositStEth(wei`8 ether`);
    await asserts.astEthBalance(borrower, wei`8 ether`);

    await borrower.lendingPool.borrow(
      weth.address,
      wei`5 ether`,
      RateMode.Variable,
      '0',
      borrower.address
    );

    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(userGlobalData.healthFactor.toString(), wei`1 ether`);

    await priceFeed.setPrice(wei`0.8 ether`); // price drop 20%
    const userGlobalDataAfterRebase = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    asserts.lt(userGlobalDataAfterRebase.healthFactor.toString(), wei`1 ether`);

    await liquidator.weth.deposit({ value: wei`3 ether` });
    await liquidator.weth.approve(liquidator.lendingPool.address, wei`3 ether`);
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      MAX_UINT_AMOUNT,
      true
    );

    asserts.lte(await liquidator.wethBalance(), wei`0.5 ether`, EPSILON);
    await asserts.astEthBalance(
      liquidator,
      new BigNumber(wei`2.5 ether`)
        .dividedBy(0.8) // price drop
        .multipliedBy(1.075) // liquidation bonus
        .plus(HALF_EPSILON) // epsilon shift
        .toFixed(0, 1),
      HALF_EPSILON
    );

    const userReserveDataAfterLiquidation = await aave.protocolDataProvider.getUserReserveData(
      weth.address,
      borrower.address
    );
    const userGlobalDataAfterLiquidation = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    asserts.gt(userGlobalDataAfterLiquidation.healthFactor.toString(), wei`1 ether`);
    asserts.gte(
      userReserveDataAfterLiquidation.currentVariableDebt.toString(),
      wei`2.5 ether`,
      EPSILON
    );
  });

  it('Realistic rebase scenario', async () => {
    const { stETH, weth, lenders, aave, priceFeed } = setup;
    const depositor = lenders.lenderA;
    const borrower = lenders.lenderB;
    const liquidator = lenders.lenderC;
    // lenderA deposits stETH
    await depositor.depositStEth(wei`100 ether`);
    await asserts.astEthBalance(depositor, wei`100 ether`);

    // lenderB deposits stETH
    await borrower.depositStEth(wei`20.1 ether`);
    await asserts.astEthBalance(borrower, wei`20.1 ether`);

    // lenderA borrows weth with stETH as collateral
    await borrower.lendingPool.borrow(
      weth.address,
      wei`14 ether`,
      RateMode.Variable,
      '0',
      borrower.address
    );
    let borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(borrowerGlobalData.healthFactor.toString(), wei`1 ether`);

    // before negative rebase price drop happens (3%) still not enough to close positions
    await priceFeed.setPrice(wei`0.97 ether`);
    borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(borrowerGlobalData.healthFactor.toString(), wei`1 ether`);

    // negative rebase happens (-5%)
    await setup.rebaseStETH(-0.05);
    borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.lt(borrowerGlobalData.healthFactor.toString(), wei`1 ether`);

    // now position might be closed it's profitable for liquidator
    await liquidator.weth.deposit({ value: wei`8 ether` });
    await liquidator.weth.approve(liquidator.lendingPool.address, wei`8 ether`);
    const liquidatorStEthBalanceBeforeLiquidation = await liquidator.stEthBalance();
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      MAX_UINT_AMOUNT,
      false
    );

    asserts.lte(await liquidator.wethBalance(), wei`1 ether`, EPSILON);
    asserts.gte(
      new BigNumber(await liquidator.stEthBalance())
        .minus(liquidatorStEthBalanceBeforeLiquidation)
        .toFixed(0, 1),
      new BigNumber(wei`7 ether`)
        .dividedBy(0.97) // price drop factor
        .multipliedBy(1.075) // liquidation bonus
        .toFixed(0, 1),
      EPSILON
    );

    borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(borrowerGlobalData.healthFactor.toString(), wei`1 ether`);
  });
});
