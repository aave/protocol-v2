import BigNumber from 'bignumber.js';
import { ethers, BigNumberish } from 'ethers';
import {
  DRE,
  impersonateAccountsHardhat,
  advanceBlock,
  timeLatest,
} from '../../helpers/misc-utils';
import { APPROVAL_AMOUNT_LENDING_POOL, ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals, getContract } from '../../helpers/contracts-helpers';
import { makeSuite, TestEnv, SignerWithAddress } from './helpers/make-suite';
import { printUserAccountData, printDivider } from './helpers/utils/helpers';
import type { ICurveExchange } from '../../types/ICurveExchange';
import { IERC20DetailedFactory } from '../../types/IERC20DetailedFactory';

const chai = require('chai');
const { expect } = chai;
const { parseEther } = ethers.utils;

const CONVEX_YIELD_PERIOD = 100000;

const simulateYield = async (testEnv: TestEnv) => {
  await simulateYieldInLidoVault(testEnv);
  // await simulateYieldInConvexDOLAVault(testEnv);
  await simulateYieldInConvexFRAXVault(testEnv);
  // await simulateYieldInConvexRocketPoolETHVault(testEnv);
};

const simulateYieldInLidoVault = async (testEnv: TestEnv) => {
  const { pool, lidoVault, users, lido, aStETH } = testEnv;
  const ethers = (DRE as any).ethers;
  const stETHOwnerAddress = '0x06920C9fC643De77B99cB7670A944AD31eaAA260';
  const depositStETH = '10';
  const depositStETHAmount = await convertToCurrencyDecimals(lido.address, depositStETH);

  await impersonateAccountsHardhat([stETHOwnerAddress]);
  let signer = await ethers.provider.getSigner(stETHOwnerAddress);

  await lido.connect(signer).transfer(aStETH.address, depositStETHAmount);
  await lidoVault.processYield();
};

const simulateYieldInConvexFRAXVault = async (testEnv: TestEnv) => {
  const { convexFRAX3CRVVault, users, cvxfrax_3crv, aCVXFRAX_3CRV, FRAX_3CRV_LP } = testEnv;
  const ethers = (DRE as any).ethers;
  const borrower = users[1];
  const FRAX3CRVLPOwnerAddress = '0xccf6c29d87eb2c0bafede74f5df35f84541f4549';
  const depositFRAX3CRV = '1552600';
  const depositFRAX3CRVAmount = await convertToCurrencyDecimals(
    FRAX_3CRV_LP.address,
    depositFRAX3CRV
  );

  await impersonateAccountsHardhat([FRAX3CRVLPOwnerAddress]);
  let signer = await ethers.provider.getSigner(FRAX3CRVLPOwnerAddress);

  //transfer to borrower
  await FRAX_3CRV_LP.connect(signer).transfer(borrower.address, depositFRAX3CRVAmount);

  //approve protocol to access borrower wallet
  await FRAX_3CRV_LP.connect(borrower.signer).approve(
    convexFRAX3CRVVault.address,
    APPROVAL_AMOUNT_LENDING_POOL
  );

  // deposit collateral to borrow
  await convexFRAX3CRVVault
    .connect(borrower.signer)
    .depositCollateral(FRAX_3CRV_LP.address, depositFRAX3CRVAmount);

  await advanceBlock((await timeLatest()).plus(CONVEX_YIELD_PERIOD).toNumber());
  // process yield, so yield should be sented to YieldManager
  await convexFRAX3CRVVault.processYield();
};

// const simulateYieldInConvexDOLAVault = async (testEnv: TestEnv) => {
//   const { pool, convexDOLA3CRVVault, users, cvxdola_3crv, aCVXDOLA_3CRV, DOLA_3CRV_LP } = testEnv;
//   const ethers = (DRE as any).ethers;
//   const borrower = users[1];
//   const LPOwnerAddress = '0xa83f6bec55a100ca3402245fc1d46127889354ec';
//   const depositDOLA3CRV = '8000';
//   const depositDOLA3CRVAmount = await convertToCurrencyDecimals(
//     DOLA_3CRV_LP.address,
//     depositDOLA3CRV
//   );

//   await impersonateAccountsHardhat([LPOwnerAddress]);
//   let signer = await ethers.provider.getSigner(LPOwnerAddress);

//   //transfer to borrower
//   await DOLA_3CRV_LP.connect(signer).transfer(borrower.address, depositDOLA3CRVAmount);

