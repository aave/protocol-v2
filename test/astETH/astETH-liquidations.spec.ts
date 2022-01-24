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

    await borrower.depositStEth(wei(7.5));
    await asserts.astEthBalance(borrower, wei(7.5));

    await borrower.lendingPool.borrow(weth.address, wei(5), RateMode.Stable, '0', borrower.address);
    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.gt(
      wei(1),
      'Health Factor Below 1'
    );
    await setup.rebaseStETH(-0.12); // price drop 12%
    const userGlobalDataAfterRebase = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    expect(userGlobalDataAfterRebase.healthFactor.toString()).to.be.bignumber.lt(
      wei(1),
      'Health Factor Below 1'
    );

    await liquidator.weth.deposit({ value: wei(10) });
    await liquidator.weth.approve(liquidator.lendingPool.address, wei(10));
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      wei(1),
      true
    );

    asserts.eq(await liquidator.wethBalance(), wei(9));
    await asserts.astEthBalance(liquidator, wei(1.075));

    const userReserveDataAfterLiquidation = await aave.protocolDataProvider.getUserReserveData(
      weth.address,
      borrower.address
    );
    const userGlobalDataAfterLiquidation = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    asserts.gt(userGlobalDataAfterLiquidation.healthFactor.toString(), wei(1));
    asserts.gte(userReserveDataAfterLiquidation.currentStableDebt.toString(), wei(4), EPSILON);
  });
  it('liquidation negative rebase below strategy assumption: health factor must fall', async () => {
    const { stETH, weth, lenders, aave } = setup;
    const borrower = lenders.lenderA;
    const liquidator = lenders.lenderB;

    await borrower.depositStEth(wei(7.5));
    await borrower.lendingPool.borrow(
      weth.address,
      wei(5),
      RateMode.Variable,
      '0',
      borrower.address
    );
    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(userGlobalData.healthFactor.toString(), wei(1));

    await setup.rebaseStETH(-0.3); // price drop 30%
    const userGlobalDataAfterRebase = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    asserts.lt(userGlobalDataAfterRebase.healthFactor.toString(), wei(1));

    await liquidator.weth.deposit({ value: wei(10) });
    await liquidator.weth.approve(liquidator.lendingPool.address, wei(10));
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      MAX_UINT_AMOUNT,
      true
    );

    await asserts.lte(await liquidator.wethBalance(), wei(7.5), EPSILON);
    await asserts.astEthBalance(liquidator, wei(2.687500002), EPSILON);

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
    asserts.gte(userReserveDataAfterLiquidation.currentVariableDebt.toString(), wei(2.5), EPSILON);
  });
  it('liquidation on negative rebase', async () => {
    const { stETH, weth, lenders, aave } = setup;
    const borrower = lenders.lenderA;
    const liquidator = lenders.lenderB;

    await borrower.depositStEth(wei(7.5));
    await asserts.astEthBalance(borrower, wei(7.5));

    await borrower.lendingPool.borrow(
      weth.address,
      wei(5),
      RateMode.Variable,
      '0',
      borrower.address
    );
    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(userGlobalData.healthFactor.toString(), wei(1));

    await setup.rebaseStETH(-0.12); // price drop 12%
    const userGlobalDataAfterRebase = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    asserts.lt(userGlobalDataAfterRebase.healthFactor.toString(), wei(1));

    await liquidator.weth.deposit({ value: wei(10) });
    await liquidator.weth.approve(liquidator.lendingPool.address, wei(10));
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      wei(1),
      true
    );

    asserts.eq(await liquidator.wethBalance(), wei(9));
    await asserts.astEthBalance(liquidator, wei(1.075));

    const userReserveDataAfterLiquidation = await aave.protocolDataProvider.getUserReserveData(
      weth.address,
      borrower.address
    );
    const userGlobalDataAfterLiquidation = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    asserts.gt(userGlobalDataAfterLiquidation.healthFactor.toString(), wei(1));
    asserts.gte(userReserveDataAfterLiquidation.currentVariableDebt.toString(), wei(4), EPSILON);
  });

  it('liquidation on price drop', async () => {
    const { stETH, weth, lenders, aave, priceFeed } = setup;
    const borrower = lenders.lenderA;
    const liquidator = lenders.lenderB;

    await borrower.depositStEth(wei(8));
    await asserts.astEthBalance(borrower, wei(8));

    await borrower.lendingPool.borrow(
      weth.address,
      wei(5),
      RateMode.Variable,
      '0',
      borrower.address
    );

    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(userGlobalData.healthFactor.toString(), wei(1));

    await priceFeed.setPrice(wei(0.8)); // price drop 20%
    const userGlobalDataAfterRebase = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    asserts.lt(userGlobalDataAfterRebase.healthFactor.toString(), wei(1));

    await liquidator.weth.deposit({ value: wei(3) });
    await liquidator.weth.approve(liquidator.lendingPool.address, wei(3));
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      MAX_UINT_AMOUNT,
      true
    );

    asserts.lte(await liquidator.wethBalance(), wei(0.5), EPSILON);
    await asserts.astEthBalance(
      liquidator,
      new BigNumber(wei(2.5))
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
    asserts.gt(userGlobalDataAfterLiquidation.healthFactor.toString(), wei(1));
    asserts.gte(userReserveDataAfterLiquidation.currentVariableDebt.toString(), wei(2.5), EPSILON);
  });

  it('Realistic rebase scenario', async () => {
    const { stETH, weth, lenders, aave, priceFeed } = setup;
    const depositor = lenders.lenderA;
    const borrower = lenders.lenderB;
    const liquidator = lenders.lenderC;
    // lenderA deposits stETH
    await depositor.depositStEth(wei(100));
    await asserts.astEthBalance(depositor, wei(100));

    // lenderB deposits stETH
    await borrower.depositStEth(wei(20.1));
    await asserts.astEthBalance(borrower, wei(20.1));

    // lenderA borrows weth with stETH as collateral
    await borrower.lendingPool.borrow(
      weth.address,
      wei(14),
      RateMode.Variable,
      '0',
      borrower.address
    );
    let borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(borrowerGlobalData.healthFactor.toString(), wei(1));

    // before negative rebase price drop happens (3%) still not enough to close positions
    await priceFeed.setPrice(wei(0.97));
    borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(borrowerGlobalData.healthFactor.toString(), wei(1));

    // negative rebase happens (-5%)
    await setup.rebaseStETH(-0.05);
    borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.lt(borrowerGlobalData.healthFactor.toString(), wei(1));

    // now position might be closed it's profitable for liquidator
    await liquidator.weth.deposit({ value: wei(8) });
    await liquidator.weth.approve(liquidator.lendingPool.address, wei(8));
    const liquidatorStEthBalanceBeforeLiquidation = await liquidator.stEthBalance();
    await liquidator.lendingPool.liquidationCall(
      stETH.address,
      weth.address,
      borrower.address,
      MAX_UINT_AMOUNT,
      false
    );

    asserts.lte(await liquidator.wethBalance(), wei(1), EPSILON);
    asserts.gte(
      new BigNumber(await liquidator.stEthBalance())
        .minus(liquidatorStEthBalanceBeforeLiquidation)
        .toFixed(0, 1),
      new BigNumber(wei(7))
        .dividedBy(0.97) // price drop factor
        .multipliedBy(1.075) // liquidation bonus
        .toFixed(0, 1),
      EPSILON
    );

    borrowerGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    asserts.gt(borrowerGlobalData.healthFactor.toString(), wei(1));
  });
});
