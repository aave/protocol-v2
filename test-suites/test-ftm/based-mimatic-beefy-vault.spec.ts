/**
 * @dev test for BasedMiMaticBeefyVault functions
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';

const { parseEther } = ethers.utils;

makeSuite('BasedMiMaticBeefyVault', (testEnv: TestEnv) => {
  it('failed deposit for collateral without BASED_MIMATIC_LP', async () => {
    const { BasedMiMaticBeefyVault } = testEnv;
    await expect(BasedMiMaticBeefyVault.depositCollateral(ZERO_ADDRESS, 0)).to.be.reverted;
  });

  it('deposit BASED_MIMATIC_LP for collateral', async () => {
    const { BasedMiMaticBeefyVault, deployer, moobased_mimatic, aMooBASED_MIMATIC, BASED_MIMATIC_LP } = testEnv;
    const ethers = (DRE as any).ethers;

    // Make some test BASED_MIMATIC_LP for depositor
    const amountBasedMiMaticLPtoDeposit = await convertToCurrencyDecimals(BASED_MIMATIC_LP.address, '2500');
    const BasedMiMaticLPOwnerAddress = '0xB339ac13d9dAe79Ab6caD15Ec8903131099ceEA5';
    await impersonateAccountsHardhat([BasedMiMaticLPOwnerAddress]);
    let signer = await ethers.provider.getSigner(BasedMiMaticLPOwnerAddress);
    await BASED_MIMATIC_LP.connect(signer).transfer(deployer.address, amountBasedMiMaticLPtoDeposit);
    
    await BASED_MIMATIC_LP.connect(deployer.signer).approve(BasedMiMaticBeefyVault.address, amountBasedMiMaticLPtoDeposit);

    await BasedMiMaticBeefyVault.connect(deployer.signer).depositCollateral(BASED_MIMATIC_LP.address, amountBasedMiMaticLPtoDeposit);

    expect(await moobased_mimatic.balanceOf(BasedMiMaticBeefyVault.address)).to.be.equal(0);
    expect(await aMooBASED_MIMATIC.balanceOf(BasedMiMaticBeefyVault.address)).to.be.equal(0);
    expect(await aMooBASED_MIMATIC.balanceOf(deployer.address)).to.be.gte(await convertToCurrencyDecimals(BASED_MIMATIC_LP.address, '2494.99'));
    expect(await BASED_MIMATIC_LP.balanceOf(deployer.address)).to.be.equal(0);
  });

  it('transferring aMooBASED_MIMATIC should be success after deposit BASED_MIMATIC_LP', async () => {
    const { aMooBASED_MIMATIC, users, deployer } = testEnv;
    await expect(aMooBASED_MIMATIC.connect(deployer.signer).transfer(users[0].address, await convertToCurrencyDecimals(aMooBASED_MIMATIC.address, '50'))).to.not.be.reverted;
  });

  it('withdraw from collateral should be failed if user has not enough balance', async () => {
    const { deployer, BasedMiMaticBeefyVault, BASED_MIMATIC_LP } = testEnv;
    const amountBasedMiMaticLPtoDeposit = await convertToCurrencyDecimals(BASED_MIMATIC_LP.address, '2500');
    await expect(BasedMiMaticBeefyVault.connect(deployer.address).withdrawCollateral(BASED_MIMATIC_LP.address, amountBasedMiMaticLPtoDeposit, 9900, deployer.address))
      .to.be.reverted;
  });

  it('withdraw from collateral', async () => {
    const { deployer, moobased_mimatic, BasedMiMaticBeefyVault, BASED_MIMATIC_LP } = testEnv;
    const moobasedmimaticBalanceOfPool = await moobased_mimatic.balanceOf(BasedMiMaticBeefyVault.address);
    const BasedMiMaticLPBeforeBalanceOfUser = await BASED_MIMATIC_LP.balanceOf(deployer.address);
    const BasedMiMaticLPWithdrawAmount = await convertToCurrencyDecimals(BASED_MIMATIC_LP.address, '2444');

    await BasedMiMaticBeefyVault.connect(deployer.signer).withdrawCollateral(BASED_MIMATIC_LP.address, BasedMiMaticLPWithdrawAmount, 9900, deployer.address);

    const BasedMiMaticLPCurrentBalanceOfUser = await BASED_MIMATIC_LP.balanceOf(deployer.address);
    expect(moobasedmimaticBalanceOfPool).to.be.equal(0);
    expect(BasedMiMaticLPCurrentBalanceOfUser.sub(BasedMiMaticLPBeforeBalanceOfUser)).to.be.gte(
      await convertToCurrencyDecimals(BASED_MIMATIC_LP.address, '2443.5')
    );
    expect(await BASED_MIMATIC_LP.balanceOf(BasedMiMaticBeefyVault.address)).to.be.equal(0);
  });
});

makeSuite('BasedMiMaticBeefyVault - use other coin as collateral', (testEnv) => {
  it('Should revert to use any of coin other than BASED_MIMATIC_LP as collateral', async () => {
    const { usdc, BasedMiMaticBeefyVault, moobased_mimatic } = testEnv;
    // TODO @bshevchenko: use Error const instead of 82
    await expect(BasedMiMaticBeefyVault.depositCollateral(moobased_mimatic.address, 1000)).to.be.revertedWith('82');
  });
});

makeSuite('BasedMiMaticBeefyVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for single asset', async () => {
    const { pool, BasedMiMaticBeefyVault, usdc, users, BASED_MIMATIC_LP, moobased_mimatic, aMooBASED_MIMATIC, aUsdc, deployer } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const ethers = (DRE as any).ethers;
    const amountBasedMiMaticLPtoDeposit = await convertToCurrencyDecimals(BASED_MIMATIC_LP.address, '2500');
    const usdcOwnerAddress = '0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe';
    const depositUSDC = '7000';

    // Make some test USDC for depositor
    await impersonateAccountsHardhat([usdcOwnerAddress]);
    let signer = await ethers.provider.getSigner(usdcOwnerAddress);
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
    await usdc.connect(signer).Swapin(
      '0x6af483697065dda1e50693750662adb39012699bbdb49d908d682a275a83c4cf', // TODO random tx hash
      depositor.address,
      amountUSDCtoDeposit
    );

    // approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, amountUSDCtoDeposit);

    // Supplier deposits USDC
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    const BasedMiMaticLPOwnerAddress = '0xB339ac13d9dAe79Ab6caD15Ec8903131099ceEA5';
    await impersonateAccountsHardhat([BasedMiMaticLPOwnerAddress]);
    signer = await ethers.provider.getSigner(BasedMiMaticLPOwnerAddress);
    await BASED_MIMATIC_LP.connect(signer).transfer(borrower.address, amountBasedMiMaticLPtoDeposit);
    
    // approve protocol to access borrower wallet
    await BASED_MIMATIC_LP.connect(borrower.signer).approve(BasedMiMaticBeefyVault.address, amountBasedMiMaticLPtoDeposit);

    // deposit collateral to borrow
    await BasedMiMaticBeefyVault.connect(borrower.signer).depositCollateral(BASED_MIMATIC_LP.address, amountBasedMiMaticLPtoDeposit);
    expect(await BasedMiMaticBeefyVault.getYieldAmount()).to.be.equal(0);

    // To simulate yield in lendingPool, deposit some moobased_mimatic to aMooBASED_MIMATIC contract
    const moobasedmimaticOwnerAddress = '0xb01BF93D6c59Ce2beF0eE8eA2619f6B5057fA464';
    const yieldmoobasedmimaticAmount = await convertToCurrencyDecimals(BASED_MIMATIC_LP.address, '2500');
    await impersonateAccountsHardhat([moobasedmimaticOwnerAddress]);
    signer = await ethers.provider.getSigner(moobasedmimaticOwnerAddress);
    await moobased_mimatic.connect(signer).transfer(aMooBASED_MIMATIC.address, yieldmoobasedmimaticAmount);

    expect(await BasedMiMaticBeefyVault.getYieldAmount()).to.be.gt(await convertToCurrencyDecimals(BASED_MIMATIC_LP.address, '1499.999'));
    expect(await usdc.balanceOf(BasedMiMaticBeefyVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);

    // process yield, so all yield should be converted to usdc
    await BasedMiMaticBeefyVault.connect(deployer.signer).processYield();
    const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '11700');
    expect(await aUsdc.balanceOf(depositor.address)).to.be.gt(yieldUSDC);
  });
});

makeSuite('BasedMiMaticBeefyVault', (testEnv: TestEnv) => {
  it('distribute yield to supplier for multiple asset', async () => {
    const { pool, BasedMiMaticBeefyVault, usdc, usdt, users, moobased_mimatic, aUsdc, aUsdt, aMooBASED_MIMATIC, BASED_MIMATIC_LP, dai, aDai, deployer } = testEnv;
    const depositor = users[0];
    const depositor1 = users[1];
    const depositor2 = users[2];
    const borrower = users[3];
    const ethers = (DRE as any).ethers;
    const usdcOwnerAddress = '0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe';
    const depositUSDC = '7000';
    //Make some test USDC for depositor
    await impersonateAccountsHardhat([usdcOwnerAddress]);
    let signer = await ethers.provider.getSigner(usdcOwnerAddress);
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
    await usdc.connect(signer).Swapin(
      '0x6af483697065dda1e50693750662adb39012699bbdb49d908d682a275a83c4cf', // TODO random tx hash
      depositor.address,
      amountUSDCtoDeposit
    );

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, amountUSDCtoDeposit);

    //Supplier  deposits 7000 USDC
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    const daiOwnerAddress = '0x7182a1b9cf88e87b83e936d3553c91f9e7bebdd7';
    const depositDAI = '7000';
    //Make some test DAI for depositor
    await impersonateAccountsHardhat([daiOwnerAddress]);
    signer = await ethers.provider.getSigner(daiOwnerAddress);
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, depositDAI);
    await dai.connect(signer).transfer(depositor1.address, amountDAItoDeposit);

    //approve protocol to access depositor wallet
    await dai.connect(depositor1.signer).approve(pool.address, amountDAItoDeposit);

    //Supplier deposits 7000 DAI
    await pool
      .connect(depositor1.signer)
      .deposit(dai.address, amountDAItoDeposit, depositor1.address, '0');

    const usdtOwnerAddress = '0x93C08a3168fC469F3fC165cd3A471D19a37ca19e';
    const depositUSDT = '3500';
    //Make some test USDT for depositor
    await impersonateAccountsHardhat([usdtOwnerAddress]);
    signer = await ethers.provider.getSigner(usdtOwnerAddress);
    const amountUSDTtoDeposit = await convertToCurrencyDecimals(usdt.address, depositUSDT);
    await usdt.connect(signer).transfer(depositor2.address, amountUSDTtoDeposit);

    //approve protocol to access depositor wallet
    await usdt.connect(depositor2.signer).approve(pool.address, amountUSDTtoDeposit);

    //Supplier  deposits 3500 USDT
    await pool
      .connect(depositor2.signer)
      .deposit(usdt.address, amountUSDTtoDeposit, depositor2.address, '0');

    const BasedMiMaticLPOwnerAddress = '0xB339ac13d9dAe79Ab6caD15Ec8903131099ceEA5';
    const depositBasedMiMaticLP = '2500';
    const depositBasedMiMaticLPAmount = await convertToCurrencyDecimals(BASED_MIMATIC_LP.address, depositBasedMiMaticLP);
    //Make some test BASED_MIMATIC_LP for borrower
    await impersonateAccountsHardhat([BasedMiMaticLPOwnerAddress]);
    signer = await ethers.provider.getSigner(BasedMiMaticLPOwnerAddress);

    //transfer to borrower
    await BASED_MIMATIC_LP.connect(signer).transfer(borrower.address, depositBasedMiMaticLPAmount);

    //approve protocol to access borrower wallet
    await BASED_MIMATIC_LP.connect(borrower.signer).approve(BasedMiMaticBeefyVault.address, depositBasedMiMaticLPAmount);

    // deposit collateral to borrow
    await BasedMiMaticBeefyVault.connect(borrower.signer).depositCollateral(BASED_MIMATIC_LP.address, depositBasedMiMaticLPAmount);
    expect(await BasedMiMaticBeefyVault.getYieldAmount()).to.be.equal(0);

    //To simulate yield in lendingPool, deposit some moobased_mimatic to aMooBASED_MIMATIC contract
    const moobasedmimaticOwnerAddress = '0xb01BF93D6c59Ce2beF0eE8eA2619f6B5057fA464';
    const yieldmoobasedmimatic = '2500';
    const yieldmoobasedmimaticAmount = await convertToCurrencyDecimals(moobased_mimatic.address, yieldmoobasedmimatic);
    //Make some test moobased_mimatic
    await impersonateAccountsHardhat([moobasedmimaticOwnerAddress]);
    signer = await ethers.provider.getSigner(moobasedmimaticOwnerAddress);
    await moobased_mimatic.connect(signer).transfer(aMooBASED_MIMATIC.address, yieldmoobasedmimaticAmount);

    expect((await BasedMiMaticBeefyVault.getYieldAmount()).gt(parseEther('2499.99'))).to.be.equal(true);
    expect(await usdc.balanceOf(BasedMiMaticBeefyVault.address)).to.be.equal(0);
    expect(await dai.balanceOf(BasedMiMaticBeefyVault.address)).to.be.equal(0);
    expect(await aUsdc.balanceOf(depositor.address)).to.be.equal(amountUSDCtoDeposit);
    expect(await aDai.balanceOf(depositor1.address)).to.be.equal(amountDAItoDeposit);
    expect(await aUsdt.balanceOf(depositor2.address)).to.be.equal(amountUSDTtoDeposit);

    // process yield, so all yield should be converted to usdc and dai
    await BasedMiMaticBeefyVault.connect(deployer.signer).processYield();
    const yieldUSDC = await convertToCurrencyDecimals(usdc.address, '8800');
    const yieldDAI = await convertToCurrencyDecimals(dai.address, '8800');
    const yieldUSDT = await convertToCurrencyDecimals(usdt.address, '4300');
    expect((await aUsdc.balanceOf(depositor.address)).gt(yieldUSDC)).to.be.equal(true);
    expect((await aDai.balanceOf(depositor1.address)).gt(yieldDAI)).to.be.equal(true);
    expect((await aUsdt.balanceOf(depositor2.address)).gt(yieldUSDT)).to.be.equal(true);
  });
});