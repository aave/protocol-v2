import { _TypedDataEncoder } from '@ethersproject/hash';
import { expect } from 'chai';
import { MAX_UINT_AMOUNT } from '../../helpers/constants';
import { RateMode } from '../../helpers/types';
import { assertBalance, wei } from './helpers';
import { setup } from './__setup.spec';

describe('AStETH Liquidation', function () {
  it('liquidation on price drop', async () => {
    const { stETH, weth, lenders, aave } = setup;
    const borrower = lenders.lenderA;
    const liquidator = lenders.lenderB;

    await borrower.depositStEth(wei(10));
    await borrower.lendingPool.borrow(
      weth.address,
      wei(5),
      RateMode.Variable,
      '0',
      borrower.address
    );
    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.gt(
      wei(1),
      'Health Factor Below 1'
    );
    await setup.rebaseStETH(-0.5);
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

    const liquidatorWethBalance = await liquidator.wethBalance();
    const liquidatorAstEthBalance = await liquidator.astEthBalance();
    assertBalance(liquidatorWethBalance, wei(9));
    assertBalance(liquidatorAstEthBalance, wei(1.075));

    const userReserveDataAfterLiquidation = await aave.protocolDataProvider.getUserReserveData(
      weth.address,
      borrower.address
    );
    const userGlobalDataAfterLiquidation = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    expect(userGlobalDataAfterLiquidation.healthFactor.toString()).to.be.bignumber.lt(wei(1));
    assertBalance(
      userReserveDataAfterLiquidation.currentVariableDebt.toString(),
      wei(4),
      '10000000000'
    );
  });

  it('liquidation on negative rebase', async () => {
    const { stETH, weth, lenders, aave, priceFeed } = setup;
    const borrower = lenders.lenderA;
    const liquidator = lenders.lenderB;

    await borrower.depositStEth(wei(10));
    await borrower.lendingPool.borrow(
      weth.address,
      wei(5),
      RateMode.Variable,
      '0',
      borrower.address
    );

    const userGlobalData = await borrower.lendingPool.getUserAccountData(borrower.address);
    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.gt(
      wei(1),
      'Health Factor Below 1'
    );
    await priceFeed.setPrice(wei(0.5));
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
      MAX_UINT_AMOUNT,
      true
    );

    const liquidatorWethBalance = await liquidator.wethBalance();
    const liquidatorAstEthBalance = await liquidator.astEthBalance();
    assertBalance(liquidatorWethBalance, wei(7.5), '10000000000');
    assertBalance(liquidatorAstEthBalance, wei(5.375), '10000000000');

    const userReserveDataAfterLiquidation = await aave.protocolDataProvider.getUserReserveData(
      weth.address,
      borrower.address
    );
    const userGlobalDataAfterLiquidation = await borrower.lendingPool.getUserAccountData(
      borrower.address
    );
    expect(userGlobalDataAfterLiquidation.healthFactor.toString()).to.be.bignumber.lt(wei(1));
    assertBalance(
      userReserveDataAfterLiquidation.currentVariableDebt.toString(),
      wei(2.5),
      '10000000000'
    );
  });
});
