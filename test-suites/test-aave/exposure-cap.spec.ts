import { TestEnv, makeSuite } from './helpers/make-suite';
import {
  APPROVAL_AMOUNT_LENDING_POOL,
  MAX_UINT_AMOUNT,
  RAY,
  MAX_EXPOSURE_CAP,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
} from '../../helpers/constants';
import { ProtocolErrors } from '../../helpers/types';
import { MintableERC20, WETH9, WETH9Mocked } from '../../types';
import { parseEther } from '@ethersproject/units';
import { BigNumber } from '@ethersproject/bignumber';
import { strategyDAI } from '../../markets/amm/reservesConfigs';
import { strategyUSDC } from '../../markets/amm/reservesConfigs';
import { strategyWETH } from '../../markets/amm/reservesConfigs';
import { ethers } from 'ethers';

const { expect } = require('chai');
makeSuite('Exposure Cap', (testEnv: TestEnv) => {
  const {
    VL_COLLATERAL_EXPOSURE_CAP_EXCEEDED,
    RC_INVALID_EXPOSURE_CAP,
    VL_COLLATERAL_CANNOT_COVER_NEW_BORROW,
  } = ProtocolErrors;
  const daiPrice = Number(MOCK_CHAINLINK_AGGREGATORS_PRICES.DAI);
  const usdcPrice = Number(MOCK_CHAINLINK_AGGREGATORS_PRICES.USDC);
  const daiLTV = Number(strategyDAI.baseLTVAsCollateral);
  const usdcLTV = Number(strategyUSDC.baseLTVAsCollateral);

  const unitParse = async (token: WETH9Mocked | MintableERC20, nb: string) =>
    BigNumber.from(nb).mul(BigNumber.from('10').pow((await token.decimals()) - 3));
  it('Reserves should initially have exposure cap disabled (exposureCap = 0)', async () => {
    const {
      configurator,
      weth,
      pool,
      dai,
      usdc,
      deployer,
      helpersContract,
      users: [user1],
    } = testEnv;

    const mintedAmount = parseEther('1000000000');
    // minting for main user
    await dai.mint(mintedAmount);
    await weth.mint(mintedAmount);
    await usdc.mint(mintedAmount);
    // minting for lp user
    await dai.connect(user1.signer).mint(mintedAmount);
    await weth.connect(user1.signer).mint(mintedAmount);
    await usdc.connect(user1.signer).mint(mintedAmount);

    await dai.approve(pool.address, MAX_UINT_AMOUNT);
    await weth.approve(pool.address, MAX_UINT_AMOUNT);
    await usdc.approve(pool.address, MAX_UINT_AMOUNT);
    await dai.connect(user1.signer).approve(pool.address, MAX_UINT_AMOUNT);
    await weth.connect(user1.signer).approve(pool.address, MAX_UINT_AMOUNT);
    await usdc.connect(user1.signer).approve(pool.address, MAX_UINT_AMOUNT);

    await pool.deposit(weth.address, mintedAmount, deployer.address, 0);

    let usdcExposureCap = (await helpersContract.getReserveCaps(usdc.address)).exposureCap;
    let daiExposureCap = (await helpersContract.getReserveCaps(dai.address)).exposureCap;

    expect(usdcExposureCap).to.be.equal('0');
    expect(daiExposureCap).to.be.equal('0');
  });
  it('Deposit 10 Dai, 10 USDC, LTV for both should increase', async () => {
    const {
      configurator,
      weth,
      pool,
      dai,
      usdc,
      deployer,
      helpersContract,
      users: [user1],
    } = testEnv;

    const suppliedAmount = 10;
    const precisionSuppliedAmount = (suppliedAmount * 1000).toString();

    // user 1 deposit more dai and usdc to be able to borrow
    let { ltv } = await pool.getUserAccountData(user1.address);
    console.log(ltv.toString());
    expect(ltv.toString()).to.be.equal('0');
    await pool
      .connect(user1.signer)
      .deposit(dai.address, await unitParse(dai, precisionSuppliedAmount), user1.address, 0);

    ltv = (await pool.getUserAccountData(user1.address)).ltv;
    console.log(ltv.toString());
    expect(ltv).to.be.equal(daiLTV);
    await pool
      .connect(user1.signer)
      .deposit(usdc.address, await unitParse(usdc, precisionSuppliedAmount), user1.address, 0);

    ltv = (await pool.getUserAccountData(user1.address)).ltv;
    console.log(ltv.toString());
    expect(Number(ltv)).to.be.equal(
      Math.floor((daiLTV * daiPrice + usdcLTV * usdcPrice) / (daiPrice + usdcPrice))
    );
  });
  it('Sets the exposure cap for DAI to 10 Units', async () => {
    const {
      configurator,
      weth,
      pool,
      dai,
      usdc,
      deployer,
      helpersContract,
      users: [user1],
    } = testEnv;

    const newExposureCap = 10;

    await configurator.setExposureCap(dai.address, newExposureCap);

    const daiExposureCap = (await helpersContract.getReserveCaps(dai.address)).exposureCap;

    expect(daiExposureCap).to.be.equal(newExposureCap);
  });
  it('should succeed to deposit 10 dai but dai ltv drops to 0', async () => {
    const {
      usdc,
      pool,
      dai,
      aDai,
      deployer,
      helpersContract,
      users: [user1],
    } = testEnv;
    const suppliedAmount = 10;
    const precisionSuppliedAmount = (suppliedAmount * 1000).toString();

    await pool
      .connect(user1.signer)
      .deposit(dai.address, await unitParse(dai, precisionSuppliedAmount), user1.address, 0);

    console.log((await aDai.totalSupply()).toString());

    let ltv = (await pool.getUserAccountData(user1.address)).ltv;
    console.log(ltv.toString());
    expect(ltv).to.be.equal(Math.floor((usdcLTV * usdcPrice) / (usdcPrice + 2 * daiPrice)));
  });
  it('Should not be able to borrow 15 USD of weth', async () => {
    const {
      usdc,
      pool,
      weth,
      helpersContract,
      users: [user1],
    } = testEnv;
    const precisionBorrowedUsdAmount = 15 * 1000;
    const precisionBorrowedEthAmount = ethers.BigNumber.from(precisionBorrowedUsdAmount)
      .mul(daiPrice)
      .div(parseEther('1.0'))
      .toString();
    const borrowedAmount = await unitParse(weth, precisionBorrowedEthAmount);

    await expect(
      pool.connect(user1.signer).borrow(weth.address, borrowedAmount, 1, 0, user1.address)
    ).to.be.revertedWith(VL_COLLATERAL_CANNOT_COVER_NEW_BORROW);
  });
  it('should be able to borrow 15 USD of weth after dai exposure cap raised to 100', async () => {
    const {
      usdc,
      pool,
      dai,
      weth,
      configurator,
      helpersContract,
      users: [user1],
    } = testEnv;

    const newExposureCap = 100;

    await configurator.setExposureCap(dai.address, newExposureCap);

    const daiExposureCap = (await helpersContract.getReserveCaps(dai.address)).exposureCap;

    expect(daiExposureCap).to.be.equal(newExposureCap);

    const precisionBorrowedUsdAmount = 15 * 1000;
    const precisionBorrowedEthAmount = ethers.BigNumber.from(precisionBorrowedUsdAmount)
      .mul(daiPrice)
      .div(parseEther('1.0'))
      .toString();
    const borrowedAmount = await unitParse(weth, precisionBorrowedEthAmount);

    pool.connect(user1.signer).borrow(weth.address, borrowedAmount, 1, 0, user1.address);
  });
  it('should not be able to withdraw 5 dai, transfer 5 aDai after cap decrease back to 10 (capped)', async () => {
    const {
      usdc,
      pool,
      dai,
      aDai,
      configurator,
      helpersContract,
      users: [user1],
    } = testEnv;

    const newExposureCap = 10;

    await configurator.setExposureCap(dai.address, newExposureCap);

    const daiExposureCap = (await helpersContract.getReserveCaps(dai.address)).exposureCap;

    expect(daiExposureCap).to.be.equal(newExposureCap);

    const precisionWithdrawnAmount = (5 * 1000).toString();
    const withdrawnAmount = await unitParse(dai, precisionWithdrawnAmount);

    await expect(
      pool.connect(user1.signer).withdraw(dai.address, withdrawnAmount, user1.address)
    ).to.be.revertedWith(VL_COLLATERAL_EXPOSURE_CAP_EXCEEDED);
    await expect(
      aDai.connect(user1.signer).transfer(pool.address, withdrawnAmount)
    ).to.be.revertedWith(VL_COLLATERAL_EXPOSURE_CAP_EXCEEDED);
  });
  it('should be able to withdraw 5 and transfer 5 aUsdc', async () => {
    const {
      usdc,
      pool,
      aUsdc,
      users: [user1],
    } = testEnv;

    const precisionWithdrawnAmount = (5 * 1000).toString();
    const withdrawnAmount = await unitParse(usdc, precisionWithdrawnAmount);

    pool.connect(user1.signer).withdraw(usdc.address, withdrawnAmount, user1.address);
    aUsdc.connect(user1.signer).transfer(pool.address, withdrawnAmount);
  });
  it('should be able to withdraw 5 dai, transfer 5 aDai after repaying weth Debt', async () => {
    const {
      usdc,
      pool,
      dai,
      weth,
      aDai,
      configurator,
      helpersContract,
      users: [user1],
    } = testEnv;

    const precisionWithdrawnAmount = (5 * 1000).toString();
    const withdrawnAmount = await unitParse(dai, precisionWithdrawnAmount);

    await pool.connect(user1.signer).repay(weth.address, MAX_UINT_AMOUNT, 1, user1.address);

    pool.connect(user1.signer).withdraw(dai.address, withdrawnAmount, user1.address);
    aDai.connect(user1.signer).transfer(pool.address, withdrawnAmount);
  });
  it('Should fail to set the exposure cap for usdc and DAI to max cap + 1 Units', async () => {
    const { configurator, usdc, pool, dai, deployer, helpersContract } = testEnv;
    const newCap = Number(MAX_EXPOSURE_CAP) + 1;

    await expect(configurator.setExposureCap(usdc.address, newCap)).to.be.revertedWith(
      RC_INVALID_EXPOSURE_CAP
    );
    await expect(configurator.setExposureCap(dai.address, newCap)).to.be.revertedWith(
      RC_INVALID_EXPOSURE_CAP
    );
  });
});
