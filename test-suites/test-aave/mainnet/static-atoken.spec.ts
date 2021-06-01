import rawDRE from 'hardhat';
import BigNumber from 'bignumber.js';
import {
  LendingPoolFactory,
  WETH9Factory,
  StaticATokenFactory,
  ATokenFactory,
  ERC20,
  LendingPool,
} from '../../../types';
import { impersonateAccountsHardhat, DRE, waitForTx } from '../../../helpers/misc-utils';
import { utils } from 'ethers';
import { rayMul } from '../../../helpers/ray-math';
import { MAX_UINT_AMOUNT } from '../../../helpers/constants';
import { tEthereumAddress } from '../../../helpers/types';

const { expect } = require('chai');

const DEFAULT_GAS_LIMIT = 10000000;
const DEFAULT_GAS_PRICE = utils.parseUnits('100', 'gwei');

const defaultTxParams = { gasLimit: DEFAULT_GAS_LIMIT, gasPrice: DEFAULT_GAS_PRICE };

const ETHER_BANK = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const LENDING_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

const AWETH = '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e';

const TEST_USERS = ['0x0F4ee9631f4be0a63756515141281A3E2B293Bbe'];

type tBalancesInvolved = {
  aTokenBalanceStaticAToken: BigNumber;
  aTokenBalanceUser: BigNumber;
  underlyingBalanceUser: BigNumber;
  underlyingBalanceStaticAToken: BigNumber;
  userStaticATokenBalance: BigNumber;
  userDynamicStaticATokenBalance: BigNumber;
  currentRate: BigNumber;
  staticATokenSupply: BigNumber;
};

type tContextParams = {
  staticAToken: ERC20;
  underlying: ERC20;
  aToken: ERC20;
  user: tEthereumAddress;
  lendingPool: LendingPool;
};

const getContext = async ({
  staticAToken,
  underlying,
  aToken,
  user,
  lendingPool,
}: tContextParams): Promise<tBalancesInvolved> => ({
  aTokenBalanceStaticAToken: new BigNumber(
    (await aToken.balanceOf(staticAToken.address)).toString()
  ),
  aTokenBalanceUser: new BigNumber((await aToken.balanceOf(user)).toString()),
  underlyingBalanceUser: new BigNumber((await underlying.balanceOf(user)).toString()),
  underlyingBalanceStaticAToken: new BigNumber(
    (await underlying.balanceOf(staticAToken.address)).toString()
  ),
  userStaticATokenBalance: new BigNumber((await staticAToken.balanceOf(user)).toString()),
  userDynamicStaticATokenBalance: new BigNumber(
    rayMul(
      new BigNumber((await staticAToken.balanceOf(user)).toString()),
      new BigNumber((await lendingPool.getReserveNormalizedIncome(WETH)).toString())
    )
  ),
  currentRate: new BigNumber((await lendingPool.getReserveNormalizedIncome(WETH)).toString()),
  staticATokenSupply: new BigNumber((await staticAToken.totalSupply()).toString()),
});

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

