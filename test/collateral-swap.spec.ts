import {makeSuite, TestEnv} from './helpers/make-suite';
import {MockSwapAdapter} from '../types/MockSwapAdapter';
import {getMockSwapAdapter} from '../helpers/contracts-helpers';
import {ProtocolErrors} from '../helpers/types';
import {ethers} from 'ethers';
import {APPROVAL_AMOUNT_LENDING_POOL} from '../helpers/constants';
import {getContractsData, getTxCostAndTimestamp} from './helpers/actions';
import {calcExpectedATokenBalance} from './helpers/utils/calculations';
import {waitForTx} from './__setup.spec';
import {advanceBlock, timeLatest} from '../helpers/misc-utils';

const {expect} = require('chai');

makeSuite('LendingPool CollateralSwap function', (testEnv: TestEnv) => {
  let _mockSwapAdapter = {} as MockSwapAdapter;
  const {HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD} = ProtocolErrors;

  before(async () => {
    _mockSwapAdapter = await getMockSwapAdapter();
  });

  it('Deposits WETH into the reserve', async () => {
    const {pool, weth, users} = testEnv;
    const amountToDeposit = ethers.utils.parseEther('1');

    for (const signer of [weth.signer, users[2].signer]) {
      const connectedWETH = weth.connect(signer);
      await connectedWETH.mint(amountToDeposit);
      await connectedWETH.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
      await pool.connect(signer).deposit(weth.address, amountToDeposit, await signer.getAddress(), '0',);
    }
  });
  it('User tries to swap more then he can', async () => {
    const {pool, weth, dai} = testEnv;
    await expect(
      pool.collateralSwap(
        _mockSwapAdapter.address,
        weth.address,
        dai.address,
        ethers.utils.parseEther('1.1'),
        '0x10'
      )
    ).to.be.revertedWith('55');
  });

  it('User tries to swap more then available on the reserve', async () => {
    const {pool, weth, dai, users, aEth, deployer} = testEnv;

    await pool.borrow(weth.address, ethers.utils.parseEther('0.1'), 1, 0, deployer.address);
    await pool.connect(users[2].signer).withdraw(weth.address, ethers.utils.parseEther('1'));

    await expect(
      pool.collateralSwap(
        _mockSwapAdapter.address,
        weth.address,
        dai.address,
        ethers.utils.parseEther('1'),
        '0x10'
      )
    ).to.be.revertedWith('55');
  });

  it('User tries to swap correct amount', async () => {
    const {pool, weth, dai, aEth, aDai} = testEnv;  
    const userAddress = await pool.signer.getAddress();
    const amountToSwap = ethers.utils.parseEther('0.25');

    const amountToReturn = ethers.utils.parseEther('0.5');
    await _mockSwapAdapter.setAmountToReturn(amountToReturn);

    const {
      reserveData: wethReserveDataBefore,
      userData: wethUserDataBefore,
    } = await getContractsData(weth.address, userAddress, testEnv);

    const {reserveData: daiReserveDataBefore, userData: daiUserDataBefore} = await getContractsData(
      dai.address,
      userAddress,
      testEnv
    );

    const reserveBalanceWETHBefore = await weth.balanceOf(aEth.address);
    const reserveBalanceDAIBefore = await dai.balanceOf(aDai.address);

    const txReceipt = await waitForTx(
      await pool.collateralSwap(
        _mockSwapAdapter.address,
        weth.address,
        dai.address,
        amountToSwap,
        '0x10'
      )
    );
    const {txTimestamp} = await getTxCostAndTimestamp(txReceipt);
    const userATokenBalanceWETHAfter = await aEth.balanceOf(userAddress);
    const userATokenBalanceDAIAfter = await aDai.balanceOf(userAddress);

    const reserveBalanceWETHAfter = await weth.balanceOf(aEth.address);
    const reserveBalanceDAIAfter = await dai.balanceOf(aDai.address);

    expect(userATokenBalanceWETHAfter.toString()).to.be.equal(
      calcExpectedATokenBalance(wethReserveDataBefore, wethUserDataBefore, txTimestamp)
        .minus(amountToSwap.toString())
        .toString(),
      'was burned incorrect amount of user funds'
    );
    expect(userATokenBalanceDAIAfter.toString()).to.be.equal(
      calcExpectedATokenBalance(daiReserveDataBefore, daiUserDataBefore, txTimestamp)
        .plus(amountToReturn.toString())
        .toString(),
      'was minted incorrect amount of user funds'
    );

    expect(reserveBalanceWETHAfter.toString()).to.be.equal(
      reserveBalanceWETHBefore.sub(amountToSwap).toString(),
      'was sent incorrect amount if reserve funds'
    );
    expect(reserveBalanceDAIAfter.toString()).to.be.equal(
      reserveBalanceDAIBefore.add(amountToReturn).toString(),
      'was received incorrect amount if reserve funds'
    );
  });

  it('User tries to drop HF below one', async () => {
    const {pool, weth, dai, deployer} = testEnv;
    const amountToSwap = ethers.utils.parseEther('0.3');

    const amountToReturn = ethers.utils.parseEther('0.5');
    await _mockSwapAdapter.setAmountToReturn(amountToReturn);

    await pool.borrow(weth.address, ethers.utils.parseEther('0.3'), 1, 0, deployer.address);

    await expect(
      pool.collateralSwap(_mockSwapAdapter.address, weth.address, dai.address, amountToSwap, '0x10')
    ).to.be.revertedWith(HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD);
  });

  it('Should set usage as collateral to false if no leftovers after swap', async () => {
    const {pool, weth, dai, aEth, users} = testEnv;
    const userAddress = await pool.signer.getAddress();

    // add more liquidity to allow user 0 to swap everything he has
    await weth.connect(users[2].signer).mint(ethers.utils.parseEther('1'));
    await pool.connect(users[2].signer).deposit(weth.address, ethers.utils.parseEther('1'), users[2].address, '0');

    // cleanup borrowings, to be abe to swap whole weth
    const amountToRepay = ethers.utils.parseEther('0.5');
    await weth.mint(amountToRepay);
    await pool.repay(weth.address, amountToRepay, '1', userAddress);
    const txTimestamp = (await timeLatest()).plus(100);

    const {
      reserveData: wethReserveDataBefore,
      userData: wethUserDataBefore,
    } = await getContractsData(weth.address, userAddress, testEnv);
    const amountToSwap = calcExpectedATokenBalance(
      wethReserveDataBefore,
      wethUserDataBefore,
      txTimestamp.plus('1')
    );

    await advanceBlock(txTimestamp.toNumber());

    await pool.collateralSwap(
      _mockSwapAdapter.address,
      weth.address,
      dai.address,
      amountToSwap.toString(),
      '0x10'
    );
    const {userData: wethUserDataAfter} = await getContractsData(
      weth.address,
      userAddress,
      testEnv
    );
    expect(wethUserDataAfter.usageAsCollateralEnabled).to.be.equal(
      false,
      'usageAsCollateralEnabled are not set to false'
    );
  });
});
