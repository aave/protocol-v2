/**
 * @dev test for LidoVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { printDivider } from './helpers/utils/helpers';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { APPROVAL_AMOUNT_LENDING_POOL, ZERO_ADDRESS } from '../../helpers/constants';
import { ILidoFactory } from '../../types/ILidoFactory';

const { parseEther } = ethers.utils;

makeSuite('LidoVault', (testEnv: TestEnv) => {
  it('failed deposit for collateral without ether', async () => {
    const { lidoVault } = testEnv;

    await expect(lidoVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
  });

  it('deposit ETH for collateral', async () => {
    const { lidoVault, deployer, lido, aStETH } = testEnv;
    // const beforePooledEther = await lido.getTotalPooledEther();
    await lidoVault.depositCollateral(ZERO_ADDRESS, parseEther('1.1'), {
      value: parseEther('1.1'),
    });
    // const currentPooledEther = await lido.getTotalPooledEther();
    // expect(currentPooledEther.sub(beforePooledEther)).to.be.equal(parseEther('1.1'));
    expect(await lido.balanceOf(lidoVault.address)).to.be.equal(0);
    expect(await aStETH.balanceOf(lidoVault.address)).to.be.equal(0);
    expect((await aStETH.balanceOf(deployer.address)).gt(parseEther('1.099'))).to.be.equal(true);
    expect(await ethers.getDefaultProvider().getBalance(lidoVault.address)).to.be.equal(0);
  });

  it('stETH & aStETH balance check after deposit for collateral', async () => {
    const { lidoVault, deployer, lido, aStETH } = testEnv;
    const stETHBalanceOfPool = await lido.balanceOf(lidoVault.address);
    const aTokensBalance = await aStETH.balanceOf(deployer.address);
    expect(stETHBalanceOfPool.lt(parseEther('0.0001'))).to.be.equal(true);
    expect(aTokensBalance.gt(parseEther('1.1'))).to.be.equal(true);
  });

  it('transferring aStETH should be success after deposit ETH', async () => {
    const { aStETH, users } = testEnv;
    await expect(aStETH.transfer(users[0].address, parseEther('0.05'))).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, lidoVault } = testEnv;
    await expect(
      lidoVault.withdrawCollateral(ZERO_ADDRESS, parseEther('1.1'), 9900, deployer.address)
    ).to.be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, lido, lidoVault } = testEnv;
    const stETHBalanceOfPool = await lido.balanceOf(lidoVault.address);
    const ethBeforeBalanceOfUser = await deployer.signer.getBalance();

    await lidoVault.withdrawCollateral(ZERO_ADDRESS, parseEther('1'), 9900, deployer.address);

    const ethCurrentBalanceOfUser = await deployer.signer.getBalance();
    expect(stETHBalanceOfPool.lt(parseEther('0.0001'))).to.be.equal(true);
    expect(ethCurrentBalanceOfUser.sub(ethBeforeBalanceOfUser).gt(parseEther('0.9'))).to.be.equal(
      true
    );
    expect(await ethers.getDefaultProvider().getBalance(lidoVault.address)).to.be.equal(0);
  });
});

makeSuite('LidoVault - use other coin as collateral', (testEnv) => {
  it('Should revert to use any of coin other than ETH, stETH as collateral. ', async () => {
    const { usdc, lidoVault } = testEnv;

    await expect(lidoVault.depositCollateral(usdc.address, 1000)).to.be.revertedWith('82');
  });
});
