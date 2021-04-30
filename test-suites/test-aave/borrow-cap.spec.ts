import { TestEnv, makeSuite } from './helpers/make-suite';
import {
  APPROVAL_AMOUNT_LENDING_POOL,
  MAX_UINT_AMOUNT,
  RAY,
  MAX_BORROW_CAP,
} from '../../helpers/constants';
import { ProtocolErrors } from '../../helpers/types';
import { MintableERC20, WETH9, WETH9Mocked } from '../../types';
import { parseEther } from '@ethersproject/units';
import { BigNumber } from '@ethersproject/bignumber';

const { expect } = require('chai');

makeSuite('Borrow Cap', (testEnv: TestEnv) => {
  const { VL_BORROW_CAP_EXCEEDED, RC_INVALID_BORROW_CAP } = ProtocolErrors;

  const miliUnitToPrecision = async (token: WETH9Mocked | MintableERC20, nb: string) =>
    BigNumber.from(nb).mul(BigNumber.from('10').pow((await token.decimals()) - 3));

  it('Sets the borrow cap for Weth and DAI to 0 Units, deposits weth', async () => {
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
    await dai.mint(mintedAmount);
    await weth.mint(mintedAmount);
    await usdc.mint(mintedAmount);
    await dai.connect(user1.signer).mint(mintedAmount);
    await weth.connect(user1.signer).mint(mintedAmount);
    await usdc.connect(user1.signer).mint(mintedAmount);
    await dai.approve(pool.address, MAX_UINT_AMOUNT);
    await weth.approve(pool.address, MAX_UINT_AMOUNT);
    await usdc.approve(pool.address, MAX_UINT_AMOUNT);
    await dai.connect(user1.signer).approve(pool.address, MAX_UINT_AMOUNT);
    await weth.connect(user1.signer).approve(pool.address, MAX_UINT_AMOUNT);
    await usdc.connect(user1.signer).approve(pool.address, MAX_UINT_AMOUNT);
    let usdcBorrowCap = await helpersContract.getReserveBorrowCap(usdc.address);
    let daiBorrowCap = await helpersContract.getReserveBorrowCap(dai.address);

    expect(usdcBorrowCap).to.be.equal(MAX_BORROW_CAP);
    expect(daiBorrowCap).to.be.equal(MAX_BORROW_CAP);

    const depositedMiliAmount = (1e9).toString();

    await configurator.setBorrowCap(usdc.address, 0);
    await configurator.setBorrowCap(dai.address, 0);

    usdcBorrowCap = await helpersContract.getReserveBorrowCap(usdc.address);
    daiBorrowCap = await helpersContract.getReserveBorrowCap(dai.address);

    expect(usdcBorrowCap).to.be.equal(0);
    expect(daiBorrowCap).to.be.equal(0);

    await pool.deposit(
      weth.address,
      await miliUnitToPrecision(weth, depositedMiliAmount),
      deployer.address,
      0
    );
    await pool.connect(user1.signer).deposit(weth.address, mintedAmount, user1.address, 0);
    await pool.connect(user1.signer).deposit(dai.address, mintedAmount, user1.address, 0);
    await pool.connect(user1.signer).deposit(usdc.address, mintedAmount, user1.address, 0);
  });
  it('should fail to borrow any dai or usdc, stable or variable', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const borrowedAmount = 10;
    const borrowedMilimount = (borrowedAmount * 1000).toString();

    await expect(
      pool.borrow(
        usdc.address,
        await miliUnitToPrecision(usdc, borrowedMilimount),
        2,
        0,
        deployer.address
      )
    ).to.be.revertedWith(VL_BORROW_CAP_EXCEEDED);

    await expect(
      pool.borrow(
        dai.address,
        await miliUnitToPrecision(dai, borrowedMilimount),
        2,
        0,
        deployer.address
      )
    ).to.be.revertedWith(VL_BORROW_CAP_EXCEEDED);
  });
  it('Should fail to set the borrow cap for usdc and DAI to max cap + 1 Units', async () => {
    const { configurator, usdc, pool, dai, deployer, helpersContract } = testEnv;
    const newCap = Number(MAX_BORROW_CAP) + 1;
    let usdcBorrowCap = await helpersContract.getReserveBorrowCap(usdc.address);
    let daiBorrowCap = await helpersContract.getReserveBorrowCap(dai.address);

    expect(usdcBorrowCap).to.be.equal(0);
    expect(daiBorrowCap).to.be.equal(0);

    await expect(configurator.setBorrowCap(usdc.address, newCap)).to.be.revertedWith(
      RC_INVALID_BORROW_CAP
    );
    await expect(configurator.setBorrowCap(dai.address, newCap)).to.be.revertedWith(
      RC_INVALID_BORROW_CAP
    );

    usdcBorrowCap = await helpersContract.getReserveBorrowCap(usdc.address);
    daiBorrowCap = await helpersContract.getReserveBorrowCap(dai.address);
  });
  it('Sets the borrow cap for usdc and DAI to 110 Units', async () => {
    const { configurator, usdc, pool, dai, deployer, helpersContract } = testEnv;
    const newCap = '110';
    let usdcBorrowCap = await helpersContract.getReserveBorrowCap(usdc.address);
    let daiBorrowCap = await helpersContract.getReserveBorrowCap(dai.address);

    expect(usdcBorrowCap).to.be.equal(0);
    expect(daiBorrowCap).to.be.equal(0);

    await configurator.setBorrowCap(usdc.address, newCap);
    await configurator.setBorrowCap(dai.address, newCap);

    usdcBorrowCap = await helpersContract.getReserveBorrowCap(usdc.address);
    daiBorrowCap = await helpersContract.getReserveBorrowCap(dai.address);

    expect(usdcBorrowCap).to.be.equal(newCap);
    expect(daiBorrowCap).to.be.equal(newCap);
  });
  it('Should succeed to borrow 10 stable dai and 10 variable usdc', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const borrowedAmount = 10;
    const borrowedMilimount = (borrowedAmount * 1000).toString();
    await pool.borrow(
      usdc.address,
      await miliUnitToPrecision(usdc, borrowedMilimount),
      2,
      0,
      deployer.address
    );

    await pool.borrow(
      dai.address,
      await miliUnitToPrecision(dai, borrowedMilimount),
      1,
      0,
      deployer.address
    );
  });
  it('should fail to borrow 100 variable dai and 100 stable usdc (interests accrued)', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const borrowedAmount = 100;
    const borrowedMilimount = (borrowedAmount * 1000).toString();

    await expect(
      pool.borrow(
        usdc.address,
        await miliUnitToPrecision(usdc, borrowedMilimount),
        1,
        0,
        deployer.address
      )
    ).to.be.revertedWith(VL_BORROW_CAP_EXCEEDED);

    await expect(
      pool.borrow(
        dai.address,
        await miliUnitToPrecision(dai, borrowedMilimount),
        2,
        0,
        deployer.address
      )
    ).to.be.revertedWith(VL_BORROW_CAP_EXCEEDED);
  });
  it('Should succeed to borrow 99 variable dai and 99 stable usdc', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const borrowedAmount = 99;
    const borrowedMilimount = (borrowedAmount * 1000).toString();
    await pool.borrow(
      usdc.address,
      await miliUnitToPrecision(usdc, borrowedMilimount),
      2,
      0,
      deployer.address
    );

    await pool.borrow(
      dai.address,
      await miliUnitToPrecision(dai, borrowedMilimount),
      1,
      0,
      deployer.address
    );
  });
  it('Raises the borrow cap for usdc and DAI to 1000 Units', async () => {
    const { configurator, usdc, pool, dai, deployer, helpersContract } = testEnv;
    const newCap = '1000';
    let usdcBorrowCap = await helpersContract.getReserveBorrowCap(usdc.address);
    let daiBorrowCap = await helpersContract.getReserveBorrowCap(dai.address);

    await configurator.setBorrowCap(usdc.address, newCap);
    await configurator.setBorrowCap(dai.address, newCap);

    usdcBorrowCap = await helpersContract.getReserveBorrowCap(usdc.address);
    daiBorrowCap = await helpersContract.getReserveBorrowCap(dai.address);

    expect(usdcBorrowCap).to.be.equal(newCap);
    expect(daiBorrowCap).to.be.equal(newCap);
  });
  it('should succeed to borrow 100 variable dai and 100 stable usdc', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const borrowedAmount = 100;
    const borrowedMilimount = (borrowedAmount * 1000).toString();

    await pool.borrow(
      usdc.address,
      await miliUnitToPrecision(usdc, borrowedMilimount),
      1,
      0,
      deployer.address
    );

    await pool.borrow(
      dai.address,
      await miliUnitToPrecision(dai, borrowedMilimount),
      2,
      0,
      deployer.address
    );
  });
  it('Lowers the borrow cap for usdc and DAI to 200 Units', async () => {
    const { configurator, usdc, pool, dai, deployer, helpersContract } = testEnv;
    const newCap = '200';
    let usdcBorrowCap = await helpersContract.getReserveBorrowCap(usdc.address);
    let daiBorrowCap = await helpersContract.getReserveBorrowCap(dai.address);

    await configurator.setBorrowCap(usdc.address, newCap);
    await configurator.setBorrowCap(dai.address, newCap);

    usdcBorrowCap = await helpersContract.getReserveBorrowCap(usdc.address);
    daiBorrowCap = await helpersContract.getReserveBorrowCap(dai.address);

    expect(usdcBorrowCap).to.be.equal(newCap);
    expect(daiBorrowCap).to.be.equal(newCap);
  });
  it('should fail to borrow 100 variable dai and 100 stable usdc', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const borrowedAmount = 100;
    const borrowedMilimount = (borrowedAmount * 1000).toString();

    await expect(
      pool.borrow(
        usdc.address,
        await miliUnitToPrecision(usdc, borrowedMilimount),
        1,
        0,
        deployer.address
      )
    ).to.be.revertedWith(VL_BORROW_CAP_EXCEEDED);

    await expect(
      pool.borrow(
        dai.address,
        await miliUnitToPrecision(dai, borrowedMilimount),
        2,
        0,
        deployer.address
      )
    ).to.be.revertedWith(VL_BORROW_CAP_EXCEEDED);
  });
  it('Raises the borrow cap for usdc and DAI to max cap Units', async () => {
    const { configurator, usdc, pool, dai, deployer, helpersContract } = testEnv;
    const newCap = MAX_BORROW_CAP;
    let usdcBorrowCap = await helpersContract.getReserveBorrowCap(usdc.address);
    let daiBorrowCap = await helpersContract.getReserveBorrowCap(dai.address);

    await configurator.setBorrowCap(usdc.address, newCap);
    await configurator.setBorrowCap(dai.address, newCap);

    usdcBorrowCap = await helpersContract.getReserveBorrowCap(usdc.address);
    daiBorrowCap = await helpersContract.getReserveBorrowCap(dai.address);

    expect(usdcBorrowCap).to.be.equal(newCap);
    expect(daiBorrowCap).to.be.equal(newCap);
  });
  it('should succeed to borrow 100 variable dai and 100 stable usdc', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const borrowedAmount = 100;
    const borrowedMilimount = (borrowedAmount * 1000).toString();

    await pool.borrow(
      usdc.address,
      await miliUnitToPrecision(usdc, borrowedMilimount),
      1,
      0,
      deployer.address
    );

    await pool.borrow(
      dai.address,
      await miliUnitToPrecision(dai, borrowedMilimount),
      2,
      0,
      deployer.address
    );
  });
});