//   //approve protocol to access borrower wallet
//   await DOLA_3CRV_LP.connect(borrower.signer).approve(
//     convexDOLA3CRVVault.address,
//     APPROVAL_AMOUNT_LENDING_POOL
//   );

//   // deposit collateral to borrow
//   await convexDOLA3CRVVault
//     .connect(borrower.signer)
//     .depositCollateral(DOLA_3CRV_LP.address, depositDOLA3CRVAmount);

//   await advanceBlock((await timeLatest()).plus(CONVEX_YIELD_PERIOD).toNumber());

//   // process yield, so yield should be sented to YieldManager
//   await convexDOLA3CRVVault.processYield();
// };

// const simulateYieldInConvexRocketPoolETHVault = async (testEnv: TestEnv) => {
//   const { convexRocketPoolETHVault, users, RETH_WSTETH_LP } = testEnv;
//   const ethers = (DRE as any).ethers;
//   const borrower = users[1];
//   const LPOwnerAddress = '0x28ac885d3d8b30bd5733151c732c5f01e18847aa';
//   const depositLP = '50';
//   const depositLPAmount = await convertToCurrencyDecimals(RETH_WSTETH_LP.address, depositLP);

//   await impersonateAccountsHardhat([LPOwnerAddress]);
//   let signer = await ethers.provider.getSigner(LPOwnerAddress);

//   //transfer to borrower
//   await RETH_WSTETH_LP.connect(signer).transfer(borrower.address, depositLPAmount);

//   //approve protocol to access borrower wallet
//   await RETH_WSTETH_LP.connect(borrower.signer).approve(
//     convexRocketPoolETHVault.address,
//     APPROVAL_AMOUNT_LENDING_POOL
//   );

//   // deposit collateral to borrow
//   await convexRocketPoolETHVault
//     .connect(borrower.signer)
//     .depositCollateral(RETH_WSTETH_LP.address, depositLPAmount);

//   await advanceBlock((await timeLatest()).plus(CONVEX_YIELD_PERIOD).toNumber());

//   // process yield, so yield should be sented to YieldManager
//   await convexRocketPoolETHVault.processYield();
// };

const depositUSDC = async (
  testEnv: TestEnv,
  depositor: SignerWithAddress,
  amount: BigNumberish
) => {
  const { pool, usdc } = testEnv;
  const ethers = (DRE as any).ethers;

  const usdcOwnerAddress = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503';
  await impersonateAccountsHardhat([usdcOwnerAddress]);
  let signer = await ethers.provider.getSigner(usdcOwnerAddress);
  await usdc.connect(signer).transfer(depositor.address, amount);

  //approve protocol to access depositor wallet
  await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

  //Supplier  deposits 7000 USDC
  await pool.connect(depositor.signer).deposit(usdc.address, amount, depositor.address, '0');
};

const depositUSDT = async (
  testEnv: TestEnv,
  depositor: SignerWithAddress,
  amount: BigNumberish
) => {
  const { pool, usdt } = testEnv;
  const ethers = (DRE as any).ethers;

  const usdtOwnerAddress = '0x5754284f345afc66a98fbB0a0Afe71e0F007B949';
  await impersonateAccountsHardhat([usdtOwnerAddress]);
  let signer = await ethers.provider.getSigner(usdtOwnerAddress);
  await usdt.connect(signer).transfer(depositor.address, amount);

  //approve protocol to access depositor wallet
  await usdt.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

  //Supplier  deposits 7000 USDT
  await pool.connect(depositor.signer).deposit(usdt.address, amount, depositor.address, '0');
};

const depositDAI = async (testEnv: TestEnv, depositor: SignerWithAddress, amount: BigNumberish) => {
  const { pool, dai } = testEnv;
  const ethers = (DRE as any).ethers;

  const daiOwnerAddress = '0x4967ec98748efb98490663a65b16698069a1eb35';
  await impersonateAccountsHardhat([daiOwnerAddress]);
  let signer = await ethers.provider.getSigner(daiOwnerAddress);
  await dai.connect(signer).transfer(depositor.address, amount);

  //approve protocol to access depositor wallet
  await dai.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

  //Supplier  deposits
  await pool.connect(depositor.signer).deposit(dai.address, amount, depositor.address, '0');
};

