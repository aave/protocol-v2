import {task} from '@nomiclabs/buidler/config';
import {
  getEthersSigners,
  getLendingPool,
  getMockedTokens,
  MockTokenMap,
} from '../../helpers/contracts-helpers';
import AaveConfig from '../../config/aave';
import BigNumber from 'bignumber.js';
import {LendingPool} from '../../types/LendingPool';
import {ethers} from 'ethers';

task('aave:basicFlow', 'Execute protocol basic flow').setAction(async ({verify}, localBRE) => {
  await localBRE.run('set-bre');

  const [, , user1, user2] = await getEthersSigners();
  const user1Address = await user1.getAddress();
  const user2Address = await user2.getAddress();

  const daiAmount = 10000;
  const wethAmount = 1000;
  const daiTokenAmount = new BigNumber(daiAmount).times(new BigNumber(10).pow(18)).toFixed(0);
  const wethTokenAmount = new BigNumber(wethAmount).times(new BigNumber(10).pow(18)).toFixed(0);

  console.log('Basic Flow started\n');
  // deploy protocol
  await localBRE.run('aave:dev');
  const tokens: MockTokenMap = await getMockedTokens(AaveConfig);

  // mint reserve tokens to user0
  const DAI = tokens.DAI;
  await DAI.connect(user1).mint(daiTokenAmount);
  const daiDepositAmount = new BigNumber('10000').times(new BigNumber(10).pow(18)).toFixed(0);
  // mint WETH for user2
  const WETH = tokens.WETH;
  await WETH.connect(user2).mint(wethTokenAmount);
  const wethDepositAmount = new BigNumber('1000').times(new BigNumber(10).pow(18)).toFixed(0);
  await WETH.connect(user1).mint(wethTokenAmount);

  // user1 deposits DAI, user2 deposits WETH
  const LendingPool: LendingPool = await getLendingPool();

  await DAI.connect(user1).approve(LendingPool.address, ethers.constants.MaxUint256);
  await LendingPool.connect(user1).deposit(DAI.address, daiDepositAmount, user1Address, 0);
  await WETH.connect(user2).approve(LendingPool.address, ethers.constants.MaxUint256);
  await LendingPool.connect(user2).deposit(WETH.address, wethDepositAmount, user2Address, 0);

  // user1 borrows WETH token at stable rate
  const wethBorrowAmount = new BigNumber('10').times(new BigNumber(10).pow(18)).toFixed(0);
  await LendingPool.connect(user1).borrow(WETH.address, wethBorrowAmount, 1, 0, user1Address);

  // user1 repays debt
  await WETH.connect(user1).approve(LendingPool.address, ethers.constants.MaxUint256);
  await LendingPool.connect(user1).repay(
    WETH.address,
    ethers.constants.MaxUint256,
    1,
    user1Address
  );

  // user1 withdraws collateral
  await LendingPool.connect(user1).withdraw(DAI.address, ethers.constants.MaxUint256);
});
