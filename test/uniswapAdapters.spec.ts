import {makeSuite, TestEnv} from './helpers/make-suite';
import {
  convertToCurrencyDecimals,
  getContract,
  buildPermitParams,
  getSignatureFromTypedData,
} from '../helpers/contracts-helpers';
import {getMockUniswapRouter} from '../helpers/contracts-getters';
import {
  deployUniswapLiquiditySwapAdapter,
  deployUniswapRepayAdapter,
} from '../helpers/contracts-deployments';
import {MockUniswapV2Router02} from '../types/MockUniswapV2Router02';
import {Zero} from '@ethersproject/constants';
import BigNumber from 'bignumber.js';
import {BRE, evmRevert, evmSnapshot} from '../helpers/misc-utils';
import {ethers} from 'ethers';
import {eContractid} from '../helpers/types';
import {AToken} from '../types/AToken';
import {StableDebtToken} from '../types/StableDebtToken';
import {BUIDLEREVM_CHAINID} from '../helpers/buidler-constants';
import {MAX_UINT_AMOUNT} from '../helpers/constants';
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
    describe('getAmountOut', () => {
      it('should return the estimated amountOut for the asset swap', async () => {
        const {weth, dai, uniswapLiquiditySwapAdapter} = testEnv;
        const amountIn = parseEther('1');
        const amountOut = parseEther('2');

        await mockUniswapRouter.setAmountOut(amountIn, weth.address, dai.address, amountOut);

        expect(
          await uniswapLiquiditySwapAdapter.getAmountOut(amountIn, weth.address, dai.address)
        ).to.be.eq(amountOut);
      });
    });

    describe('getAmountIn', () => {
      it('should return the estimated required amountIn for the asset swap', async () => {
        const {weth, dai, uniswapLiquiditySwapAdapter} = testEnv;
        const amountIn = parseEther('1');
        const amountOut = parseEther('2');

        await mockUniswapRouter.setAmountIn(amountOut, weth.address, dai.address, amountIn);

        expect(
          await uniswapLiquiditySwapAdapter.getAmountIn(amountOut, weth.address, dai.address)
        ).to.be.eq(amountIn);
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

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [
            [dai.address],
            [expectedDaiAmount],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
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

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [
            [dai.address, dai.address],
            [expectedDaiAmountForEth, expectedDaiAmountForUsdc],
            [0, 0],
            [0, 0],
            [
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            ],
            [
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            ],
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
        const chainId = BRE.network.config.chainId || BUIDLEREVM_CHAINID;
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

        // IMPORTANT: Round down to work equal to solidity to get the correct value for permit call
        BigNumber.config({
          ROUNDING_MODE: 1, //round down
        });

        const wethFlashloanAmountBN = new BigNumber(amountWETHtoSwap.toString()).div(1.0009);
        const wethFlashloanAmount = wethFlashloanAmountBN.toFixed(0);
        const wethFlashloanFee = wethFlashloanAmountBN.multipliedBy(9).div(10000);
        const wethAmountToPermit = wethFlashloanAmountBN.plus(wethFlashloanFee).toFixed(0);

        const usdcFlashloanAmountBN = new BigNumber(amountUSDCtoSwap.toString()).div(1.0009);
        const usdcFlashloanAmount = usdcFlashloanAmountBN.toFixed(0);
        const usdcFlashloanFee = usdcFlashloanAmountBN.multipliedBy(9).div(10000);
        const usdcAmountToPermit = usdcFlashloanAmountBN.plus(usdcFlashloanFee).toFixed(0);

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
          wethAmountToPermit.toString()
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
          usdcAmountToPermit.toString()
        );
        const {v: aUsdcv, r: aUsdcr, s: aUsdcs} = getSignatureFromTypedData(
          ownerPrivateKey,
          aUsdcMsgParams
        );

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [
            [dai.address, dai.address],
            [expectedDaiAmountForEth, expectedDaiAmountForUsdc],
            [deadline, deadline],
            [aWETHv, aUsdcv],
            [aWETHr, aUsdcr],
            [aWETHs, aUsdcs],
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

        // Restore round up
        BigNumber.config({
          ROUNDING_MODE: 0, //round up
        });
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

        // IMPORTANT: Round down to work equal to solidity to get the correct value for permit call
        BigNumber.config({
          ROUNDING_MODE: 1, //round down
        });

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmountBN = new BigNumber(liquidityToSwap.toString()).div(1.0009);
        const flashloanAmount = flashloanAmountBN.toFixed(0);
        const flashloanFee = flashloanAmountBN.multipliedBy(9).div(10000);
        const amountToPermit = flashloanAmountBN.plus(flashloanFee);

        const chainId = BRE.network.config.chainId || BUIDLEREVM_CHAINID;
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
          amountToPermit.toFixed(0).toString()
        );

        const ownerPrivateKey = require('../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const {v, r, s} = getSignatureFromTypedData(ownerPrivateKey, msgParams);

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [[dai.address], [expectedDaiAmount], [deadline], [v], [r], [s]]
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

        // Restore round up
        BigNumber.config({
          ROUNDING_MODE: 0, //round up
        });
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

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [
            [dai.address, weth.address],
            [expectedDaiAmount],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
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
              params,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params2 = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [
            [dai.address, weth.address],
            [expectedDaiAmount],
            [0, 0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
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
              params2,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params3 = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [
            [dai.address, weth.address],
            [expectedDaiAmount],
            [0],
            [0, 0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
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
              params3,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params4 = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [
            [dai.address, weth.address],
            [expectedDaiAmount],
            [0],
            [0],
            [
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            ],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
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
              params4,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params5 = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [
            [dai.address, weth.address],
            [expectedDaiAmount],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            [
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            ],
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

        const params6 = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [
            [dai.address, weth.address],
            [expectedDaiAmount, expectedDaiAmount],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
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
              params6,
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

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [
            [dai.address],
            [expectedDaiAmount],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [
            [dai.address],
            [expectedDaiAmount],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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

        const params = ethers.utils.defaultAbiCoder.encode(
          ['address[]', 'uint256[]', 'uint256[]', 'uint8[]', 'bytes32[]', 'bytes32[]'],
          [
            [dai.address],
            [smallExpectedDaiAmount],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
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
              params,
              0
            )
        ).to.be.revertedWith('minAmountOut exceed max slippage');
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

        const chainId = BRE.network.config.chainId || BUIDLEREVM_CHAINID;
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
              deadline: 0,
              v: 0,
              r: '0x0000000000000000000000000000000000000000000000000000000000000000',
              s: '0x0000000000000000000000000000000000000000000000000000000000000000',
            },
            {
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
        const chainId = BRE.network.config.chainId || BUIDLEREVM_CHAINID;
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
              deadline,
              v: aWETHv,
              r: aWETHr,
              s: aWETHs,
            },
            {
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
        const {users, weth, dai, usdc, lend, pool, deployer} = testEnv;
        const userAddress = users[0].address;

        // Provide liquidity
        await dai.mint(parseEther('20000'));
        await dai.approve(pool.address, parseEther('20000'));
        await pool.deposit(dai.address, parseEther('20000'), deployer.address, 0);

        const usdcLiquidity = await convertToCurrencyDecimals(usdc.address, '20000');
        await usdc.mint(usdcLiquidity);
        await usdc.approve(pool.address, usdcLiquidity);
        await pool.deposit(usdc.address, usdcLiquidity, deployer.address, 0);

        await weth.mint(parseEther('100'));
        await weth.approve(pool.address, parseEther('100'));
        await pool.deposit(weth.address, parseEther('100'), deployer.address, 0);

        await lend.mint(parseEther('1000000'));
        await lend.approve(pool.address, parseEther('1000000'));
        await pool.deposit(lend.address, parseEther('1000000'), deployer.address, 0);

        // Make a deposit for user
        await weth.mint(parseEther('100'));
        await weth.approve(pool.address, parseEther('100'));
        await pool.deposit(weth.address, parseEther('100'), userAddress, 0);

        await lend.mint(parseEther('1000000'));
        await lend.approve(pool.address, parseEther('1000000'));
        await pool.deposit(lend.address, parseEther('1000000'), userAddress, 0);
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

        const params = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            0,
            [expectedDaiAmount],
            [1],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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

        // IMPORTANT: Round down to work equal to solidity to get the correct value for permit call
        BigNumber.config({
          ROUNDING_MODE: 1, //round down
        });

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmountBN = new BigNumber(liquidityToSwap.toString()).div(1.0009);
        const flashloanAmount = flashloanAmountBN.toFixed(0);
        const flashloanFee = flashloanAmountBN.multipliedBy(9).div(10000);
        const amountToPermit = flashloanAmountBN.plus(flashloanFee);

        const chainId = BRE.network.config.chainId || BUIDLEREVM_CHAINID;
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
          amountToPermit.toFixed(0).toString()
        );

        const ownerPrivateKey = require('../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const {v, r, s} = getSignatureFromTypedData(ownerPrivateKey, msgParams);

        await mockUniswapRouter.connect(user).setAmountToSwap(weth.address, flashloanAmount);

        const params = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [[dai.address], 0, [expectedDaiAmount], [1], [deadline], [v], [r], [s]]
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

        // Restore round up
        BigNumber.config({
          ROUNDING_MODE: 0, //round up
        });
      });

      it('should correctly swap tokens and repay debt for multiple tokens', async () => {
        const {
          users,
          pool,
          weth,
          oracle,
          dai,
          uniswapRepayAdapter,
          lend,
          usdc,
          helpersContract,
          aWETH,
        } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');
        const amountLendToSwap = await convertToCurrencyDecimals(lend.address, '1');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmountForEth = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const lendPrice = await oracle.getAssetPrice(lend.address);
        const usdcPrice = await oracle.getAssetPrice(usdc.address);

        const collateralDecimals = (await lend.decimals()).toString();
        const principalDecimals = (await usdc.decimals()).toString();

        const expectedUsdcAmountForLend = await convertToCurrencyDecimals(
          usdc.address,
          new BigNumber(amountLendToSwap.toString())
            .times(
              new BigNumber(lendPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
            )
            .div(
              new BigNumber(usdcPrice.toString()).times(new BigNumber(10).pow(collateralDecimals))
            )
            .toFixed(0)
        );

        // Open user Debt
        await pool.connect(user).borrow(dai.address, expectedDaiAmountForEth, 1, 0, userAddress);
        await pool.connect(user).borrow(usdc.address, expectedUsdcAmountForLend, 1, 0, userAddress);

        const daiStableDebtTokenAddress = (
          await helpersContract.getReserveTokensAddresses(dai.address)
        ).stableDebtTokenAddress;

        const daiStableDebtContract = await getContract<StableDebtToken>(
          eContractid.StableDebtToken,
          daiStableDebtTokenAddress
        );

        const usdcStableDebtTokenAddress = (
          await helpersContract.getReserveTokensAddresses(usdc.address)
        ).stableDebtTokenAddress;

        const usdcStableDebtContract = await getContract<StableDebtToken>(
          eContractid.StableDebtToken,
          usdcStableDebtTokenAddress
        );

        const userDaiStableDebtAmountBefore = await daiStableDebtContract.balanceOf(userAddress);
        const userUsdcStableDebtAmountBefore = await usdcStableDebtContract.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const wethFlashloanAmount = new BigNumber(amountWETHtoSwap.toString())
          .div(1.0009)
          .toFixed(0);
        const lendFlashloanAmount = new BigNumber(amountLendToSwap.toString())
          .div(1.0009)
          .toFixed(0);

        await mockUniswapRouter.connect(user).setAmountToSwap(weth.address, wethFlashloanAmount);
        await mockUniswapRouter.connect(user).setAmountToSwap(lend.address, lendFlashloanAmount);

        await aWETH.connect(user).approve(uniswapRepayAdapter.address, amountWETHtoSwap);

        const lendData = await pool.getReserveData(lend.address);
        const aLend = await getContract<AToken>(eContractid.AToken, lendData.aTokenAddress);
        await aLend.connect(user).approve(uniswapRepayAdapter.address, amountLendToSwap);

        const aWETHBalanceBefore = await aWETH.balanceOf(userAddress);
        const aLendBalanceBefore = await aLend.balanceOf(userAddress);

        const params = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address, usdc.address],
            0,
            [expectedDaiAmountForEth, expectedUsdcAmountForLend],
            [1, 1],
            [0, 0],
            [0, 0],
            [
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            ],
            [
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            ],
          ]
        );

        await pool
          .connect(user)
          .flashLoan(
            uniswapRepayAdapter.address,
            [weth.address, lend.address],
            [wethFlashloanAmount.toString(), lendFlashloanAmount.toString()],
            [0, 0],
            userAddress,
            params,
            0
          );

        const adapterWethBalance = await weth.balanceOf(uniswapRepayAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapRepayAdapter.address);
        const userDaiStableDebtAmount = await daiStableDebtContract.balanceOf(userAddress);
        const userUsdcStableDebtAmount = await usdcStableDebtContract.balanceOf(userAddress);
        const aWETHBalance = await aWETH.balanceOf(userAddress);
        const aLendBalance = await aLend.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(userDaiStableDebtAmountBefore).to.be.gte(expectedDaiAmountForEth);
        expect(userDaiStableDebtAmount).to.be.lt(expectedDaiAmountForEth);
        expect(userUsdcStableDebtAmountBefore).to.be.gte(expectedUsdcAmountForLend);
        expect(userUsdcStableDebtAmount).to.be.lt(expectedUsdcAmountForLend);
        expect(aWETHBalance).to.be.lt(aWETHBalanceBefore);
        expect(aLendBalance).to.be.lt(aLendBalanceBefore);
      });

      it('should swap tokens and repay debt for multiple tokens using permit', async () => {
        const {
          users,
          pool,
          weth,
          oracle,
          dai,
          uniswapRepayAdapter,
          lend,
          usdc,
          helpersContract,
          aWETH,
        } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;
        const chainId = BRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;

        const ownerPrivateKey = require('../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const amountWETHtoSwap = await convertToCurrencyDecimals(weth.address, '10');
        const amountLendToSwap = await convertToCurrencyDecimals(lend.address, '1');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmountForEth = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWETHtoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const lendPrice = await oracle.getAssetPrice(lend.address);
        const usdcPrice = await oracle.getAssetPrice(usdc.address);

        const collateralDecimals = (await lend.decimals()).toString();
        const principalDecimals = (await usdc.decimals()).toString();

        const expectedUsdcAmountForLend = await convertToCurrencyDecimals(
          usdc.address,
          new BigNumber(amountLendToSwap.toString())
            .times(
              new BigNumber(lendPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
            )
            .div(
              new BigNumber(usdcPrice.toString()).times(new BigNumber(10).pow(collateralDecimals))
            )
            .toFixed(0)
        );

        // Open user Debt
        await pool.connect(user).borrow(dai.address, expectedDaiAmountForEth, 1, 0, userAddress);
        await pool.connect(user).borrow(usdc.address, expectedUsdcAmountForLend, 1, 0, userAddress);

        const daiStableDebtTokenAddress = (
          await helpersContract.getReserveTokensAddresses(dai.address)
        ).stableDebtTokenAddress;

        const daiStableDebtContract = await getContract<StableDebtToken>(
          eContractid.StableDebtToken,
          daiStableDebtTokenAddress
        );

        const usdcStableDebtTokenAddress = (
          await helpersContract.getReserveTokensAddresses(usdc.address)
        ).stableDebtTokenAddress;

        const usdcStableDebtContract = await getContract<StableDebtToken>(
          eContractid.StableDebtToken,
          usdcStableDebtTokenAddress
        );

        const userDaiStableDebtAmountBefore = await daiStableDebtContract.balanceOf(userAddress);
        const userUsdcStableDebtAmountBefore = await usdcStableDebtContract.balanceOf(userAddress);

        const lendData = await pool.getReserveData(lend.address);
        const aLend = await getContract<AToken>(eContractid.AToken, lendData.aTokenAddress);

        const aWETHBalanceBefore = await aWETH.balanceOf(userAddress);
        const aLendBalanceBefore = await aLend.balanceOf(userAddress);

        // IMPORTANT: Round down to work equal to solidity to get the correct value for permit call
        BigNumber.config({
          ROUNDING_MODE: 1, //round down
        });

        const wethFlashloanAmountBN = new BigNumber(amountWETHtoSwap.toString()).div(1.0009);
        const wethFlashloanAmount = wethFlashloanAmountBN.toFixed(0);
        const wethFlashloanFee = wethFlashloanAmountBN.multipliedBy(9).div(10000);
        const wethAmountToPermit = wethFlashloanAmountBN.plus(wethFlashloanFee).toFixed(0);

        const lendFlashloanAmountBN = new BigNumber(amountLendToSwap.toString()).div(1.0009);
        const lendFlashloanAmount = lendFlashloanAmountBN.toFixed(0);
        const lendFlashloanFee = lendFlashloanAmountBN.multipliedBy(9).div(10000);
        const lendAmountToPermit = lendFlashloanAmountBN.plus(lendFlashloanFee).toFixed(0);

        const aWethNonce = (await aWETH._nonces(userAddress)).toNumber();
        const aWethMsgParams = buildPermitParams(
          chainId,
          aWETH.address,
          '1',
          await aWETH.name(),
          userAddress,
          uniswapRepayAdapter.address,
          aWethNonce,
          deadline,
          wethAmountToPermit.toString()
        );
        const {v: aWETHv, r: aWETHr, s: aWETHs} = getSignatureFromTypedData(
          ownerPrivateKey,
          aWethMsgParams
        );

        const aLendNonce = (await aLend._nonces(userAddress)).toNumber();
        const aLendMsgParams = buildPermitParams(
          chainId,
          aLend.address,
          '1',
          await aLend.name(),
          userAddress,
          uniswapRepayAdapter.address,
          aLendNonce,
          deadline,
          lendAmountToPermit.toString()
        );
        const {v: aLendv, r: aLendr, s: aLends} = getSignatureFromTypedData(
          ownerPrivateKey,
          aLendMsgParams
        );

        await mockUniswapRouter.connect(user).setAmountToSwap(weth.address, wethFlashloanAmount);
        await mockUniswapRouter.connect(user).setAmountToSwap(lend.address, lendFlashloanAmount);

        const params = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address, usdc.address],
            0,
            [expectedDaiAmountForEth, expectedUsdcAmountForLend],
            [1, 1],
            [deadline, deadline],
            [aWETHv, aLendv],
            [aWETHr, aLendr],
            [aWETHs, aLends],
          ]
        );

        await pool
          .connect(user)
          .flashLoan(
            uniswapRepayAdapter.address,
            [weth.address, lend.address],
            [wethFlashloanAmount.toString(), lendFlashloanAmount.toString()],
            [0, 0],
            userAddress,
            params,
            0
          );

        const adapterWethBalance = await weth.balanceOf(uniswapRepayAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapRepayAdapter.address);
        const userDaiStableDebtAmount = await daiStableDebtContract.balanceOf(userAddress);
        const userUsdcStableDebtAmount = await usdcStableDebtContract.balanceOf(userAddress);
        const aWETHBalance = await aWETH.balanceOf(userAddress);
        const aLendBalance = await aLend.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(userDaiStableDebtAmountBefore).to.be.gte(expectedDaiAmountForEth);
        expect(userDaiStableDebtAmount).to.be.lt(expectedDaiAmountForEth);
        expect(userUsdcStableDebtAmountBefore).to.be.gte(expectedUsdcAmountForLend);
        expect(userUsdcStableDebtAmount).to.be.lt(expectedUsdcAmountForLend);
        expect(aWETHBalance).to.be.lt(aWETHBalanceBefore);
        expect(aLendBalance).to.be.lt(aLendBalanceBefore);

        // Restore round up
        BigNumber.config({
          ROUNDING_MODE: 0, //round up
        });
      });

      it('should revert if inconsistent params', async () => {
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

        const params1 = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address, weth.address],
            0,
            [expectedDaiAmount],
            [1],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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
              params1,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params2 = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            0,
            [expectedDaiAmount, expectedDaiAmount],
            [1],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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
              params2,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params3 = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            0,
            [expectedDaiAmount],
            [1, 1],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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
              params3,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params4 = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            0,
            [expectedDaiAmount],
            [1],
            [0, 0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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
              params4,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params5 = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            0,
            [expectedDaiAmount],
            [1],
            [0],
            [0, 0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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
              params5,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params6 = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            0,
            [expectedDaiAmount],
            [1],
            [0],
            [0],
            [
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            ],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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
              params6,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params7 = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            0,
            [expectedDaiAmount],
            [1],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            [
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            ],
          ]
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
              params7,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');
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

        const params = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            0,
            [expectedDaiAmount],
            [1],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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

        const params = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            0,
            [expectedDaiAmount],
            [1],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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

        const params = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            0,
            [expectedDaiAmount],
            [1],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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

        const params = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            0,
            [expectedDaiAmount],
            [1],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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

      it('should swap tokens, repay debt and deposit in pool the left over', async () => {
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

        const params = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            0,
            [expectedDaiAmount],
            [1],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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

        const wethBalanceBefore = await weth.balanceOf(userAddress);

        const params = ethers.utils.defaultAbiCoder.encode(
          [
            'address[]',
            'uint256',
            'uint256[]',
            'uint256[]',
            'uint256[]',
            'uint8[]',
            'bytes32[]',
            'bytes32[]',
          ],
          [
            [dai.address],
            1,
            [expectedDaiAmount],
            [1],
            [0],
            [0],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
            ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ]
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
