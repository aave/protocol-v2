import {task} from '@nomiclabs/buidler/config';
import {checkVerification} from '../../helpers/etherscan-verification';
import {ConfigNames} from '../../helpers/configuration';
import {EthereumNetworkNames} from '../../helpers/types';
import {eContractid} from '../../helpers/types';
import {
  getAaveProtocolTestHelpers,
  getEthersSigners,
  getLendingPool,
  getMockedTokens,
  MockTokenMap,
} from '../../helpers/contracts-helpers';
import AaveConfig from '../../config/aave';
import BigNumber from 'bignumber.js';
import {LendingPool} from '../../types/LendingPool';
import {ethers} from 'ethers';
import {ATokenFactory} from '../../types';

task('aave:basicFlow', 'Execute protocol basic flow').setAction(async ({verify}, localBRE) => {
  const POOL_NAME = ConfigNames.Aave;
  const network = <EthereumNetworkNames>localBRE.network.name;

  await localBRE.run('set-bre');

  // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
  // if (verify) {
  //   checkVerification();
  // }

  const [, , user1, user2] = await getEthersSigners();

  const daiAmount = 1000;
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
  const daiDepositAmount = new BigNumber('100').times(new BigNumber(10).pow(18)).toFixed(0);
  // mint WETH for user2
  const WETH = tokens.WETH;
  await WETH.connect(user2).mint(wethTokenAmount);
  const wethDepositAmount = new BigNumber('100').times(new BigNumber(10).pow(18)).toFixed(0);

  // user1 deposits DAI, user2 deposits WETH
  const LendingPool: LendingPool = await getLendingPool();

  await DAI.connect(user1).approve(LendingPool.address, ethers.constants.MaxUint256);
  await LendingPool.connect(user1).deposit(
    DAI.address,
    daiDepositAmount,
    await user1.getAddress(),
    0
  );
  await WETH.connect(user2).approve(LendingPool.address, ethers.constants.MaxUint256);
  await LendingPool.connect(user2).deposit(
    WETH.address,
    wethDepositAmount,
    await user2.getAddress(),
    0
  );
  // to check the adai
  // const reserveData = await LendingPool.connect(user1).getReserveData(DAI.address);
  // const AToken = ATokenFactory.connect(reserveData[7].toString(), user1);

  // user1 borrows WETH token at stable rate
  const wethBorrowAmount = new BigNumber('100').times(new BigNumber(10).pow(18)).toFixed(0);
  console.log('========== ', WETH.address);
  await LendingPool.connect(user1).borrow(
    WETH.address,
    wethBorrowAmount,
    1,
    0,
    await user1.getAddress()
  );
  console.log('--------------');
  console.log(await (await WETH.connect(user1).balanceOf(await user1.getAddress())).toString());

  // user1 repays debt

  // user1 withdraws collateral
});
