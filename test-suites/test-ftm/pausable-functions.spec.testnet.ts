import { makeSuite, TestEnv } from './helpers/make-suite';
import { ProtocolErrors, RateMode } from '../../helpers/types';
import { APPROVAL_AMOUNT_LENDING_POOL, ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { BigNumber } from 'bignumber.js';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';

const { expect } = require('chai');

makeSuite('Pausable Pool', (testEnv: TestEnv) => {
  const { LP_IS_PAUSED, INVALID_FROM_BALANCE_AFTER_TRANSFER, INVALID_TO_BALANCE_AFTER_TRANSFER } =
    ProtocolErrors;

  it('User 0 deposits 7000 DAI. Configurator pauses pool. Transfers to user 1 reverts. Configurator unpauses the network and next transfer succees', async () => {
    const { users, pool, dai, aDai, configurator, emergencyUser, deployer } = testEnv;

    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '7000');

    await dai.connect(deployer.signer).transfer(users[0].address, amountDAItoDeposit);

    // user 0 deposits 7000 DAI
    await dai.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await pool
      .connect(users[0].signer)
      .deposit(dai.address, amountDAItoDeposit, users[0].address, '0');

    const user0Balance = await aDai.balanceOf(users[0].address);
    const user1Balance = await aDai.balanceOf(emergencyUser.address);

    // Configurator pauses the pool
    await configurator.connect(emergencyUser.signer).setPoolPause(true);

    // User 0 tries the transfer to User 1
    await expect(
      aDai.connect(users[0].signer).transfer(emergencyUser.address, amountDAItoDeposit)
    ).to.revertedWith(LP_IS_PAUSED);

    const pausedFromBalance = await aDai.balanceOf(users[0].address);
    const pausedToBalance = await aDai.balanceOf(emergencyUser.address);

    expect(pausedFromBalance).to.be.equal(
      user0Balance.toString(),
      INVALID_TO_BALANCE_AFTER_TRANSFER
    );
    expect(pausedToBalance.toString()).to.be.equal(
      user1Balance.toString(),
      INVALID_FROM_BALANCE_AFTER_TRANSFER
    );

    // Configurator unpauses the pool
    await configurator.connect(emergencyUser.signer).setPoolPause(false);

    // User 0 succeeds transfer to User 1
    await aDai.connect(users[0].signer).transfer(emergencyUser.address, amountDAItoDeposit);

    const fromBalance = await aDai.balanceOf(users[0].address);
    const toBalance = await aDai.balanceOf(emergencyUser.address);

    expect(fromBalance.toString()).to.be.equal(
      user0Balance.sub(amountDAItoDeposit),
      INVALID_FROM_BALANCE_AFTER_TRANSFER
    );
    expect(toBalance.toString()).to.be.equal(
      user1Balance.add(amountDAItoDeposit),
      INVALID_TO_BALANCE_AFTER_TRANSFER
    );
  });

  it('Deposit', async () => {
    const { users, pool, dai, aDai, configurator, emergencyUser, deployer } = testEnv;

    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '7000');
    const ethers = (DRE as any).ethers;

    await dai.connect(deployer.signer).transfer(users[0].address, amountDAItoDeposit);

    // user 0 deposits 7000 DAI
    await dai.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    // Configurator pauses the pool
    await configurator.connect(emergencyUser.signer).setPoolPause(true);
    await expect(
      pool.connect(users[0].signer).deposit(dai.address, amountDAItoDeposit, users[0].address, '0')
    ).to.revertedWith(LP_IS_PAUSED);

    // Configurator unpauses the pool
    await configurator.connect(emergencyUser.signer).setPoolPause(false);
  });

  it('Withdraw', async () => {
    const { users, pool, dai, aDai, configurator, emergencyUser, deployer } = testEnv;

    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '7000');
    const ethers = (DRE as any).ethers;

    await dai.connect(deployer.signer).transfer(users[0].address, amountDAItoDeposit);

    // user 0 deposits 7000 DAI
    await dai.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await pool
      .connect(users[0].signer)
      .deposit(dai.address, amountDAItoDeposit, users[0].address, '0');

    // Configurator pauses the pool
    await configurator.connect(emergencyUser.signer).setPoolPause(true);

    // user tries to burn
    await expect(
      pool.connect(users[0].signer).withdraw(dai.address, amountDAItoDeposit, users[0].address)
    ).to.revertedWith(LP_IS_PAUSED);

    // Configurator unpauses the pool
    await configurator.connect(emergencyUser.signer).setPoolPause(false);
  });

  it('Borrow', async () => {
    const { pool, dai, users, configurator, emergencyUser } = testEnv;

    const user = emergencyUser;
    // Pause the pool
    await configurator.connect(emergencyUser.signer).setPoolPause(true);

    // Try to execute liquidation
    await expect(
      pool.connect(user.signer).borrow(dai.address, '1', '1', '0', user.address)
    ).revertedWith(LP_IS_PAUSED);

    // Unpause the pool
    await configurator.connect(emergencyUser.signer).setPoolPause(false);
  });

  it('Repay', async () => {
    const { pool, dai, users, configurator, emergencyUser } = testEnv;

    const user = emergencyUser;
    // Pause the pool
    await configurator.connect(emergencyUser.signer).setPoolPause(true);

    // Try to execute liquidation
    await expect(pool.connect(user.signer).repay(dai.address, '1', '1', user.address)).revertedWith(
      LP_IS_PAUSED
    );

    // Unpause the pool
    await configurator.connect(emergencyUser.signer).setPoolPause(false);
  });

  it('Liquidation call', async () => {
    const {
      users,
      pool,
      usdc,
      oracle,
      yvwftm,
      configurator,
      helpersContract,
      yearnVault,
      deployer,
      emergencyUser,
    } = testEnv;
    const depositor = users[3];
    const borrower = users[4];

    const ethers = (DRE as any).ethers;
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '7000');
    await usdc
      .connect(deployer.signer)
      .transfer(depositor.address, amountUSDCtoDeposit);

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 3 deposits 7000 USDC
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    //user 4 deposits 1000 FTM
    const amountFTMtoDeposit = ethers.utils.parseEther('1000');
    await yearnVault
      .connect(borrower.signer)
      .depositCollateral(ZERO_ADDRESS, amountFTMtoDeposit, { value: amountFTMtoDeposit });

    //user 4 borrows
    const userGlobalData = await pool.getUserAccountData(borrower.address);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.9502)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    // Drops HF below 1
    await oracle
      .connect(deployer.signer)
      .setAssetPrice(
        usdc.address,
        new BigNumber(usdcPrice.toString()).multipliedBy(1.2).toFixed(0)
      );

    // //mints usdc to the liquidator
    // await impersonateAccountsHardhat([usdcOwnerAddress]);
    // signer = await ethers.provider.getSigner(usdcOwnerAddress);
    // await usdc
    //   .connect(signer)
    //   .transfer(deployer.address, await convertToCurrencyDecimals(usdc.address, '7000'));
    // await usdc.connect(deployer.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const userReserveDataBefore = await helpersContract.getUserReserveData(
      usdc.address,
      borrower.address
    );

    const amountToLiquidate = new BigNumber(userReserveDataBefore.currentStableDebt.toString())
      .multipliedBy(0.5)
      .toFixed(0);

    // Pause pool
    await configurator.connect(emergencyUser.signer).setPoolPause(true);

    // Do liquidation
    await expect(
      pool
        .connect(deployer.signer)
        .liquidationCall(yvwftm.address, usdc.address, borrower.address, amountToLiquidate, true)
    ).revertedWith(LP_IS_PAUSED);

    // Unpause pool
    await configurator.connect(emergencyUser.signer).setPoolPause(false);
  });

  //   it('SwapBorrowRateMode', async () => {
  //     const { pool, weth, dai, usdc, users, configurator, emergencyUser } = testEnv;
  //     const user = emergencyUser;
  //     const amountWETHToDeposit = parseEther('10');
  //     const amountDAIToDeposit = parseEther('120');
  //     const amountToBorrow = parseUnits('65', 6);

  //     await weth.connect(user.signer).mint(amountWETHToDeposit);
  //     await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
  //     await pool.connect(user.signer).deposit(weth.address, amountWETHToDeposit, user.address, '0');

  //     await dai.connect(user.signer).mint(amountDAIToDeposit);
  //     await dai.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
  //     await pool.connect(user.signer).deposit(dai.address, amountDAIToDeposit, user.address, '0');

  //     await pool.connect(user.signer).borrow(usdc.address, amountToBorrow, 2, 0, user.address);

  //     // Pause pool
  //     await configurator.connect(emergencyUser.signer).setPoolPause(true);

  //     // Try to repay
  //     await expect(
  //       pool.connect(user.signer).swapBorrowRateMode(usdc.address, RateMode.Stable)
  //     ).revertedWith(LP_IS_PAUSED);

  //     // Unpause pool
  //     await configurator.connect(emergencyUser.signer).setPoolPause(false);
  //   });

  // it('RebalanceStableBorrowRate', async () => {
  //   const { pool, dai, users, configurator, emergencyUser } = testEnv;
  //   const user = emergencyUser;
  //   // Pause pool
  //   await configurator.connect(emergencyUser.signer).setPoolPause(true);

  //   await expect(
  //     pool.connect(user.signer).rebalanceStableBorrowRate(dai.address, user.address)
  //   ).revertedWith(LP_IS_PAUSED);

  //   // Unpause pool
  //   await configurator.connect(emergencyUser.signer).setPoolPause(false);
  // });

  //   it('setUserUseReserveAsCollateral', async () => {
  //     const { pool, weth, users, configurator, emergencyUser } = testEnv;
  //     const user = emergencyUser;

  //     const amountWETHToDeposit = parseEther('1');
  //     await weth.connect(user.signer).mint(amountWETHToDeposit);
  //     await weth.connect(user.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
  //     await pool.connect(user.signer).deposit(weth.address, amountWETHToDeposit, user.address, '0');

  //     // Pause pool
  //     await configurator.connect(emergencyUser.signer).setPoolPause(true);

  //     await expect(
  //       pool.connect(user.signer).setUserUseReserveAsCollateral(weth.address, false)
  //     ).revertedWith(LP_IS_PAUSED);

  //     // Unpause pool
  //     await configurator.connect(emergencyUser.signer).setPoolPause(false);
  //   });
});