describe('StaticAToken: aToken wrapper with static balances', () => {
  it('Deposit WETH on stataWETH, then withdraw of the whole balance in underlying', async () => {
    const userSigner = DRE.ethers.provider.getSigner(TEST_USERS[0]);

    const lendingPool = LendingPoolFactory.connect(LENDING_POOL, userSigner);

    const weth = WETH9Factory.connect(WETH, userSigner);

    const aweth = ATokenFactory.connect(AWETH, userSigner);

    const amountToDeposit = utils.parseEther('5');

    await waitForTx(await weth.deposit({ value: amountToDeposit }));

    const staticAToken = await new StaticATokenFactory(userSigner).deploy(
      LENDING_POOL,
      AWETH,
      'Static Aave Interest Bearing WETH',
      'stataAAVE'
    );

    const ctxtParams: tContextParams = {
      staticAToken: <ERC20>staticAToken,
      underlying: <ERC20>(<unknown>weth),
      aToken: <ERC20>aweth,
      user: userSigner._address,
      lendingPool,
    };

    const ctxtBeforeDeposit = await getContext(ctxtParams);

    await waitForTx(await weth.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);

    expect(ctxtAfterDeposit.aTokenBalanceStaticAToken.toString()).to.be.equal(
      ctxtBeforeDeposit.aTokenBalanceStaticAToken
        .plus(new BigNumber(amountToDeposit.toString()))
        .toString()
    );

    expect(ctxtAfterDeposit.underlyingBalanceUser.toString()).to.be.equal(
      ctxtBeforeDeposit.underlyingBalanceUser
        .minus(new BigNumber(amountToDeposit.toString()))
        .toString()
    );

    expect(ctxtAfterDeposit.userDynamicStaticATokenBalance.toString()).to.be.equal(
      ctxtBeforeDeposit.userDynamicStaticATokenBalance
        .plus(new BigNumber(amountToDeposit.toString()))
        .toString()
    );

    expect(ctxtAfterDeposit.underlyingBalanceStaticAToken.toString()).to.be.equal(
      ctxtBeforeDeposit.underlyingBalanceStaticAToken.toString()
    );

    expect(ctxtBeforeDeposit.aTokenBalanceUser.toString()).to.be.equal(
      ctxtAfterDeposit.aTokenBalanceUser.toString()
    );

    const ctxtBeforeWithdrawal = await getContext(ctxtParams);

    const amountToWithdraw = MAX_UINT_AMOUNT;

    await waitForTx(
      await staticAToken.withdraw(userSigner._address, amountToWithdraw, true, defaultTxParams)
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);

    expect(
      ctxtAfterWithdrawal.aTokenBalanceStaticAToken.toString(),
      'INVALID_ATOKEN_BALANCE_ON_STATICATOKEN_AFTER_WITHDRAW'
    ).to.be.equal(
      rayMul(
        ctxtAfterWithdrawal.staticATokenSupply.plus(ctxtBeforeWithdrawal.userStaticATokenBalance),
        ctxtAfterWithdrawal.currentRate
      )
        .minus(
          rayMul(ctxtBeforeWithdrawal.userStaticATokenBalance, ctxtAfterWithdrawal.currentRate)
        )
        .toString()
    );

    expect(
      ctxtAfterWithdrawal.underlyingBalanceUser.toString(),
      'INVALID_UNDERLYING_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(
      ctxtBeforeWithdrawal.underlyingBalanceUser
        .plus(rayMul(ctxtBeforeWithdrawal.userStaticATokenBalance, ctxtAfterWithdrawal.currentRate))
        .toString()
    );

    expect(
      ctxtAfterWithdrawal.userStaticATokenBalance.toString(),
      'INVALID_STATICATOKEN_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal('0');

    expect(
      ctxtAfterDeposit.underlyingBalanceStaticAToken.toString(),
      'INVALID_UNDERLYNG_BALANCE_OF_STATICATOKEN_AFTER_WITHDRAWAL'
    ).to.be.equal(ctxtBeforeDeposit.underlyingBalanceStaticAToken.toString());

    expect(
      ctxtBeforeDeposit.aTokenBalanceUser.toString(),
      'INVALID_ATOKEN_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(ctxtAfterDeposit.aTokenBalanceUser.toString());
  });

  it('Deposit WETH on stataWETH and then withdraw some balance in underlying', async () => {});

  it('Deposit WETH on stataWETH and then withdraw all the balance in aToken', async () => {});

  it('Deposit aWETH on stataWETH and then withdraw some balance in aToken', async () => {});

  it('Deposit using metaDeposit()', async () => {});

  it('Withdraw using withdrawDynamicAmount()', async () => {});

  it('Withdraw using metaWithdraw()', async () => {});
});
