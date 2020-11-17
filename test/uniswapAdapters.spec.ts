import {makeSuite, TestEnv} from './helpers/make-suite';
import {
  convertToCurrencyDecimals,
  getContract,
  buildPermitParams,
  getSignatureFromTypedData,
  buildLiquiditySwapParams,
  buildRepayAdapterParams,
} from '../helpers/contracts-helpers';
import {getMockUniswapRouter} from '../helpers/contracts-getters';
import {
  deployUniswapLiquiditySwapAdapter,
  deployUniswapRepayAdapter,
} from '../helpers/contracts-deployments';
import {MockUniswapV2Router02} from '../types/MockUniswapV2Router02';
import {Zero} from '@ethersproject/constants';
import BigNumber from 'bignumber.js';
import {DRE, evmRevert, evmSnapshot} from '../helpers/misc-utils';
import {ethers} from 'ethers';
import {eContractid} from '../helpers/types';
import {AToken} from '../types/AToken';
import {StableDebtToken} from '../types/StableDebtToken';
import {BUIDLEREVM_CHAINID} from '../helpers/buidler-constants';
import {MAX_UINT_AMOUNT, USD_ADDRESS} from '../helpers/constants';
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

  describe('BaseUniswapAdapter', () => {
    describe('getAmountsOut', () => {
      it('should return the estimated amountOut and prices for the asset swap', async () => {
        const {weth, dai, uniswapLiquiditySwapAdapter, oracle} = testEnv;

        const amountIn = parseEther('1');
        const flashloanPremium = amountIn.mul(9).div(10000);
        const amountToSwap = amountIn.sub(flashloanPremium);

        const wethPrice = await oracle.getAssetPrice(weth.address);
        const daiPrice = await oracle.getAssetPrice(dai.address);
        const usdPrice = await oracle.getAssetPrice(USD_ADDRESS);

        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountToSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const outPerInPrice = amountToSwap
          .mul(parseEther('1'))
          .mul(parseEther('1'))
          .div(expectedDaiAmount.mul(parseEther('1')));
        const ethUsdValue = amountIn
          .mul(wethPrice)
          .div(parseEther('1'))
          .mul(usdPrice)
          .div(parseEther('1'));
        const daiUsdValue = expectedDaiAmount
          .mul(daiPrice)
          .div(parseEther('1'))
          .mul(usdPrice)
          .div(parseEther('1'));

        await mockUniswapRouter.setAmountOut(
          amountToSwap,
          weth.address,
          dai.address,
          expectedDaiAmount
        );

        const result = await uniswapLiquiditySwapAdapter.getAmountsOut(
          amountIn,
          weth.address,
          dai.address
        );

        expect(result['0']).to.be.eq(expectedDaiAmount);
        expect(result['1']).to.be.eq(outPerInPrice);
        expect(result['2']).to.be.eq(ethUsdValue);
        expect(result['3']).to.be.eq(daiUsdValue);
      });
      it('should work correctly with different decimals', async () => {
        const {aave, usdc, uniswapLiquiditySwapAdapter, oracle} = testEnv;

        const amountIn = parseEther('10');
        const flashloanPremium = amountIn.mul(9).div(10000);
        const amountToSwap = amountIn.sub(flashloanPremium);

        const aavePrice = await oracle.getAssetPrice(aave.address);
        const usdcPrice = await oracle.getAssetPrice(usdc.address);
        const usdPrice = await oracle.getAssetPrice(USD_ADDRESS);

        const expectedUSDCAmount = await convertToCurrencyDecimals(
          usdc.address,
          new BigNumber(amountToSwap.toString()).div(usdcPrice.toString()).toFixed(0)
        );

        const outPerInPrice = amountToSwap
          .mul(parseEther('1'))
          .mul('1000000') // usdc 6 decimals
          .div(expectedUSDCAmount.mul(parseEther('1')));

        const aaveUsdValue = amountIn
          .mul(aavePrice)
          .div(parseEther('1'))
          .mul(usdPrice)
          .div(parseEther('1'));

        const usdcUsdValue = expectedUSDCAmount
          .mul(usdcPrice)
          .div('1000000') // usdc 6 decimals
          .mul(usdPrice)
          .div(parseEther('1'));

        await mockUniswapRouter.setAmountOut(
          amountToSwap,
          aave.address,
          usdc.address,
          expectedUSDCAmount
        );

        const result = await uniswapLiquiditySwapAdapter.getAmountsOut(
          amountIn,
          aave.address,
          usdc.address
        );

        expect(result['0']).to.be.eq(expectedUSDCAmount);
        expect(result['1']).to.be.eq(outPerInPrice);
        expect(result['2']).to.be.eq(aaveUsdValue);
        expect(result['3']).to.be.eq(usdcUsdValue);
      });
    });

    describe('getAmountsIn', () => {
      it('should return the estimated required amountIn for the asset swap', async () => {
        const {weth, dai, uniswapLiquiditySwapAdapter, oracle} = testEnv;

        const amountIn = parseEther('1');
        const flashloanPremium = amountIn.mul(9).div(10000);
        const amountToSwap = amountIn.add(flashloanPremium);

        const wethPrice = await oracle.getAssetPrice(weth.address);
        const daiPrice = await oracle.getAssetPrice(dai.address);
        const usdPrice = await oracle.getAssetPrice(USD_ADDRESS);

        const amountOut = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountIn.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const inPerOutPrice = amountOut
          .mul(parseEther('1'))
          .mul(parseEther('1'))
          .div(amountToSwap.mul(parseEther('1')));

        const ethUsdValue = amountToSwap
          .mul(wethPrice)
          .div(parseEther('1'))
          .mul(usdPrice)
          .div(parseEther('1'));
        const daiUsdValue = amountOut
          .mul(daiPrice)
          .div(parseEther('1'))
          .mul(usdPrice)
          .div(parseEther('1'));

        await mockUniswapRouter.setAmountIn(amountOut, weth.address, dai.address, amountIn);

        const result = await uniswapLiquiditySwapAdapter.getAmountsIn(
          amountOut,
          weth.address,
          dai.address
        );

        expect(result['0']).to.be.eq(amountToSwap);
        expect(result['1']).to.be.eq(inPerOutPrice);
        expect(result['2']).to.be.eq(ethUsdValue);
        expect(result['3']).to.be.eq(daiUsdValue);
      });
      it('should work correctly with different decimals', async () => {
        const {aave, usdc, uniswapLiquiditySwapAdapter, oracle} = testEnv;

        const amountIn = parseEther('10');
        const flashloanPremium = amountIn.mul(9).div(10000);
        const amountToSwap = amountIn.add(flashloanPremium);

        const aavePrice = await oracle.getAssetPrice(aave.address);
        const usdcPrice = await oracle.getAssetPrice(usdc.address);
        const usdPrice = await oracle.getAssetPrice(USD_ADDRESS);

        const amountOut = await convertToCurrencyDecimals(
          usdc.address,
          new BigNumber(amountToSwap.toString()).div(usdcPrice.toString()).toFixed(0)
        );

        const inPerOutPrice = amountOut
          .mul(parseEther('1'))
          .mul(parseEther('1'))
          .div(amountToSwap.mul('1000000')); // usdc 6 decimals

        const aaveUsdValue = amountToSwap
          .mul(aavePrice)
          .div(parseEther('1'))
          .mul(usdPrice)
          .div(parseEther('1'));

        const usdcUsdValue = amountOut
          .mul(usdcPrice)
          .div('1000000') // usdc 6 decimals
          .mul(usdPrice)
          .div(parseEther('1'));

        await mockUniswapRouter.setAmountIn(amountOut, aave.address, usdc.address, amountIn);

        const result = await uniswapLiquiditySwapAdapter.getAmountsIn(
          amountOut,
          aave.address,
          usdc.address
        );

        expect(result['0']).to.be.eq(amountToSwap);
        expect(result['1']).to.be.eq(inPerOutPrice);
        expect(result['2']).to.be.eq(aaveUsdValue);
        expect(result['3']).to.be.eq(usdcUsdValue);
      });
    });
  });

  describe('UniswapLiquiditySwapAdapter', () => {
    describe('constructor', () => {
      it('should deploy with correct parameters', async () => {
        const {addressesProvider} = testEnv;
        await deployUniswapLiquiditySwapAdapter([
          addressesProvider.address,
          mockUniswapRouter.address,
        ]);
      });

      it('should revert if not valid addresses provider', async () => {
        expect(
          deployUniswapLiquiditySwapAdapter([mockUniswapRouter.address, mockUniswapRouter.address])
        ).to.be.reverted;
      });
    });

    describe('executeOperation', () => {
      beforeEach(async () => {
        const {users, weth, dai, usdc, pool, deployer} = testEnv;
        const userAddress = users[0].address;

        // Provide liquidity
        await dai.mint(parseEther('20000'));
        await dai.approve(pool.address, parseEther('20000'));
        await pool.deposit(dai.address, parseEther('20000'), deployer.address, 0);

        const usdcAmount = await convertToCurrencyDecimals(usdc.address, '10');
        await usdc.mint(usdcAmount);
        await usdc.approve(pool.address, usdcAmount);
        await pool.deposit(usdc.address, usdcAmount, deployer.address, 0);

        // Make a deposit for user
        await weth.mint(parseEther('100'));
        await weth.approve(pool.address, parseEther('100'));
        await pool.deposit(weth.address, parseEther('100'), userAddress, 0);
      });

      it('should correctly swap tokens and deposit the out tokens in the pool', async () => {
        const {users, weth, oracle, dai, aDai, aWETH, pool, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aWETH.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000']
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
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
        const userAEthBalance = await aWETH.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should correctly swap and deposit multiple tokens', async () => {
        const {
          users,
          weth,
          oracle,
          dai,
          aDai,
          aWETH,
          usdc,
          pool,
          uniswapLiquiditySwapAdapter,
        } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmountForEth = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const amountUSDCtoSwap = await convertToCurrencyDecimals(usdc.address, '10');
        const usdcPrice = await oracle.getAssetPrice(usdc.address);

        const collateralDecimals = (await usdc.decimals()).toString();
        const principalDecimals = (await dai.decimals()).toString();

        const expectedDaiAmountForUsdc = await convertToCurrencyDecimals(
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

        // Make a deposit for user
        await usdc.connect(user).mint(amountUSDCtoSwap);
        await usdc.connect(user).approve(pool.address, amountUSDCtoSwap);
        await pool.connect(user).deposit(usdc.address, amountUSDCtoSwap, userAddress, 0);

        const aUsdcData = await pool.getReserveData(usdc.address);
        const aUsdc = await getContract<AToken>(eContractid.AToken, aUsdcData.aTokenAddress);

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmountForEth);
        await mockUniswapRouter.setAmountToReturn(usdc.address, expectedDaiAmountForUsdc);

        await aWETH.connect(user).approve(uniswapLiquiditySwapAdapter.address, amountWETHtoSwap);
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);
        await aUsdc.connect(user).approve(uniswapLiquiditySwapAdapter.address, amountUSDCtoSwap);
        const userAUsdcBalanceBefore = await aUsdc.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const wethFlashloanAmount = new BigNumber(amountWETHtoSwap.toString())
          .div(1.0009)
          .toFixed(0);
        const usdcFlashloanAmount = new BigNumber(amountUSDCtoSwap.toString())
          .div(1.0009)
          .toFixed(0);

        const params = buildLiquiditySwapParams(
          [dai.address, dai.address],
          [expectedDaiAmountForEth, expectedDaiAmountForUsdc],
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ]
        );

        await pool
          .connect(user)
          .flashLoan(
            uniswapLiquiditySwapAdapter.address,
            [weth.address, usdc.address],
            [wethFlashloanAmount.toString(), usdcFlashloanAmount.toString()],
            [0, 0],
            userAddress,
            params,
            0
          );

        const adapterWethBalance = await weth.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);
        const userAUsdcBalance = await aUsdc.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmountForEth.add(expectedDaiAmountForUsdc));
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(amountWETHtoSwap));
        expect(userAUsdcBalance).to.be.lt(userAUsdcBalanceBefore);
        expect(userAUsdcBalance).to.be.gte(userAUsdcBalanceBefore.sub(amountUSDCtoSwap));
      });

      it('should correctly swap and deposit multiple tokens using permit', async () => {
        const {
          users,
          weth,
          oracle,
          dai,
          aDai,
          aWETH,
          usdc,
          pool,
          uniswapLiquiditySwapAdapter,
        } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;
        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;

        const ownerPrivateKey = require('../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmountForEth = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const amountUSDCtoSwap = await convertToCurrencyDecimals(usdc.address, '10');
        const usdcPrice = await oracle.getAssetPrice(usdc.address);

        const collateralDecimals = (await usdc.decimals()).toString();
        const principalDecimals = (await dai.decimals()).toString();

        const expectedDaiAmountForUsdc = await convertToCurrencyDecimals(
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

        // Make a deposit for user
        await usdc.connect(user).mint(amountUSDCtoSwap);
        await usdc.connect(user).approve(pool.address, amountUSDCtoSwap);
        await pool.connect(user).deposit(usdc.address, amountUSDCtoSwap, userAddress, 0);

        const aUsdcData = await pool.getReserveData(usdc.address);
        const aUsdc = await getContract<AToken>(eContractid.AToken, aUsdcData.aTokenAddress);

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmountForEth);
        await mockUniswapRouter.setAmountToReturn(usdc.address, expectedDaiAmountForUsdc);

        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);
        const userAUsdcBalanceBefore = await aUsdc.balanceOf(userAddress);

        const wethFlashloanAmount = new BigNumber(amountWETHtoSwap.toString())
          .div(1.0009)
          .toFixed(0);

        const usdcFlashloanAmount = new BigNumber(amountUSDCtoSwap.toString())
          .div(1.0009)
          .toFixed(0);

        const aWethNonce = (await aWETH._nonces(userAddress)).toNumber();
        const aWethMsgParams = buildPermitParams(
          chainId,
          aWETH.address,
          '1',
          await aWETH.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          aWethNonce,
          deadline,
          amountWETHtoSwap.toString()
        );
        const {v: aWETHv, r: aWETHr, s: aWETHs} = getSignatureFromTypedData(
          ownerPrivateKey,
          aWethMsgParams
        );

        const aUsdcNonce = (await aUsdc._nonces(userAddress)).toNumber();
        const aUsdcMsgParams = buildPermitParams(
          chainId,
          aUsdc.address,
          '1',
          await aUsdc.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          aUsdcNonce,
          deadline,
          amountUSDCtoSwap.toString()
        );
        const {v: aUsdcv, r: aUsdcr, s: aUsdcs} = getSignatureFromTypedData(
          ownerPrivateKey,
          aUsdcMsgParams
        );
        const params = buildLiquiditySwapParams(
          [dai.address, dai.address],
          [expectedDaiAmountForEth, expectedDaiAmountForUsdc],
          [0, 0],
          [amountWETHtoSwap, amountUSDCtoSwap],
          [deadline, deadline],
          [aWETHv, aUsdcv],
          [aWETHr, aUsdcr],
          [aWETHs, aUsdcs]
        );

        await pool
          .connect(user)
          .flashLoan(
            uniswapLiquiditySwapAdapter.address,
            [weth.address, usdc.address],
            [wethFlashloanAmount.toString(), usdcFlashloanAmount.toString()],
            [0, 0],
            userAddress,
            params,
            0
          );

        const adapterWethBalance = await weth.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);
        const userAUsdcBalance = await aUsdc.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmountForEth.add(expectedDaiAmountForUsdc));
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(amountWETHtoSwap));
        expect(userAUsdcBalance).to.be.lt(userAUsdcBalanceBefore);
        expect(userAUsdcBalance).to.be.gte(userAUsdcBalanceBefore.sub(amountUSDCtoSwap));
      });

      it('should correctly swap tokens with permit', async () => {
        const {users, weth, oracle, dai, aDai, aWETH, pool, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;
        const nonce = (await aWETH._nonces(userAddress)).toNumber();
        const msgParams = buildPermitParams(
          chainId,
          aWETH.address,
          '1',
          await aWETH.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          nonce,
          deadline,
          liquidityToSwap.toString()
        );

        const ownerPrivateKey = require('../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const {v, r, s} = getSignatureFromTypedData(ownerPrivateKey, msgParams);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0],
          [liquidityToSwap],
          [deadline],
          [v],
          [r],
          [s]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
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
        const userAEthBalance = await aWETH.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should revert if inconsistent params', async () => {
        const {users, weth, oracle, dai, aWETH, pool, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aWETH.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const params = buildLiquiditySwapParams(
          [dai.address, weth.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000']
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params2 = buildLiquiditySwapParams(
          [dai.address, weth.address],
          [expectedDaiAmount],
          [0, 0],
          [0, 0],
          [0, 0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000']
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params2,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params3 = buildLiquiditySwapParams(
          [dai.address, weth.address],
          [expectedDaiAmount],
          [0, 0],
          [0],
          [0, 0],
          [0, 0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000']
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params3,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params4 = buildLiquiditySwapParams(
          [dai.address, weth.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          ['0x0000000000000000000000000000000000000000000000000000000000000000']
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params4,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params5 = buildLiquiditySwapParams(
          [dai.address, weth.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params5,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params6 = buildLiquiditySwapParams(
          [dai.address, weth.address],
          [expectedDaiAmount, expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000']
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params6,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params7 = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0, 0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000']
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params7,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params8 = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0],
          [0, 0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000']
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params8,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');
      });

      it('should revert if caller not lending pool', async () => {
        const {users, weth, oracle, dai, aWETH, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aWETH.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000']
        );

        await expect(
          uniswapLiquiditySwapAdapter
            .connect(user)
            .executeOperation(
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params
            )
        ).to.be.revertedWith('CALLER_MUST_BE_LENDING_POOL');
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

        await mockUniswapRouter.connect(user).setAmountToReturn(usdc.address, expectedDaiAmount);

        const aUsdcData = await pool.getReserveData(usdc.address);
        const aUsdc = await getContract<AToken>(eContractid.AToken, aUsdcData.aTokenAddress);
        const aUsdcBalance = await aUsdc.balanceOf(userAddress);
        await aUsdc.connect(user).approve(uniswapLiquiditySwapAdapter.address, aUsdcBalance);
        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(amountUSDCtoSwap.toString()).div(1.0009).toFixed(0);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000']
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [usdc.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
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

      it('should revert when min amount to receive exceeds the max slippage amount', async () => {
        const {users, weth, oracle, dai, aWETH, pool, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmount);
        const smallExpectedDaiAmount = expectedDaiAmount.div(2);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aWETH.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [smallExpectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000']
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        ).to.be.revertedWith('minAmountOut exceed max slippage');
      });

      it('should correctly swap tokens all the balance', async () => {
        const {users, weth, oracle, dai, aDai, aWETH, pool, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmount);

        // Remove other balance
        await aWETH.connect(user).transfer(users[1].address, parseEther('90'));
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        expect(userAEthBalanceBefore).to.be.eq(liquidityToSwap);
        await aWETH.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [1],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000']
        );

        // Flashloan + premium > aToken balance. Then it will only swap the balance - premium
        const flashloanFee = liquidityToSwap.mul(9).div(10000);
        const swappedAmount = liquidityToSwap.sub(flashloanFee);

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [liquidityToSwap.toString()],
              [0],
              userAddress,
              params,
              0
            )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, swappedAmount.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);
        const adapterAEthBalance = await aWETH.balanceOf(uniswapLiquiditySwapAdapter.address);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.eq(Zero);
        expect(adapterAEthBalance).to.be.eq(Zero);
      });

      it('should correctly swap tokens all the balance using permit', async () => {
        const {users, weth, oracle, dai, aDai, aWETH, pool, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmount);

        // Remove other balance
        await aWETH.connect(user).transfer(users[1].address, parseEther('90'));
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        const liquidityToSwap = parseEther('10');
        expect(userAEthBalanceBefore).to.be.eq(liquidityToSwap);

        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;
        const nonce = (await aWETH._nonces(userAddress)).toNumber();
        const msgParams = buildPermitParams(
          chainId,
          aWETH.address,
          '1',
          await aWETH.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          nonce,
          deadline,
          liquidityToSwap.toString()
        );

        const ownerPrivateKey = require('../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const {v, r, s} = getSignatureFromTypedData(ownerPrivateKey, msgParams);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [1],
          [liquidityToSwap],
          [deadline],
          [v],
          [r],
          [s]
        );

        // Flashloan + premium > aToken balance. Then it will only swap the balance - premium
        const flashloanFee = liquidityToSwap.mul(9).div(10000);
        const swappedAmount = liquidityToSwap.sub(flashloanFee);

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [weth.address],
              [liquidityToSwap.toString()],
              [0],
              userAddress,
              params,
              0
            )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, swappedAmount.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);
        const adapterAEthBalance = await aWETH.balanceOf(uniswapLiquiditySwapAdapter.address);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.eq(Zero);
        expect(adapterAEthBalance).to.be.eq(Zero);
      });
    });

    describe('swapAndDeposit', () => {
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
        const {users, weth, oracle, dai, aDai, aWETH, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aWETH.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [weth.address],
            [dai.address],
            [amountWETHtoSwap],
            [expectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ]
          )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, amountWETHtoSwap.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should correctly swap tokens using permit', async () => {
        const {users, weth, oracle, dai, aDai, aWETH, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;
        const nonce = (await aWETH._nonces(userAddress)).toNumber();
        const msgParams = buildPermitParams(
          chainId,
          aWETH.address,
          '1',
          await aWETH.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          nonce,
          deadline,
          liquidityToSwap.toString()
        );

        const ownerPrivateKey = require('../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const {v, r, s} = getSignatureFromTypedData(ownerPrivateKey, msgParams);

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [weth.address],
            [dai.address],
            [amountWETHtoSwap],
            [expectedDaiAmount],
            [
              {
                amount: liquidityToSwap,
                deadline,
                v,
                r,
                s,
              },
            ]
          )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, amountWETHtoSwap.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should revert if inconsistent params', async () => {
        const {users, weth, dai, uniswapLiquiditySwapAdapter, oracle} = testEnv;
        const user = users[0].signer;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');
        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [weth.address, dai.address],
            [dai.address],
            [amountWETHtoSwap],
            [expectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ]
          )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [weth.address],
            [dai.address, weth.address],
            [amountWETHtoSwap],
            [expectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ]
          )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [weth.address],
            [dai.address],
            [amountWETHtoSwap, amountWETHtoSwap],
            [expectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ]
          )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        await expect(
          uniswapLiquiditySwapAdapter
            .connect(user)
            .swapAndDeposit(
              [weth.address],
              [dai.address],
              [amountWETHtoSwap],
              [expectedDaiAmount],
              []
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [weth.address],
            [dai.address],
            [amountWETHtoSwap],
            [expectedDaiAmount, expectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ]
          )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');
      });

      it('should revert when min amount to receive exceeds the max slippage amount', async () => {
        const {users, weth, oracle, dai, aWETH, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmount);
        const smallExpectedDaiAmount = expectedDaiAmount.div(2);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aWETH.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [weth.address],
            [dai.address],
            [amountWETHtoSwap],
            [smallExpectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ]
          )
        ).to.be.revertedWith('minAmountOut exceed max slippage');
      });

      it('should correctly swap tokens and deposit multiple tokens', async () => {
        const {
          users,
          weth,
          usdc,
          oracle,
          dai,
          aDai,
          aWETH,
          uniswapLiquiditySwapAdapter,
          pool,
        } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmountForEth = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const amountUSDCtoSwap = await convertToCurrencyDecimals(usdc.address, '10');
        const usdcPrice = await oracle.getAssetPrice(usdc.address);

        const collateralDecimals = (await usdc.decimals()).toString();
        const principalDecimals = (await dai.decimals()).toString();

        const expectedDaiAmountForUsdc = await convertToCurrencyDecimals(
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

        // Make a deposit for user
        await usdc.connect(user).mint(amountUSDCtoSwap);
        await usdc.connect(user).approve(pool.address, amountUSDCtoSwap);
        await pool.connect(user).deposit(usdc.address, amountUSDCtoSwap, userAddress, 0);

        const aUsdcData = await pool.getReserveData(usdc.address);
        const aUsdc = await getContract<AToken>(eContractid.AToken, aUsdcData.aTokenAddress);

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmountForEth);
        await mockUniswapRouter.setAmountToReturn(usdc.address, expectedDaiAmountForUsdc);

        await aWETH.connect(user).approve(uniswapLiquiditySwapAdapter.address, amountWETHtoSwap);
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);
        await aUsdc.connect(user).approve(uniswapLiquiditySwapAdapter.address, amountUSDCtoSwap);
        const userAUsdcBalanceBefore = await aUsdc.balanceOf(userAddress);

        await uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
          [weth.address, usdc.address],
          [dai.address, dai.address],
          [amountWETHtoSwap, amountUSDCtoSwap],
          [expectedDaiAmountForEth, expectedDaiAmountForUsdc],
          [
            {
              amount: 0,
              deadline: 0,
              v: 0,
              r: '0x0000000000000000000000000000000000000000000000000000000000000000',
              s: '0x0000000000000000000000000000000000000000000000000000000000000000',
            },
            {
              amount: 0,
              deadline: 0,
              v: 0,
              r: '0x0000000000000000000000000000000000000000000000000000000000000000',
              s: '0x0000000000000000000000000000000000000000000000000000000000000000',
            },
          ]
        );

        const adapterWethBalance = await weth.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);
        const userAUsdcBalance = await aUsdc.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmountForEth.add(expectedDaiAmountForUsdc));
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(amountWETHtoSwap));
        expect(userAUsdcBalance).to.be.lt(userAUsdcBalanceBefore);
        expect(userAUsdcBalance).to.be.gte(userAUsdcBalanceBefore.sub(amountUSDCtoSwap));
      });

      it('should correctly swap tokens and deposit multiple tokens using permit', async () => {
        const {
          users,
          weth,
          usdc,
          oracle,
          dai,
          aDai,
          aWETH,
          uniswapLiquiditySwapAdapter,
          pool,
        } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;
        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;

        const ownerPrivateKey = require('../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmountForEth = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const amountUSDCtoSwap = await convertToCurrencyDecimals(usdc.address, '10');
        const usdcPrice = await oracle.getAssetPrice(usdc.address);

        const collateralDecimals = (await usdc.decimals()).toString();
        const principalDecimals = (await dai.decimals()).toString();

        const expectedDaiAmountForUsdc = await convertToCurrencyDecimals(
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

        // Make a deposit for user
        await usdc.connect(user).mint(amountUSDCtoSwap);
        await usdc.connect(user).approve(pool.address, amountUSDCtoSwap);
        await pool.connect(user).deposit(usdc.address, amountUSDCtoSwap, userAddress, 0);

        const aUsdcData = await pool.getReserveData(usdc.address);
        const aUsdc = await getContract<AToken>(eContractid.AToken, aUsdcData.aTokenAddress);

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmountForEth);
        await mockUniswapRouter.setAmountToReturn(usdc.address, expectedDaiAmountForUsdc);

        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);
        const userAUsdcBalanceBefore = await aUsdc.balanceOf(userAddress);

        const aWethNonce = (await aWETH._nonces(userAddress)).toNumber();
        const aWethMsgParams = buildPermitParams(
          chainId,
          aWETH.address,
          '1',
          await aWETH.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          aWethNonce,
          deadline,
          amountWETHtoSwap.toString()
        );
        const {v: aWETHv, r: aWETHr, s: aWETHs} = getSignatureFromTypedData(
          ownerPrivateKey,
          aWethMsgParams
        );

        const aUsdcNonce = (await aUsdc._nonces(userAddress)).toNumber();
        const aUsdcMsgParams = buildPermitParams(
          chainId,
          aUsdc.address,
          '1',
          await aUsdc.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          aUsdcNonce,
          deadline,
          amountUSDCtoSwap.toString()
        );
        const {v: aUsdcv, r: aUsdcr, s: aUsdcs} = getSignatureFromTypedData(
          ownerPrivateKey,
          aUsdcMsgParams
        );

        await uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
          [weth.address, usdc.address],
          [dai.address, dai.address],
          [amountWETHtoSwap, amountUSDCtoSwap],
          [expectedDaiAmountForEth, expectedDaiAmountForUsdc],
          [
            {
              amount: amountWETHtoSwap,
              deadline,
              v: aWETHv,
              r: aWETHr,
              s: aWETHs,
            },
            {
              amount: amountUSDCtoSwap,
              deadline,
              v: aUsdcv,
              r: aUsdcr,
              s: aUsdcs,
            },
          ]
        );

        const adapterWethBalance = await weth.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);
        const userAUsdcBalance = await aUsdc.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmountForEth.add(expectedDaiAmountForUsdc));
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(amountWETHtoSwap));
        expect(userAUsdcBalance).to.be.lt(userAUsdcBalanceBefore);
        expect(userAUsdcBalance).to.be.gte(userAUsdcBalanceBefore.sub(amountUSDCtoSwap));
      });

      it('should correctly swap all the balance when using a bigger amount', async () => {
        const {users, weth, oracle, dai, aDai, aWETH, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmount);

        // Remove other balance
        await aWETH.connect(user).transfer(users[1].address, parseEther('90'));
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        expect(userAEthBalanceBefore).to.be.eq(liquidityToSwap);

        // User will swap liquidity 10 aEth to aDai
        await aWETH.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);

        // Only has 10 atokens, so all the balance will be swapped
        const bigAmountToSwap = parseEther('100');

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [weth.address],
            [dai.address],
            [bigAmountToSwap],
            [expectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ]
          )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, amountWETHtoSwap.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);
        const adapterAEthBalance = await aWETH.balanceOf(uniswapLiquiditySwapAdapter.address);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.eq(Zero);
        expect(adapterAEthBalance).to.be.eq(Zero);
      });

      it('should correctly swap all the balance when using permit', async () => {
        const {users, weth, oracle, dai, aDai, aWETH, uniswapLiquiditySwapAdapter} = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(weth.address, expectedDaiAmount);

        // Remove other balance
        await aWETH.connect(user).transfer(users[1].address, parseEther('90'));
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        expect(userAEthBalanceBefore).to.be.eq(liquidityToSwap);

        // Only has 10 atokens, so all the balance will be swapped
        const bigAmountToSwap = parseEther('100');

        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;

        const ownerPrivateKey = require('../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }
        const aWethNonce = (await aWETH._nonces(userAddress)).toNumber();
        const aWethMsgParams = buildPermitParams(
          chainId,
          aWETH.address,
          '1',
          await aWETH.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          aWethNonce,
          deadline,
          bigAmountToSwap.toString()
        );
        const {v, r, s} = getSignatureFromTypedData(ownerPrivateKey, aWethMsgParams);

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [weth.address],
            [dai.address],
            [bigAmountToSwap],
            [expectedDaiAmount],
            [
              {
                amount: bigAmountToSwap,
                deadline,
                v,
                r,
                s,
              },
            ]
          )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, amountWETHtoSwap.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);
        const adapterAEthBalance = await aWETH.balanceOf(uniswapLiquiditySwapAdapter.address);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.eq(Zero);
        expect(adapterAEthBalance).to.be.eq(Zero);
      });
    });
  });

  describe('UniswapRepayAdapter', () => {
    describe('constructor', () => {
      it('should deploy with correct parameters', async () => {
        const {addressesProvider} = testEnv;
        await deployUniswapRepayAdapter([addressesProvider.address, mockUniswapRouter.address]);
      });

      it('should revert if not valid addresses provider', async () => {
        expect(deployUniswapRepayAdapter([mockUniswapRouter.address, mockUniswapRouter.address])).to
          .be.reverted;
      });
    });

    describe('executeOperation', () => {
      beforeEach(async () => {
        const {users, weth, dai, usdc, aave, pool, deployer} = testEnv;
        const userAddress = users[0].address;

        // Provide liquidity
        await dai.mint(parseEther('20000'));
        await dai.approve(pool.address, parseEther('20000'));
        await pool.deposit(dai.address, parseEther('20000'), deployer.address, 0);

        const usdcLiquidity = await convertToCurrencyDecimals(usdc.address, '2000000');
        await usdc.mint(usdcLiquidity);
        await usdc.approve(pool.address, usdcLiquidity);
        await pool.deposit(usdc.address, usdcLiquidity, deployer.address, 0);

        await weth.mint(parseEther('100'));
        await weth.approve(pool.address, parseEther('100'));
        await pool.deposit(weth.address, parseEther('100'), deployer.address, 0);

        await aave.mint(parseEther('1000000'));
        await aave.approve(pool.address, parseEther('1000000'));
        await pool.deposit(aave.address, parseEther('1000000'), deployer.address, 0);

        // Make a deposit for user
        await weth.mint(parseEther('1000'));
        await weth.approve(pool.address, parseEther('1000'));
        await pool.deposit(weth.address, parseEther('1000'), userAddress, 0);

        await aave.mint(parseEther('1000000'));
        await aave.approve(pool.address, parseEther('1000000'));
        await pool.deposit(aave.address, parseEther('1000000'), userAddress, 0);

        await usdc.mint(usdcLiquidity);
        await usdc.approve(pool.address, usdcLiquidity);
        await pool.deposit(usdc.address, usdcLiquidity, userAddress, 0);
      });

      it('should correctly swap tokens and repay debt', async () => {
        const {
          users,
          pool,
          weth,
          aWETH,
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
        await aWETH.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(weth.address, flashloanAmount);

        const params = buildRepayAdapterParams(
          dai.address,
          expectedDaiAmount,
          1,
          0,
          0,
          0,
          0,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        )
          .to.emit(uniswapRepayAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, flashloanAmount.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapRepayAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapRepayAdapter.address);
        const userDaiStableDebtAmount = await daiStableDebtContract.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(userDaiStableDebtAmountBefore).to.be.gte(expectedDaiAmount);
        expect(userDaiStableDebtAmount).to.be.lt(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should correctly swap tokens and repay debt with permit', async () => {
        const {
          users,
          pool,
          weth,
          aWETH,
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
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;
        const nonce = (await aWETH._nonces(userAddress)).toNumber();
        const msgParams = buildPermitParams(
          chainId,
          aWETH.address,
          '1',
          await aWETH.name(),
          userAddress,
          uniswapRepayAdapter.address,
          nonce,
          deadline,
          liquidityToSwap.toString()
        );

        const ownerPrivateKey = require('../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const {v, r, s} = getSignatureFromTypedData(ownerPrivateKey, msgParams);

        await mockUniswapRouter.connect(user).setAmountToSwap(weth.address, flashloanAmount);

        const params = buildRepayAdapterParams(
          dai.address,
          expectedDaiAmount,
          1,
          0,
          liquidityToSwap,
          deadline,
          v,
          r,
          s
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        )
          .to.emit(uniswapRepayAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, flashloanAmount.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapRepayAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapRepayAdapter.address);
        const userDaiStableDebtAmount = await daiStableDebtContract.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(userDaiStableDebtAmountBefore).to.be.gte(expectedDaiAmount);
        expect(userDaiStableDebtAmount).to.be.lt(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should revert if caller not lending pool', async () => {
        const {users, pool, weth, aWETH, oracle, dai, uniswapRepayAdapter} = testEnv;
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
        await aWETH.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(weth.address, flashloanAmount);

        const params = buildRepayAdapterParams(
          dai.address,
          expectedDaiAmount,
          1,
          0,
          0,
          0,
          0,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        );

        await expect(
          uniswapRepayAdapter
            .connect(user)
            .executeOperation(
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params
            )
        ).to.be.revertedWith('CALLER_MUST_BE_LENDING_POOL');
      });

      it('should revert if there is not debt to repay with the specified rate mode', async () => {
        const {users, pool, weth, oracle, dai, uniswapRepayAdapter, aWETH} = testEnv;
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
        await aWETH.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(weth.address, flashloanAmount);

        const params = buildRepayAdapterParams(
          dai.address,
          expectedDaiAmount,
          1,
          0,
          0,
          0,
          0,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        ).to.be.reverted;
      });

      it('should revert if there is not debt to repay', async () => {
        const {users, pool, weth, oracle, dai, uniswapRepayAdapter, aWETH} = testEnv;
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
        await aWETH.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(weth.address, flashloanAmount);

        const params = buildRepayAdapterParams(
          dai.address,
          expectedDaiAmount,
          1,
          0,
          0,
          0,
          0,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        ).to.be.reverted;
      });

      it('should revert when max amount allowed to swap is bigger than max slippage', async () => {
        const {users, pool, weth, oracle, dai, aWETH, uniswapRepayAdapter} = testEnv;
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

        await aWETH.connect(user).approve(uniswapRepayAdapter.address, amountWETHtoSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const bigMaxAmountToSwap = amountWETHtoSwap.mul(2);
        const flashloanAmount = new BigNumber(bigMaxAmountToSwap.toString()).div(1.0009).toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(weth.address, flashloanAmount);

        const params = buildRepayAdapterParams(
          dai.address,
          expectedDaiAmount,
          1,
          0,
          0,
          0,
          0,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        ).to.be.revertedWith('maxAmountToSwap exceed max slippage');
      });

      it('should swap, repay debt and pull the needed ATokens leaving no leftovers', async () => {
        const {
          users,
          pool,
          weth,
          aWETH,
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
        await aWETH.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const actualWEthSwapped = new BigNumber(flashloanAmount.toString())
          .multipliedBy(0.995)
          .toFixed(0);

        const leftOverWeth = new BigNumber(flashloanAmount).minus(actualWEthSwapped);

        await mockUniswapRouter.connect(user).setAmountToSwap(weth.address, actualWEthSwapped);

        const params = buildRepayAdapterParams(
          dai.address,
          expectedDaiAmount,
          1,
          0,
          0,
          0,
          0,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapRepayAdapter.address,
              [weth.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        )
          .to.emit(uniswapRepayAdapter, 'Swapped')
          .withArgs(weth.address, dai.address, actualWEthSwapped.toString(), expectedDaiAmount);

        const adapterWethBalance = await weth.balanceOf(uniswapRepayAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapRepayAdapter.address);
        const userDaiStableDebtAmount = await daiStableDebtContract.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);
        const adapterAEthBalance = await aWETH.balanceOf(uniswapRepayAdapter.address);

        expect(adapterAEthBalance).to.be.eq(Zero);
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

      it('should correctly swap tokens and repay the whole stable debt', async () => {
        const {
          users,
          pool,
          weth,
          aWETH,
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
        await aWETH.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(weth.address, flashloanAmount);

        // Passed amount to repay is smaller than debt,
        // but repayAllDebt flag is enabled so the whole debt should be paid
        const amountToRepay = expectedDaiAmount.div(2);

        const params = buildRepayAdapterParams(
          dai.address,
          amountToRepay,
          1,
          1,
          0,
          0,
          0,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        );

        await pool
          .connect(user)
          .flashLoan(
            uniswapRepayAdapter.address,
            [weth.address],
            [flashloanAmount.toString()],
            [0],
            userAddress,
            params,
            0
          );

        const adapterWethBalance = await weth.balanceOf(uniswapRepayAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapRepayAdapter.address);
        const userDaiStableDebtAmount = await daiStableDebtContract.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);
        const adapterAEthBalance = await aWETH.balanceOf(uniswapRepayAdapter.address);

        expect(adapterAEthBalance).to.be.eq(Zero);
        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(userDaiStableDebtAmountBefore).to.be.gte(expectedDaiAmount);
        expect(userDaiStableDebtAmount).to.be.eq(Zero);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should correctly swap tokens and repay the whole variable debt', async () => {
        const {
          users,
          pool,
          weth,
          aWETH,
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
        await pool.connect(user).borrow(dai.address, expectedDaiAmount, 2, 0, userAddress);

        const daiStableVariableTokenAddress = (
          await helpersContract.getReserveTokensAddresses(dai.address)
        ).variableDebtTokenAddress;

        const daiVariableDebtContract = await getContract<StableDebtToken>(
          eContractid.VariableDebtToken,
          daiStableVariableTokenAddress
        );

        const userDaiVariableDebtAmountBefore = await daiVariableDebtContract.balanceOf(
          userAddress
        );

        const liquidityToSwap = amountWETHtoSwap;
        await aWETH.connect(user).approve(uniswapRepayAdapter.address, liquidityToSwap);
        const userAEthBalanceBefore = await aWETH.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(weth.address, flashloanAmount);

        // Passed amount to repay is smaller than debt,
        // but repayAllDebt flag is enabled so the whole debt should be paid
        const amountToRepay = expectedDaiAmount.div(2);

        const params = buildRepayAdapterParams(
          dai.address,
          amountToRepay,
          2,
          1,
          0,
          0,
          0,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        );

        await pool
          .connect(user)
          .flashLoan(
            uniswapRepayAdapter.address,
            [weth.address],
            [flashloanAmount.toString()],
            [0],
            userAddress,
            params,
            0
          );

        const adapterWethBalance = await weth.balanceOf(uniswapRepayAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapRepayAdapter.address);
        const userDaiVariableDebtAmount = await daiVariableDebtContract.balanceOf(userAddress);
        const userAEthBalance = await aWETH.balanceOf(userAddress);
        const adapterAEthBalance = await aWETH.balanceOf(uniswapRepayAdapter.address);

        expect(adapterAEthBalance).to.be.eq(Zero);
        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(userDaiVariableDebtAmountBefore).to.be.gte(expectedDaiAmount);
        expect(userDaiVariableDebtAmount).to.be.eq(Zero);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });
    });
  });
});