makeSuite('Yield Manger: configuration', (testEnv) => {
  it('Registered reward asset count should be 2', async () => {
    const { yieldManager, usdc, dai } = testEnv;
    const availableAssetCount = 3;
    const assetCount = await yieldManager.getAssetCount();
    expect(assetCount).to.be.eq(availableAssetCount);
  });
  it('CRV should be a reward asset.', async () => {
    const { yieldManager, CRV } = testEnv;
    const assetCount = await yieldManager.getAssetCount();
    let registered = false;
    let index = 0;
    while (assetCount.gt(index)) {
      const assetAddress = await yieldManager.getAssetInfo(index++);
      if (assetAddress.toLowerCase() == CRV.address.toLowerCase()) {
        registered = true;
        break;
      }
    }
    expect(registered).to.be.equal(true);
  });
  it('CVX should be a reward asset.', async () => {
    const { yieldManager, CVX } = testEnv;
    const assetCount = await yieldManager.getAssetCount();
    let registered = false;
    let index = 0;
    while (assetCount.gt(index)) {
      const assetAddress = await yieldManager.getAssetInfo(index++);
      if (assetAddress.toLowerCase() == CVX.address.toLowerCase()) {
        registered = true;
        break;
      }
    }
    expect(registered).to.be.equal(true);
  });
  it('WETH should be a reward asset.', async () => {
    const { yieldManager, WETH } = testEnv;
    const assetCount = await yieldManager.getAssetCount();
    let registered = false;
    let index = 0;
    while (assetCount.gt(index)) {
      const assetAddress = await yieldManager.getAssetInfo(index++);
      if (assetAddress.toLowerCase() == WETH.address.toLowerCase()) {
        registered = true;
        break;
      }
    }
    expect(registered).to.be.equal(true);
  });
  it('Should be USDC as an exchange token', async () => {
    const { yieldManager, usdc } = testEnv;
    const asset = await yieldManager._exchangeToken();
    expect(asset).to.be.eq(usdc.address);
  });
  it('Should be failed when set invalid address as an exchange token', async () => {
    const { yieldManager } = testEnv;
    await expect(yieldManager.setExchangeToken(ZERO_ADDRESS)).to.be.reverted;
  });
  it('Should be failed when use invalid address as a curve pool', async () => {
    const { yieldManager, usdc, dai } = testEnv;
    await expect(yieldManager.setCurvePool(usdc.address, dai.address, ZERO_ADDRESS)).to.be.reverted;
  });
  it('All curve pool for USDC -> stable coin should be configured', async () => {
    const { yieldManager, pool, usdc } = testEnv;
    const { 2: assets, 3: length } = await pool.getBorrowingAssetAndVolumes();
    let index = 0;
    while (length.gt(index)) {
      const asset = assets[index++];
      if (asset.toLowerCase() != usdc.address.toLowerCase()) {
        const pool = await yieldManager.getCurvePool(usdc.address, asset);
        expect(pool).to.not.eq(ZERO_ADDRESS);
      }
    }
  });
});

makeSuite('Yield Manager: simulate yield in vaults', (testEnv) => {
  it('Lido vault', async () => {
    const { WETH, yieldManager } = testEnv;
    const beforeBalanceOfWETH = await WETH.balanceOf(yieldManager.address);
    await simulateYieldInLidoVault(testEnv);
    const afterBalanceOfWETH = await WETH.balanceOf(yieldManager.address);
    expect(afterBalanceOfWETH).to.be.gt(beforeBalanceOfWETH);
  });
  it('Convex FRAX vault', async () => {
    const { CRV, CVX, yieldManager, deployer } = testEnv;
    const beforeBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
    const beforeBalanceOfCVX = await CVX.balanceOf(yieldManager.address);
    await simulateYieldInConvexFRAXVault(testEnv);
    const afterBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
    const afterBalanceOfCVX = await CRV.balanceOf(yieldManager.address);
    expect(afterBalanceOfCRV).to.be.gt(beforeBalanceOfCRV);
    expect(afterBalanceOfCVX).to.be.gt(beforeBalanceOfCVX);
  });
  // it('Convex DOLA vaults', async () => {
  //   const { CRV, CVX, yieldManager } = testEnv;
  //   const beforeBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
  //   const beforeBalanceOfCVX = await CVX.balanceOf(yieldManager.address);
  //   await simulateYieldInConvexDOLAVault(testEnv);
  //   const afterBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
  //   const afterBalanceOfCVX = await CRV.balanceOf(yieldManager.address);
  //   expect(afterBalanceOfCRV).to.be.gt(beforeBalanceOfCRV);
  //   expect(afterBalanceOfCVX).to.be.gt(beforeBalanceOfCVX);
  // });
  // it('Convex RocketPoolETH vaults', async () => {
  //   const { CRV, CVX, yieldManager } = testEnv;
  //   const beforeBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
  //   const beforeBalanceOfCVX = await CVX.balanceOf(yieldManager.address);
  //   await simulateYieldInConvexRocketPoolETHVault(testEnv);
  //   const afterBalanceOfCRV = await CRV.balanceOf(yieldManager.address);
  //   const afterBalanceOfCVX = await CRV.balanceOf(yieldManager.address);
  //   expect(afterBalanceOfCRV).to.be.gt(beforeBalanceOfCRV);
  //   expect(afterBalanceOfCVX).to.be.gt(beforeBalanceOfCVX);
  // });
});

