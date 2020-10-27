import {makeSuite, TestEnv} from './helpers/make-suite';
import {
  convertToCurrencyDecimals,
  deployUniswapLiquiditySwapAdapter,
  deployUniswapRepayAdapter,
  getContract,
  getMockUniswapRouter,
} from '../helpers/contracts-helpers';
import {MockUniswapV2Router02} from '../types/MockUniswapV2Router02';
import {Zero} from '@ethersproject/constants';
import BigNumber from 'bignumber.js';
import {evmRevert, evmSnapshot} from '../helpers/misc-utils';
import {ethers} from 'ethers';
import {eContractid} from '../helpers/types';
import {AToken} from '../types/AToken';
import {StableDebtToken} from '../types/StableDebtToken';
const {parseEther} = ethers.utils;

const {expect} = require('chai');

makeSuite('Uniswap adapters', (testEnv: TestEnv) => {
  let mockUniswapRouter: MockUniswapV2Router02;
  let evmSnapshotId: string;

  before(async () => {
    mockUniswapRouter = await getMockUniswapRouter();
  });

  beforeEach(async () => {
    evmSnapshotId = await evmSnapshot();
  });

  afterEach(async () => {
    await evmRevert(evmSnapshotId);
  });

  describe('UniswapLiquiditySwapAdapter', () => {
    describe('constructor', () => {
      it('should deploy with correct parameters', async () => {
        const {addressesProvider} = testEnv;
        await deployUniswapLiquiditySwapAdapter(
          addressesProvider.address,
          mockUniswapRouter.address
        );
      });

      it('should revert if not valid addresses provider', async () => {
        expect(
          deployUniswapLiquiditySwapAdapter(mockUniswapRouter.address, mockUniswapRouter.address)
        ).to.be.reverted;
      });
    });

    describe('executeOperation', () => {
      beforeEach(async () => {
        const {users, weth, dai, pool, deployer} = testEnv;
        const userAddress = users[0].address;

        // Provide liquidity
        await dai.mint(parseEther('20000'));
        await dai.approve(pool.address, parseEther('20000'));
        await pool.deposit(dai.address, parseEther('20000'), deployer.address, 0);

        // Make a deposit for user
        await weth.mint(parseEther('100'));
        await weth.approve(pool.address, parseEther('100'));
        await pool.deposit(weth.address, parseEther('100'), userAddress, 0);
      });

      it('should correctly swap tokens and deposit the out tokens in the pool', async () => {
        const {users, weth, oracle, dai, aDai, aEth, pool, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aEth.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);
        const userAEthBalanceBefore = await aEth.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        // 0,5% slippage
        const params = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint256'],
          [dai.address, userAddress, 50]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              0,
              params,
              0
            )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, flashloanAmount.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aEth.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should work correctly with tokens of different decimals', async () => {
        const {
          users,
          usdc,
          oracle,
          dai,
          aDai,
          uniswapLiquiditySwapAdapter,
          pool,
          deployer,
        } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountUSDCtoSwap = await convertToCurrencyDecimals(usdc.address, '10');
        const liquidity = await convertToCurrencyDecimals(usdc.address, '20000');

        // Provide liquidity
        await usdc.mint(liquidity);
        await usdc.approve(pool.address, liquidity);
        await pool.deposit(usdc.address, liquidity, deployer.address, 0);

        // Make a deposit for user
        await usdc.connect(user).mint(amountUSDCtoSwap);
        await usdc.connect(user).approve(pool.address, amountUSDCtoSwap);
        await pool.connect(user).deposit(usdc.address, amountUSDCtoSwap, userAddress, 0);

        const usdcPrice = await oracle.getAssetPrice(usdc.address);
        const daiPrice = await oracle.getAssetPrice(dai.address);

        // usdc 6
        const collateralDecimals = (await usdc.decimals()).toString();
        const principalDecimals = (await dai.decimals()).toString();

        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountUSDCtoSwap.toString())
            .times(
              new BigNumber(usdcPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
            )
            .div(
              new BigNumber(daiPrice.toString()).times(new BigNumber(10).pow(collateralDecimals))
            )
            .toFixed(0)
        );

        await mockUniswapRouter.connect(user).setAmountToReturn(expectedDaiAmount);

        const aUsdcData = await pool.getReserveData(usdc.address);
        const aUsdc = await getContract<AToken>(eContractid.AToken, aUsdcData.aTokenAddress);
        const aUsdcBalance = await aUsdc.balanceOf(userAddress);
        await aUsdc.connect(user).approve(uniswapLiquiditySwapAdapter.address, aUsdcBalance);
        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(amountUSDCtoSwap.toString()).div(1.0009).toFixed(0);

        // 0,5% slippage
        const params = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint256'],
          [dai.address, userAddress, 50]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [usdc.address],
              [flashloanAmount.toString()],
              0,
              params,
              0
            )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(usdc.address, dai.address, flashloanAmount.toString(), expectedDaiAmount);

        const adapterUsdcBalance = await usdc.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const aDaiBalance = await aDai.balanceOf(userAddress);

        expect(adapterUsdcBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(aDaiBalance).to.be.eq(expectedDaiAmount);
      });

      it('should revert if slippage param is not inside limits', async () => {
        const {users, pool, weth, oracle, dai, aEth, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        await weth.connect(user).mint(amountWETHtoSwap);
        await weth.connect(user).transfer(uniswapLiquiditySwapAdapter.address, amountWETHtoSwap);

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.connect(user).setAmountToReturn(expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aEth.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);
        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        // 30% slippage
        const params1 = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint256'],
          [dai.address, userAddress, 3000]
        );

        // 0,05% slippage
        const params2 = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint256'],
          [dai.address, userAddress, 5]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              0,
              params1,
              0
            )
        ).to.be.revertedWith('SLIPPAGE_OUT_OF_RANGE');
        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              0,
              params2,
              0
            )
        ).to.be.revertedWith('SLIPPAGE_OUT_OF_RANGE');
      });

      it('should revert when swap exceed slippage', async () => {
        const {users, weth, oracle, dai, aEth, pool, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        await weth.connect(user).mint(amountWETHtoSwap);
        await weth.connect(user).transfer(uniswapLiquiditySwapAdapter.address, amountWETHtoSwap);

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        // 1,5% slippage
        const returnedDaiAmountWithBigSlippage = new BigNumber(expectedDaiAmount.toString())
          .multipliedBy(0.985)
          .toFixed(0);
        await mockUniswapRouter.connect(user).setAmountToReturn(returnedDaiAmountWithBigSlippage);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aEth.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);
        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        // 0,5% slippage
        const params = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint256'],
          [dai.address, userAddress, 50]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              0,
              params,
              0
            )
        ).to.be.revertedWith('INSUFFICIENT_OUTPUT_AMOUNT');
      });
    });
  });

  describe('UniswapRepayAdapter', () => {
    describe('constructor', () => {
      it('should deploy with correct parameters', async () => {
        const {addressesProvider} = testEnv;
        await deployUniswapRepayAdapter(addressesProvider.address, mockUniswapRouter.address);
      });

      it('should revert if not valid addresses provider', async () => {
        expect(deployUniswapRepayAdapter(mockUniswapRouter.address, mockUniswapRouter.address)).to
          .be.reverted;
      });
    });

    describe('executeOperation', () => {
      beforeEach(async () => {
        const {users, weth, dai, pool, deployer} = testEnv;
        const userAddress = users[0].address;

        // Provide liquidity
        await dai.mint(parseEther('20000'));
        await dai.approve(pool.address, parseEther('20000'));
        await pool.deposit(dai.address, parseEther('20000'), deployer.address, 0);

        // Make a deposit for user
        await weth.mint(parseEther('100'));
        await weth.approve(pool.address, parseEther('100'));
        await pool.deposit(weth.address, parseEther('100'), userAddress, 0);
      });

      it('should correctly swap tokens and repay debt', async () => {
        const {
          users,
          pool,
          weth,
          aEth,
          oracle,
          dai,
          uniswapRepayAdapter,
          helpersContract,
        } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        // Open user Debt
        await pool.connect(user).borrow(dai.address, expectedDaiAmount, 1, 0, userAddress);

        const daiStableDebtTokenAddress = (
          await helpersContract.getReserveTokensAddresses(dai.address)
        ).stableDebtTokenAddress;

        const daiStableDebtContract = await getContract<StableDebtToken>(
          eContractid.StableDebtToken,
          daiStableDebtTokenAddress
        );

        const userDaiStableDebtAmountBefore = await daiStableDebtContract.balanceOf(userAddress);

        const liquidityToSwap = amountWETHtoSwap;
        await aEth.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);
        const userAEthBalanceBefore = await aEth.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(flashloanAmount);
        await mockUniswapRouter.connect(user).setAmountToReturn(expectedDaiAmount);

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint256', 'uint256', 'uint256'],
          [dai.address, userAddress, 0, expectedDaiAmount, 1]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              0,
              params,
              0
            )
        )
          .to.emit(uniswapRepayAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, flashloanAmount.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapRepayAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapRepayAdapter.address);
        const userDaiStableDebtAmount = await daiStableDebtContract.balanceOf(userAddress);
        const userAEthBalance = await aEth.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(userDaiStableDebtAmountBefore).to.be.gte(expectedDaiAmount);
        expect(userDaiStableDebtAmount).to.be.lt(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should revert if there is not debt to repay with the specified rate mode', async () => {
        const {users, pool, weth, oracle, dai, uniswapRepayAdapter, aEth} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        await weth.connect(user).mint(amountWETHtoSwap);
        await weth.connect(user).transfer(uniswapRepayAdapter.address, amountWETHtoSwap);

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        // Open user Debt
        await pool.connect(user).borrow(dai.address, expectedDaiAmount, 2, 0, userAddress);

        const liquidityToSwap = amountWETHtoSwap;
        await aEth.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(flashloanAmount);
        await mockUniswapRouter.connect(user).setAmountToReturn(expectedDaiAmount);

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint256', 'uint256', 'uint256'],
          [dai.address, userAddress, 0, expectedDaiAmount, 1]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              0,
              params,
              0
            )
        ).to.be.reverted;
      });

      it('should revert if there is not debt to repay', async () => {
        const {users, pool, weth, oracle, dai, uniswapRepayAdapter, aEth} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        await weth.connect(user).mint(amountWETHtoSwap);
        await weth.connect(user).transfer(uniswapRepayAdapter.address, amountWETHtoSwap);

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const liquidityToSwap = amountWETHtoSwap;
        await aEth.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(flashloanAmount);
        await mockUniswapRouter.connect(user).setAmountToReturn(expectedDaiAmount);

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint256', 'uint256', 'uint256'],
          [dai.address, userAddress, 0, expectedDaiAmount, 1]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              0,
              params,
              0
            )
        ).to.be.reverted;
      });

      it('should revert when the received amount is less than expected', async () => {
        const {users, pool, weth, oracle, dai, aEth, uniswapRepayAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        // Open user Debt
        await pool.connect(user).borrow(dai.address, expectedDaiAmount, 1, 0, userAddress);

        const liquidityToSwap = amountWETHtoSwap;
        await aEth.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const insufficientOutput = new BigNumber(expectedDaiAmount.toString())
          .multipliedBy(0.985)
          .toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(flashloanAmount);
        await mockUniswapRouter.connect(user).setAmountToReturn(insufficientOutput);

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint256', 'uint256', 'uint256'],
          [dai.address, userAddress, 0, expectedDaiAmount, 1]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              0,
              params,
              0
            )
        ).to.be.revertedWith('INSUFFICIENT_OUTPUT_AMOUNT');
      });

      it('should revert when max amount allowed to swap is bigger than max slippage', async () => {
        const {users, pool, weth, oracle, dai, aEth, uniswapRepayAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        // Open user Debt
        await pool.connect(user).borrow(dai.address, expectedDaiAmount, 1, 0, userAddress);

        await aEth.connect(user).approve(uniswapRepayAdapter.address, amountWETHtoSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const bigMaxAmountToSwap = amountWETHtoSwap.mul(2);
        const flashloanAmount = new BigNumber(bigMaxAmountToSwap.toString()).div(1.0009).toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(flashloanAmount);
        await mockUniswapRouter.connect(user).setAmountToReturn(expectedDaiAmount);

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint256', 'uint256', 'uint256'],
          [dai.address, userAddress, 0, expectedDaiAmount, 1]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              0,
              params,
              0
            )
        ).to.be.revertedWith('maxAmountToSwap exceed max slippage');
      });

      it('should swap tokens, repay debt and deposit in pool the left over', async () => {
        const {
          users,
          pool,
          weth,
          aEth,
          oracle,
          dai,
          uniswapRepayAdapter,
          helpersContract,
        } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        // Open user Debt
        await pool.connect(user).borrow(dai.address, expectedDaiAmount, 1, 0, userAddress);

        const daiStableDebtTokenAddress = (
          await helpersContract.getReserveTokensAddresses(dai.address)
        ).stableDebtTokenAddress;

        const daiStableDebtContract = await getContract<StableDebtToken>(
          eContractid.StableDebtToken,
          daiStableDebtTokenAddress
        );

        const userDaiStableDebtAmountBefore = await daiStableDebtContract.balanceOf(userAddress);

        const liquidityToSwap = amountWETHtoSwap;
        await aEth.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);
        const userAEthBalanceBefore = await aEth.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const actualWEthSwapped = new BigNumber(flashloanAmount.toString())
          .multipliedBy(0.995)
          .toFixed(0);

        const leftOverWeth = new BigNumber(flashloanAmount).minus(actualWEthSwapped);

        await mockUniswapRouter.connect(user).setAmountToSwap(actualWEthSwapped);
        await mockUniswapRouter.connect(user).setAmountToReturn(expectedDaiAmount);

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint256', 'uint256', 'uint256'],
          [dai.address, userAddress, 0, expectedDaiAmount, 1]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              0,
              params,
              0
            )
        )
          .to.emit(uniswapRepayAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, actualWEthSwapped.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapRepayAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapRepayAdapter.address);
        const userDaiStableDebtAmount = await daiStableDebtContract.balanceOf(userAddress);
        const userAEthBalance = await aEth.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(userDaiStableDebtAmountBefore).to.be.gte(expectedDaiAmount);
        expect(userDaiStableDebtAmount).to.be.lt(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gt(userAEthBalanceBefore.sub(liquidityToSwap));
        expect(userAEthBalance).to.be.gte(
          userAEthBalanceBefore.sub(liquidityToSwap).add(leftOverWeth.toString())
        );
      });

      it('should swap tokens, repay debt and transfer to user the left over', async () => {
        const {
          users,
          pool,
          weth,
          aEth,
          oracle,
          dai,
          uniswapRepayAdapter,
          helpersContract,
        } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        // Open user Debt
        await pool.connect(user).borrow(dai.address, expectedDaiAmount, 1, 0, userAddress);

        const daiStableDebtTokenAddress = (
          await helpersContract.getReserveTokensAddresses(dai.address)
        ).stableDebtTokenAddress;

        const daiStableDebtContract = await getContract<StableDebtToken>(
          eContractid.StableDebtToken,
          daiStableDebtTokenAddress
        );

        const userDaiStableDebtAmountBefore = await daiStableDebtContract.balanceOf(userAddress);

        const liquidityToSwap = amountWETHtoSwap;
        await aEth.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);
        const userAEthBalanceBefore = await aEth.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const actualWEthSwapped = new BigNumber(flashloanAmount.toString())
          .multipliedBy(0.995)
          .toFixed(0);

        const leftOverWeth = new BigNumber(flashloanAmount).minus(actualWEthSwapped);

        await mockUniswapRouter.connect(user).setAmountToSwap(actualWEthSwapped);
        await mockUniswapRouter.connect(user).setAmountToReturn(expectedDaiAmount);

        const wethBalanceBefore = await weth.balanceOf(userAddress);

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address', 'address', 'uint256', 'uint256', 'uint256'],
          [dai.address, userAddress, 1, expectedDaiAmount, 1]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              0,
              params,
              0
            )
        )
          .to.emit(uniswapRepayAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, actualWEthSwapped.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapRepayAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapRepayAdapter.address);
        const userDaiStableDebtAmount = await daiStableDebtContract.balanceOf(userAddress);
        const userAEthBalance = await aEth.balanceOf(userAddress);
        const wethBalance = await weth.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(userDaiStableDebtAmountBefore).to.be.gte(expectedDaiAmount);
        expect(userDaiStableDebtAmount).to.be.lt(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gt(userAEthBalanceBefore.sub(liquidityToSwap));
        expect(wethBalance).to.be.eq(wethBalanceBefore.add(leftOverWeth.toString()));
      });
    });
  });
});
