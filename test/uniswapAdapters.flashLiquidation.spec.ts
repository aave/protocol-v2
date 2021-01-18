import { makeSuite, TestEnv } from './helpers/make-suite';
import {
  convertToCurrencyDecimals,
  buildFlashLiquidationAdapterParams,
} from '../helpers/contracts-helpers';
import { getMockUniswapRouter } from '../helpers/contracts-getters';
import { deployFlashLiquidationAdapter } from '../helpers/contracts-deployments';
import { MockUniswapV2Router02 } from '../types/MockUniswapV2Router02';
import BigNumber from 'bignumber.js';
import { DRE, evmRevert, evmSnapshot, increaseTime } from '../helpers/misc-utils';
import { ethers } from 'ethers';
import { ProtocolErrors, RateMode } from '../helpers/types';
import { APPROVAL_AMOUNT_LENDING_POOL, MAX_UINT_AMOUNT, oneEther } from '../helpers/constants';
import { getUserData } from './helpers/utils/helpers';
import { calcExpectedStableDebtTokenBalance } from './helpers/utils/calculations';
const { expect } = require('chai');

makeSuite('Uniswap adapters', (testEnv: TestEnv) => {
  let mockUniswapRouter: MockUniswapV2Router02;
  let evmSnapshotId: string;

  before(async () => {
    mockUniswapRouter = await getMockUniswapRouter();
  });

  const depositAndHFBelowOne = async () => {
    const { INVALID_HF } = ProtocolErrors;
    const { dai, weth, users, pool, oracle } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    //mints DAI to depositor
    await dai.connect(depositor.signer).mint(await convertToCurrencyDecimals(dai.address, '1000'));

    //approve protocol to access depositor wallet
    await dai.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    await pool
      .connect(depositor.signer)
      .deposit(dai.address, amountDAItoDeposit, depositor.address, '0');
    //user 2 deposits 1 ETH
    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(await convertToCurrencyDecimals(weth.address, '1000'));

    //approve protocol to access the borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    //user 2 borrows

    const userGlobalDataBefore = await pool.getUserAccountData(borrower.address);
    const daiPrice = await oracle.getAssetPrice(dai.address);

    const amountDAIToBorrow = await convertToCurrencyDecimals(
      dai.address,
      new BigNumber(userGlobalDataBefore.availableBorrowsETH.toString())
        .div(daiPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(dai.address, amountDAIToBorrow, RateMode.Stable, '0', borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.equal(
      '8250',
      INVALID_HF
    );

    await oracle.setAssetPrice(
      dai.address,
      new BigNumber(daiPrice.toString()).multipliedBy(1.18).toFixed(0)
    );

    const userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
      oneEther.toFixed(0),
      INVALID_HF
    );
  };

  beforeEach(async () => {
    evmSnapshotId = await evmSnapshot();
  });

  afterEach(async () => {
    await evmRevert(evmSnapshotId);
  });

  describe('Flash Liquidation Adapter', () => {
    before('Before LendingPool liquidation: set config', () => {
      BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
    });

    after('After LendingPool liquidation: reset config', () => {
      BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
    });

    describe('constructor', () => {
      it('should deploy with correct parameters', async () => {
        const { addressesProvider, weth } = testEnv;
        await deployFlashLiquidationAdapter([
          addressesProvider.address,
          mockUniswapRouter.address,
          weth.address,
        ]);
      });

      it('should revert if not valid addresses provider', async () => {
        const { weth } = testEnv;
        expect(
          deployFlashLiquidationAdapter([
            mockUniswapRouter.address,
            mockUniswapRouter.address,
            weth.address,
          ])
        ).to.be.reverted;
      });
    });

    describe('executeOperation: succesfully liquidateCall and swap via Flash Loan with profits', () => {
      it('Liquidates the borrow with profit', async () => {
        await depositAndHFBelowOne();
        await increaseTime(100);

        const {
          dai,
          weth,
          users,
          pool,
          oracle,
          helpersContract,
          flashLiquidationAdapter,
        } = testEnv;

        const liquidator = users[3];
        const borrower = users[1];
        const expectedSwap = ethers.utils.parseEther('0.4');

        const liquidatorWethBalanceBefore = await weth.balanceOf(liquidator.address);

        // Set how much ETH will be sold and swapped for DAI at Uniswap mock
        await (await mockUniswapRouter.setAmountToSwap(weth.address, expectedSwap)).wait();

        const collateralPrice = await oracle.getAssetPrice(weth.address);
        const principalPrice = await oracle.getAssetPrice(dai.address);
        const daiReserveDataBefore = await helpersContract.getReserveData(dai.address);
        const ethReserveDataBefore = await helpersContract.getReserveData(weth.address);
        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        const collateralDecimals = (
          await helpersContract.getReserveConfigurationData(weth.address)
        ).decimals.toString();
        const principalDecimals = (
          await helpersContract.getReserveConfigurationData(dai.address)
        ).decimals.toString();
        const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2).toFixed(0);

        const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
          .times(new BigNumber(amountToLiquidate).times(105))
          .times(new BigNumber(10).pow(collateralDecimals))
          .div(
            new BigNumber(collateralPrice.toString()).times(
              new BigNumber(10).pow(principalDecimals)
            )
          )
          .div(100)
          .decimalPlaces(0, BigNumber.ROUND_DOWN);

        const flashLoanDebt = new BigNumber(amountToLiquidate.toString())
          .multipliedBy(1.0009)
          .toFixed(0);

        const expectedProfit = ethers.BigNumber.from(expectedCollateralLiquidated.toString()).sub(
          expectedSwap
        );

        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          dai.address,
          borrower.address,
          amountToLiquidate,
          false
        );
        const tx = await pool
          .connect(liquidator.signer)
          .flashLoan(
            flashLiquidationAdapter.address,
            [dai.address],
            [amountToLiquidate],
            [0],
            borrower.address,
            params,
            0
          );

        // Expect Swapped event
        await expect(Promise.resolve(tx))
          .to.emit(flashLiquidationAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, expectedSwap.toString(), flashLoanDebt);

        // Expect LiquidationCall event
        await expect(Promise.resolve(tx))
          .to.emit(pool, 'LiquidationCall')
          .withArgs(
            weth.address,
            dai.address,
            borrower.address,
            amountToLiquidate.toString(),
            expectedCollateralLiquidated.toString(),
            flashLiquidationAdapter.address,
            false
          );

        const userReserveDataAfter = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );
        const liquidatorWethBalanceAfter = await weth.balanceOf(liquidator.address);

        const daiReserveDataAfter = await helpersContract.getReserveData(dai.address);
        const ethReserveDataAfter = await helpersContract.getReserveData(weth.address);

        if (!tx.blockNumber) {
          expect(false, 'Invalid block number');
          return;
        }
        const txTimestamp = new BigNumber(
          (await DRE.ethers.provider.getBlock(tx.blockNumber)).timestamp
        );

        const stableDebtBeforeTx = calcExpectedStableDebtTokenBalance(
          userReserveDataBefore.principalStableDebt,
          userReserveDataBefore.stableBorrowRate,
          userReserveDataBefore.stableRateLastUpdated,
          txTimestamp
        );

        expect(userReserveDataAfter.currentStableDebt.toString()).to.be.bignumber.almostEqual(
          stableDebtBeforeTx.minus(amountToLiquidate).toFixed(0),
          'Invalid user debt after liquidation'
        );

        //the liquidity index of the principal reserve needs to be bigger than the index before
        expect(daiReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gte(
          daiReserveDataBefore.liquidityIndex.toString(),
          'Invalid liquidity index'
        );

        //the principal APY after a liquidation needs to be lower than the APY before
        expect(daiReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lt(
          daiReserveDataBefore.liquidityRate.toString(),
          'Invalid liquidity APY'
        );

        expect(daiReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
          new BigNumber(daiReserveDataBefore.availableLiquidity.toString())
            .plus(flashLoanDebt)
            .toFixed(0),
          'Invalid principal available liquidity'
        );

        expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
          new BigNumber(ethReserveDataBefore.availableLiquidity.toString())
            .minus(expectedCollateralLiquidated)
            .toFixed(0),
          'Invalid collateral available liquidity'
        );

        // Profit after flash loan liquidation
        expect(liquidatorWethBalanceAfter).to.be.equal(
          liquidatorWethBalanceBefore.add(expectedProfit),
          'Invalid expected WETH profit'
        );
      });
    });

    describe('executeOperation: succesfully liquidateCall and swap via Flash Loan without profits', () => {
      it('Liquidates the borrow', async () => {
        await depositAndHFBelowOne();
        await increaseTime(100);

        const {
          dai,
          weth,
          users,
          pool,
          oracle,
          helpersContract,
          flashLiquidationAdapter,
        } = testEnv;

        const liquidator = users[3];
        const borrower = users[1];
        const liquidatorWethBalanceBefore = await weth.balanceOf(liquidator.address);

        const collateralPrice = await oracle.getAssetPrice(weth.address);
        const principalPrice = await oracle.getAssetPrice(dai.address);
        const daiReserveDataBefore = await helpersContract.getReserveData(dai.address);
        const ethReserveDataBefore = await helpersContract.getReserveData(weth.address);
        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        const collateralDecimals = (
          await helpersContract.getReserveConfigurationData(weth.address)
        ).decimals.toString();
        const principalDecimals = (
          await helpersContract.getReserveConfigurationData(dai.address)
        ).decimals.toString();
        const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2).toFixed(0);

        const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
          .times(new BigNumber(amountToLiquidate).times(105))
          .times(new BigNumber(10).pow(collateralDecimals))
          .div(
            new BigNumber(collateralPrice.toString()).times(
              new BigNumber(10).pow(principalDecimals)
            )
          )
          .div(100)
          .decimalPlaces(0, BigNumber.ROUND_DOWN);

        const flashLoanDebt = new BigNumber(amountToLiquidate.toString())
          .multipliedBy(1.0009)
          .toFixed(0);

        // Set how much ETH will be sold and swapped for DAI at Uniswap mock
        await (
          await mockUniswapRouter.setAmountToSwap(
            weth.address,
            expectedCollateralLiquidated.toString()
          )
        ).wait();

        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          dai.address,
          borrower.address,
          amountToLiquidate,
          false
        );
        const tx = await pool
          .connect(liquidator.signer)
          .flashLoan(
            flashLiquidationAdapter.address,
            [dai.address],
            [amountToLiquidate],
            [0],
            borrower.address,
            params,
            0
          );

        // Expect Swapped event
        await expect(Promise.resolve(tx))
          .to.emit(flashLiquidationAdapter, 'Swapped')
          .withArgs(
            weth.address,
            dai.address,
            expectedCollateralLiquidated.toString(),
            flashLoanDebt
          );

        // Expect LiquidationCall event
        await expect(Promise.resolve(tx))
          .to.emit(pool, 'LiquidationCall')
          .withArgs(
            weth.address,
            dai.address,
            borrower.address,
            amountToLiquidate.toString(),
            expectedCollateralLiquidated.toString(),
            flashLiquidationAdapter.address,
            false
          );

        const userReserveDataAfter = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );
        const liquidatorWethBalanceAfter = await weth.balanceOf(liquidator.address);

        const daiReserveDataAfter = await helpersContract.getReserveData(dai.address);
        const ethReserveDataAfter = await helpersContract.getReserveData(weth.address);

        if (!tx.blockNumber) {
          expect(false, 'Invalid block number');
          return;
        }
        const txTimestamp = new BigNumber(
          (await DRE.ethers.provider.getBlock(tx.blockNumber)).timestamp
        );

        const stableDebtBeforeTx = calcExpectedStableDebtTokenBalance(
          userReserveDataBefore.principalStableDebt,
          userReserveDataBefore.stableBorrowRate,
          userReserveDataBefore.stableRateLastUpdated,
          txTimestamp
        );

        expect(userReserveDataAfter.currentStableDebt.toString()).to.be.bignumber.almostEqual(
          stableDebtBeforeTx.minus(amountToLiquidate).toFixed(0),
          'Invalid user debt after liquidation'
        );

        //the liquidity index of the principal reserve needs to be bigger than the index before
        expect(daiReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gte(
          daiReserveDataBefore.liquidityIndex.toString(),
          'Invalid liquidity index'
        );

        //the principal APY after a liquidation needs to be lower than the APY before
        expect(daiReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lt(
          daiReserveDataBefore.liquidityRate.toString(),
          'Invalid liquidity APY'
        );

        expect(daiReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
          new BigNumber(daiReserveDataBefore.availableLiquidity.toString())
            .plus(flashLoanDebt)
            .toFixed(0),
          'Invalid principal available liquidity'
        );

        expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
          new BigNumber(ethReserveDataBefore.availableLiquidity.toString())
            .minus(expectedCollateralLiquidated)
            .toFixed(0),
          'Invalid collateral available liquidity'
        );

        // Net Profit == 0 after flash loan liquidation
        expect(liquidatorWethBalanceAfter).to.be.equal(
          liquidatorWethBalanceBefore,
          'Invalid expected WETH profit'
        );
      });
    });

    describe('executeOperation: succesfully liquidateCall all available debt and swap via Flash Loan ', () => {
      it('Liquidates the borrow', async () => {
        await depositAndHFBelowOne();
        await increaseTime(100);

        const {
          dai,
          weth,
          users,
          pool,
          oracle,
          helpersContract,
          flashLiquidationAdapter,
        } = testEnv;

        const liquidator = users[3];
        const borrower = users[1];
        const liquidatorWethBalanceBefore = await weth.balanceOf(liquidator.address);

        const collateralPrice = await oracle.getAssetPrice(weth.address);
        const principalPrice = await oracle.getAssetPrice(dai.address);
        const daiReserveDataBefore = await helpersContract.getReserveData(dai.address);
        const ethReserveDataBefore = await helpersContract.getReserveData(weth.address);
        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        const collateralDecimals = (
          await helpersContract.getReserveConfigurationData(weth.address)
        ).decimals.toString();
        const principalDecimals = (
          await helpersContract.getReserveConfigurationData(dai.address)
        ).decimals.toString();
        const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2).toFixed(0);
        const extraAmount = new BigNumber(amountToLiquidate).times('1.15').toFixed(0);

        const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
          .times(new BigNumber(amountToLiquidate).times(105))
          .times(new BigNumber(10).pow(collateralDecimals))
          .div(
            new BigNumber(collateralPrice.toString()).times(
              new BigNumber(10).pow(principalDecimals)
            )
          )
          .div(100)
          .decimalPlaces(0, BigNumber.ROUND_DOWN);

        const flashLoanDebt = new BigNumber(extraAmount.toString()).multipliedBy(1.0009).toFixed(0);

        // Set how much ETH will be sold and swapped for DAI at Uniswap mock
        await (
          await mockUniswapRouter.setAmountToSwap(
            weth.address,
            expectedCollateralLiquidated.toString()
          )
        ).wait();

        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          dai.address,
          borrower.address,
          MAX_UINT_AMOUNT,
          false
        );
        const tx = await pool
          .connect(liquidator.signer)
          .flashLoan(
            flashLiquidationAdapter.address,
            [dai.address],
            [extraAmount],
            [0],
            borrower.address,
            params,
            0
          );

        // Expect Swapped event
        await expect(Promise.resolve(tx))
          .to.emit(flashLiquidationAdapter, 'Swapped')
          .withArgs(
            weth.address,
            dai.address,
            expectedCollateralLiquidated.toString(),
            flashLoanDebt
          );

        // Expect LiquidationCall event
        await expect(Promise.resolve(tx)).to.emit(pool, 'LiquidationCall');
      });
    });

    describe('executeOperation: invalid params', async () => {
      it('Revert if debt asset is different than requested flash loan token', async () => {
        await depositAndHFBelowOne();

        const { dai, weth, users, pool, helpersContract, flashLiquidationAdapter } = testEnv;

        const liquidator = users[3];
        const borrower = users[1];
        const expectedSwap = ethers.utils.parseEther('0.4');

        // Set how much ETH will be sold and swapped for DAI at Uniswap mock
        await (await mockUniswapRouter.setAmountToSwap(weth.address, expectedSwap)).wait();

        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2).toFixed(0);

        // Wrong debt asset
        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          weth.address, // intentionally bad
          borrower.address,
          amountToLiquidate,
          false
        );
        await expect(
          pool
            .connect(liquidator.signer)
            .flashLoan(
              flashLiquidationAdapter.address,
              [dai.address],
              [amountToLiquidate],
              [0],
              borrower.address,
              params,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');
      });

      it('Revert if debt asset amount to liquidate is greater than requested flash loan', async () => {
        await depositAndHFBelowOne();

        const { dai, weth, users, pool, helpersContract, flashLiquidationAdapter } = testEnv;

        const liquidator = users[3];
        const borrower = users[1];
        const expectedSwap = ethers.utils.parseEther('0.4');

        // Set how much ETH will be sold and swapped for DAI at Uniswap mock
        await (await mockUniswapRouter.setAmountToSwap(weth.address, expectedSwap)).wait();

        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2);

        // Correct params
        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          dai.address,
          borrower.address,
          amountToLiquidate.toString(),
          false
        );
        // Bad flash loan params: requested DAI amount below amountToLiquidate
        await expect(
          pool
            .connect(liquidator.signer)
            .flashLoan(
              flashLiquidationAdapter.address,
              [dai.address],
              [amountToLiquidate.div(2).toString()],
              [0],
              borrower.address,
              params,
              0
            )
        ).to.be.revertedWith('FLASH_COVER_NOT_ENOUGH');
      });

      it('Revert if requested multiple assets', async () => {
        await depositAndHFBelowOne();

        const { dai, weth, users, pool, helpersContract, flashLiquidationAdapter } = testEnv;

        const liquidator = users[3];
        const borrower = users[1];
        const expectedSwap = ethers.utils.parseEther('0.4');

        // Set how much ETH will be sold and swapped for DAI at Uniswap mock
        await (await mockUniswapRouter.setAmountToSwap(weth.address, expectedSwap)).wait();

        const userReserveDataBefore = await getUserData(
          pool,
          helpersContract,
          dai.address,
          borrower.address
        );

        const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2);

        // Correct params
        const params = buildFlashLiquidationAdapterParams(
          weth.address,
          dai.address,
          borrower.address,
          amountToLiquidate.toString(),
          false
        );
        // Bad flash loan params: requested multiple assets
        await expect(
          pool
            .connect(liquidator.signer)
            .flashLoan(
              flashLiquidationAdapter.address,
              [dai.address, weth.address],
              [10, 10],
              [0],
              borrower.address,
              params,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');
      });
    });
  });
});