makeSuite('Yield Manger: distribute yield', (testEnv) => {
  it('Should be failed when use invalid asset index', async () => {
    const { yieldManager, usdc, CRV, CVX } = testEnv;
    const assetCount = await yieldManager.getAssetCount();
    const paths = [
      {
        tokens: [CRV.address, usdc.address],
        fees: [100],
      },
    ];
    const slippage = 500;
    await expect(yieldManager.distributeYield(assetCount, 1, slippage, paths)).to.be.revertedWith(
      '77'
    );
  });
  it('Should be failed when use invalid swap path', async () => {
    const { yieldManager, usdc, CRV, CVX } = testEnv;
    const assetCount = 2;
    const paths = [
      {
        tokens: [CRV.address, usdc.address],
        fees: [100],
      },
    ];
    const slippage = 500;
    await expect(yieldManager.distributeYield(0, assetCount, slippage, paths)).to.be.revertedWith(
      '100'
    );
  });
  it('Should be failed when use swap path including invalid tokens', async () => {
    const { yieldManager, usdc, CRV, CVX } = testEnv;
    const assetCount = 1;
    const paths = [
      {
        tokens: [usdc.address, usdc.address],
        fees: [100],
      },
    ];
    const slippage = 500;
    await expect(yieldManager.distributeYield(0, assetCount, slippage, paths)).to.be.revertedWith(
      '101'
    );
  });
  it('Distribute yield', async () => {
    const { yieldManager, dai, aDai, usdc, usdt, aUsdc, aUsdt, users, CRV, CVX, WETH } = testEnv;

    // suppliers deposit asset to pool
    const depositor1 = users[0];
    const depositor2 = users[1];
    const depositor3 = users[2];
    const depositUSDCAmount = await convertToCurrencyDecimals(usdc.address, '7000');
    const depositUSDTAmount = await convertToCurrencyDecimals(usdt.address, '7000');
    const depositDAIAmount = await convertToCurrencyDecimals(dai.address, '3500');
    await depositUSDC(testEnv, depositor1, depositUSDCAmount);
    await depositDAI(testEnv, depositor2, depositDAIAmount);
    await depositUSDT(testEnv, depositor3, depositUSDTAmount);
    expect((await aUsdc.balanceOf(depositor1.address)).eq(depositUSDCAmount)).to.be.equal(true);
    expect((await aDai.balanceOf(depositor2.address)).eq(depositDAIAmount)).to.be.equal(true);
    expect((await aUsdt.balanceOf(depositor3.address)).eq(depositUSDTAmount)).to.be.equal(true);

    // Simulate Yield
    await simulateYield(testEnv);

    // Distribute yields
    const assetCount = await yieldManager.getAssetCount();

    const paths = [
      {
        tokens: [CRV.address, WETH.address, usdc.address],
        fees: [10000, 500],
      },
      {
        tokens: [CVX.address, WETH.address, usdc.address],
        fees: [10000, 500],
      },
      {
        tokens: [WETH.address, usdc.address],
        fees: [500],
      },
    ];
    const slippage = 500;
    await yieldManager.distributeYield(0, assetCount, slippage, paths);

    expect((await aUsdc.balanceOf(depositor1.address)).gt(depositUSDCAmount)).to.be.equal(true);
    expect((await aDai.balanceOf(depositor2.address)).gt(depositDAIAmount)).to.be.equal(true);
    expect((await aUsdt.balanceOf(depositor3.address)).gt(depositUSDTAmount)).to.be.equal(true);
  });
});
