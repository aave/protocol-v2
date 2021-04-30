import { TestEnv, makeSuite } from './helpers/make-suite';
import {
  APPROVAL_AMOUNT_LENDING_POOL,
  MAX_UINT_AMOUNT,
  RAY,
  MAX_SUPPLY_CAP,
} from '../../helpers/constants';
import { ProtocolErrors } from '../../helpers/types';
import { MintableERC20, WETH9, WETH9Mocked } from '../../types';
import { parseEther } from '@ethersproject/units';
import { BigNumber } from '@ethersproject/bignumber';

const { expect } = require('chai');

makeSuite('supply Cap', (testEnv: TestEnv) => {
  const { VL_SUPPLY_CAP_EXCEEDED, RC_INVALID_SUPPLY_CAP } = ProtocolErrors;

  const miliUnitToPrecision = async (token: WETH9Mocked | MintableERC20, nb: string) =>
    BigNumber.from(nb).mul(BigNumber.from('10').pow((await token.decimals()) - 3));

  it('Sets the supply cap for Weth and DAI to 0 Units, deposits weth', async () => {
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
    await dai.approve(pool.address, MAX_UINT_AMOUNT);
    await weth.approve(pool.address, MAX_UINT_AMOUNT);
    await usdc.approve(pool.address, MAX_UINT_AMOUNT);
    let usdcsupplyCap = (await helpersContract.getReserveCaps(usdc.address)).supplyCap;
    let daisupplyCap = (await helpersContract.getReserveCaps(dai.address)).supplyCap;

    expect(usdcsupplyCap).to.be.equal(MAX_SUPPLY_CAP);
    expect(daisupplyCap).to.be.equal(MAX_SUPPLY_CAP);

    const depositedMiliAmount = (1e9).toString();

    await configurator.setSupplyCap(usdc.address, 0);
    await configurator.setSupplyCap(dai.address, 0);

    usdcsupplyCap = (await helpersContract.getReserveCaps(usdc.address)).supplyCap;
    daisupplyCap = (await helpersContract.getReserveCaps(dai.address)).supplyCap;

    expect(usdcsupplyCap).to.be.equal(0);
    expect(daisupplyCap).to.be.equal(0);
  });
  it('should fail to supply any dai or usdc', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const suppliedAmount = 10;
    const suppliedMilimount = (suppliedAmount * 1000).toString();

    await expect(
      pool.deposit(
        usdc.address,
        await miliUnitToPrecision(usdc, suppliedMilimount),
        deployer.address,
        0
      )
    ).to.be.revertedWith(VL_SUPPLY_CAP_EXCEEDED);

    await expect(
      pool.deposit(
        dai.address,
        await miliUnitToPrecision(dai, suppliedMilimount),
        deployer.address,
        0
      )
    ).to.be.revertedWith(VL_SUPPLY_CAP_EXCEEDED);
  });
  it('Should fail to set the supply cap for usdc and DAI to max cap + 1 Units', async () => {
    const { configurator, usdc, pool, dai, deployer, helpersContract } = testEnv;
    const newCap = Number(MAX_SUPPLY_CAP) + 1;
    let usdcsupplyCap = (await helpersContract.getReserveCaps(usdc.address)).supplyCap;
    let daisupplyCap = (await helpersContract.getReserveCaps(dai.address)).supplyCap;

    expect(usdcsupplyCap).to.be.equal(0);
    expect(daisupplyCap).to.be.equal(0);

    await expect(configurator.setSupplyCap(usdc.address, newCap)).to.be.revertedWith(
      RC_INVALID_SUPPLY_CAP
    );
    await expect(configurator.setSupplyCap(dai.address, newCap)).to.be.revertedWith(
      RC_INVALID_SUPPLY_CAP
    );
  });
  it('Sets the supply cap for usdc and DAI to 110 Units', async () => {
    const { configurator, usdc, pool, dai, deployer, helpersContract } = testEnv;
    const newCap = '110';
    let usdcsupplyCap = (await helpersContract.getReserveCaps(usdc.address)).supplyCap;
    let daisupplyCap = (await helpersContract.getReserveCaps(dai.address)).supplyCap;

    expect(usdcsupplyCap).to.be.equal(0);
    expect(daisupplyCap).to.be.equal(0);

    await configurator.setSupplyCap(usdc.address, newCap);
    await configurator.setSupplyCap(dai.address, newCap);

    usdcsupplyCap = (await helpersContract.getReserveCaps(usdc.address)).supplyCap;
    daisupplyCap = (await helpersContract.getReserveCaps(dai.address)).supplyCap;

    expect(usdcsupplyCap).to.be.equal(newCap);
    expect(daisupplyCap).to.be.equal(newCap);
  });
  it('Should succeed to supply 10  dai and 10  usdc', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const suppliedAmount = 10;
    const suppliedMilimount = (suppliedAmount * 1000).toString();
    await pool.deposit(
      usdc.address,
      await miliUnitToPrecision(usdc, suppliedMilimount),
      deployer.address,
      0
    );

    await pool.deposit(
      dai.address,
      await miliUnitToPrecision(dai, suppliedMilimount),
      deployer.address,
      0
    );
  });
  it('should fail to supply 100 dai and 100 usdc', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const suppliedAmount = 100;
    const suppliedMilimount = (suppliedAmount * 1000).toString();

    await expect(
      pool.deposit(
        usdc.address,
        await miliUnitToPrecision(usdc, suppliedMilimount),
        deployer.address,
        0
      )
    ).to.be.revertedWith(VL_SUPPLY_CAP_EXCEEDED);

    await expect(
      pool.deposit(
        dai.address,
        await miliUnitToPrecision(dai, suppliedMilimount),
        deployer.address,
        0
      )
    ).to.be.revertedWith(VL_SUPPLY_CAP_EXCEEDED);
  });
  it('Should succeed to supply 99 dai and 99 usdc', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const suppliedAmount = 99;
    const suppliedMilimount = (suppliedAmount * 1000).toString();
    await pool.deposit(
      usdc.address,
      await miliUnitToPrecision(usdc, suppliedMilimount),
      deployer.address,
      0
    );

    await pool.deposit(
      dai.address,
      await miliUnitToPrecision(dai, suppliedMilimount),
      deployer.address,
      0
    );
  });
  it('Raises the supply cap for usdc and DAI to 1000 Units', async () => {
    const { configurator, usdc, pool, dai, deployer, helpersContract } = testEnv;
    const newCap = '1000';
    let usdcsupplyCap = (await helpersContract.getReserveCaps(usdc.address)).supplyCap;
    let daisupplyCap = (await helpersContract.getReserveCaps(dai.address)).supplyCap;

    await configurator.setSupplyCap(usdc.address, newCap);
    await configurator.setSupplyCap(dai.address, newCap);

    usdcsupplyCap = (await helpersContract.getReserveCaps(usdc.address)).supplyCap;
    daisupplyCap = (await helpersContract.getReserveCaps(dai.address)).supplyCap;

    expect(usdcsupplyCap).to.be.equal(newCap);
    expect(daisupplyCap).to.be.equal(newCap);
  });
  it('should succeed to supply 100 dai and 100 usdc', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const suppliedAmount = 100;
    const suppliedMilimount = (suppliedAmount * 1000).toString();
    await pool.deposit(
      usdc.address,
      await miliUnitToPrecision(usdc, suppliedMilimount),
      deployer.address,
      0
    );

    await pool.deposit(
      dai.address,
      await miliUnitToPrecision(dai, suppliedMilimount),
      deployer.address,
      0
    );
  });
  it('Lowers the supply cap for usdc and DAI to 200 Units', async () => {
    const { configurator, usdc, pool, dai, deployer, helpersContract } = testEnv;
    const newCap = '200';
    let usdcsupplyCap = (await helpersContract.getReserveCaps(usdc.address)).supplyCap;
    let daisupplyCap = (await helpersContract.getReserveCaps(dai.address)).supplyCap;

    await configurator.setSupplyCap(usdc.address, newCap);
    await configurator.setSupplyCap(dai.address, newCap);

    usdcsupplyCap = (await helpersContract.getReserveCaps(usdc.address)).supplyCap;
    daisupplyCap = (await helpersContract.getReserveCaps(dai.address)).supplyCap;

    expect(usdcsupplyCap).to.be.equal(newCap);
    expect(daisupplyCap).to.be.equal(newCap);
  });
  it('should fail to supply 100 dai and 100 usdc', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const suppliedAmount = 100;
    const suppliedMilimount = (suppliedAmount * 1000).toString();

    await expect(
      pool.deposit(
        usdc.address,
        await miliUnitToPrecision(usdc, suppliedMilimount),
        deployer.address,
        0
      )
    ).to.be.revertedWith(VL_SUPPLY_CAP_EXCEEDED);

    await expect(
      pool.deposit(
        dai.address,
        await miliUnitToPrecision(dai, suppliedMilimount),
        deployer.address,
        0
      )
    ).to.be.revertedWith(VL_SUPPLY_CAP_EXCEEDED);
  });
  it('Raises the supply cap for usdc and DAI to max cap Units', async () => {
    const { configurator, usdc, pool, dai, deployer, helpersContract } = testEnv;
    const newCap = MAX_SUPPLY_CAP;
    let usdcsupplyCap = (await helpersContract.getReserveCaps(usdc.address)).supplyCap;
    let daisupplyCap = (await helpersContract.getReserveCaps(dai.address)).supplyCap;

    await configurator.setSupplyCap(usdc.address, newCap);
    await configurator.setSupplyCap(dai.address, newCap);

    usdcsupplyCap = (await helpersContract.getReserveCaps(usdc.address)).supplyCap;
    daisupplyCap = (await helpersContract.getReserveCaps(dai.address)).supplyCap;

    expect(usdcsupplyCap).to.be.equal(newCap);
    expect(daisupplyCap).to.be.equal(newCap);
  });
  it('should succeed to supply 100 dai and 100 usdc', async () => {
    const { usdc, pool, dai, deployer, helpersContract } = testEnv;
    const suppliedAmount = 100;
    const suppliedMilimount = (suppliedAmount * 1000).toString();
    await pool.deposit(
      usdc.address,
      await miliUnitToPrecision(usdc, suppliedMilimount),
      deployer.address,
      0
    );

    await pool.deposit(
      dai.address,
      await miliUnitToPrecision(dai, suppliedMilimount),
      deployer.address,
      0
    );
  });
});
