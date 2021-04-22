import rawDRE from 'hardhat';
import BigNumber from 'bignumber.js';
import chai, { expect } from 'chai';
import bignumberChai from 'chai-bignumber';
import { solidity } from 'ethereum-waffle';
import {
  LendingPoolFactory,
  WETH9Factory,
  StaticATokenFactory,
  ATokenFactory,
  ERC20,
  LendingPool,
  StaticATokenMetaTransactionMock,
  StaticATokenMetaTransactionMockFactory,
  WETH9,
  AToken,
  StaticAToken,
} from '../../types';
import {
  buildPermitParams,
  buildMetaDepositParams,
  buildMetaWithdrawParams,
  getSignatureFromTypedData,
} from '../../helpers/contracts-helpers';
import { impersonateAccountsHardhat, DRE, waitForTx } from '../../helpers/misc-utils';
import { utils } from 'ethers';
import { rayDiv, rayMul } from '../../helpers/ray-math';
import { MAX_UINT_AMOUNT } from '../../helpers/constants';
import { tEthereumAddress } from '../../helpers/types';
import { JsonRpcSigner } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { parseEther } from '@ethersproject/units';
import { parse } from 'path';

chai.use(bignumberChai());
chai.use(solidity);

const DEFAULT_GAS_LIMIT = 10000000;
const DEFAULT_GAS_PRICE = utils.parseUnits('100', 'gwei');

const defaultTxParams = { gasLimit: DEFAULT_GAS_LIMIT, gasPrice: DEFAULT_GAS_PRICE };

const ETHER_BANK = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const LENDING_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

const AWETH = '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e';

const TEST_USERS = ['0x0F4ee9631f4be0a63756515141281A3E2B293Bbe'];

const AWETH_HOLDER = '0x928477dabc0eD2a6CE6c33966a52eA58CbDEA212';

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

const getInterestAccrued = (ctxBefore: tBalancesInvolved, ctxAfter: tBalancesInvolved) =>
  rayMul(
    rayDiv(ctxBefore.aTokenBalanceStaticAToken.toString(), ctxBefore.currentRate.toString()),
    ctxAfter.currentRate.toString()
  ).minus(ctxBefore.aTokenBalanceStaticAToken.toString());

const getUserInterestAccrued = (ctxBefore: tBalancesInvolved, ctxAfter: tBalancesInvolved) =>
  rayMul(
    rayDiv(ctxBefore.aTokenBalanceUser.toString(), ctxBefore.currentRate.toString()),
    ctxAfter.currentRate.toString()
  ).minus(ctxBefore.aTokenBalanceUser.toString());

describe('StaticAToken: aToken wrapper with static balances', () => {
  let weth: WETH9;
  let lendingPool: LendingPool;
  let aweth: AToken;
  let user1Signer: JsonRpcSigner;
  let controlledPkSigner: SignerWithAddress;
  let staticAWeth: StaticAToken;
  before(async () => {
    await rawDRE.run('set-DRE');
    // Impersonations
    await impersonateAccountsHardhat([ETHER_BANK, ...TEST_USERS, AWETH_HOLDER]);
    const ethHolderSigner = rawDRE.ethers.provider.getSigner(ETHER_BANK);
    const awethHolderSigner = rawDRE.ethers.provider.getSigner(AWETH_HOLDER);
    user1Signer = DRE.ethers.provider.getSigner(TEST_USERS[0]);
    controlledPkSigner = (await rawDRE.ethers.getSigners())[0];

    lendingPool = LendingPoolFactory.connect(LENDING_POOL, user1Signer);
    weth = WETH9Factory.connect(WETH, user1Signer);
    aweth = ATokenFactory.connect(AWETH, user1Signer);

    await aweth.connect(awethHolderSigner).transfer(controlledPkSigner.address, parseEther('5.0'));

    for (const recipientOfEth of [...TEST_USERS]) {
      await ethHolderSigner.sendTransaction({
        from: ethHolderSigner._address,
        to: recipientOfEth,
        value: utils.parseEther('100'),
        ...defaultTxParams,
      });
    }
    await waitForTx(await weth.deposit({ value: parseEther('5') }));

    staticAWeth = await new StaticATokenFactory(user1Signer).deploy(
      LENDING_POOL,
      AWETH,
      'Static Aave Interest Bearing WETH',
      'stataAAVE'
    );
  });
  it('Deposit WETH on stataWETH, then withdraw of the whole balance in underlying', async () => {
    const amountToDeposit = utils.parseEther('5');

    const ctxtParams: tContextParams = {
      staticAToken: <ERC20>staticAWeth,
      underlying: <ERC20>(<unknown>weth),
      aToken: <ERC20>aweth,
      user: user1Signer._address,
      lendingPool,
    };

    const ctxtBeforeDeposit = await getContext(ctxtParams);

    await waitForTx(await weth.approve(staticAWeth.address, amountToDeposit, defaultTxParams));

    await waitForTx(
      await staticAWeth.deposit(user1Signer._address, amountToDeposit, 0, true, defaultTxParams)
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
      await staticAWeth.withdraw(user1Signer._address, amountToWithdraw, true, defaultTxParams)
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);

    expect(
      ctxtAfterWithdrawal.aTokenBalanceStaticAToken.toString(),
      'INVALID_ATOKEN_BALANCE_ON_STATICATOKEN_AFTER_WITHDRAW'
    ).to.be.equal(
      rayMul(
        ctxtBeforeWithdrawal.staticATokenSupply.minus(ctxtBeforeWithdrawal.userStaticATokenBalance),
        ctxtAfterWithdrawal.currentRate
      ).toString()
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
      ctxtAfterWithdrawal.underlyingBalanceStaticAToken.toString(),
      'INVALID_UNDERLYNG_BALANCE_OF_STATICATOKEN_AFTER_WITHDRAWAL'
    ).to.be.equal(ctxtBeforeWithdrawal.underlyingBalanceStaticAToken.toString());

    expect(
      ctxtAfterWithdrawal.aTokenBalanceUser.toString(),
      'INVALID_ATOKEN_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(ctxtBeforeWithdrawal.aTokenBalanceUser.toString());
  });

  it('Deposit WETH on stataWETH and then withdraw to some balance in underlying', async () => {
    const amountToDeposit = utils.parseEther('5');

    const ctxtParams: tContextParams = {
      staticAToken: <ERC20>staticAWeth,
      underlying: <ERC20>(<unknown>weth),
      aToken: <ERC20>aweth,
      user: user1Signer._address,
      lendingPool,
    };

    const ctxtBeforeDeposit = await getContext(ctxtParams);

    await waitForTx(await weth.approve(staticAWeth.address, amountToDeposit, defaultTxParams));

    await waitForTx(
      await staticAWeth.deposit(user1Signer._address, amountToDeposit, 0, true, defaultTxParams)
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

    const amountToWithdraw = parseEther('2.0');

    await waitForTx(
      await staticAWeth.withdraw(user1Signer._address, amountToWithdraw, true, defaultTxParams)
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);

    expect(
      ctxtAfterWithdrawal.aTokenBalanceStaticAToken.toString(),
      'INVALID_ATOKEN_BALANCE_ON_STATICATOKEN_AFTER_WITHDRAW'
    ).to.be.equal(
      rayMul(
        ctxtBeforeWithdrawal.staticATokenSupply.minus(amountToWithdraw.toString()),
        ctxtAfterWithdrawal.currentRate
      ).toString()
    );

    expect(
      ctxtAfterWithdrawal.underlyingBalanceUser.toString(),
      'INVALID_UNDERLYING_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(
      ctxtBeforeWithdrawal.underlyingBalanceUser
        .plus(rayMul(amountToWithdraw.toString(), ctxtAfterWithdrawal.currentRate))
        .toString()
    );

    expect(
      ctxtAfterWithdrawal.userStaticATokenBalance.toString(),
      'INVALID_STATICATOKEN_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(
      ctxtBeforeWithdrawal.userStaticATokenBalance.minus(amountToWithdraw.toString()).toString()
    );

    expect(
      ctxtAfterWithdrawal.underlyingBalanceStaticAToken.toString(),
      'INVALID_UNDERLYNG_BALANCE_OF_STATICATOKEN_AFTER_WITHDRAWAL'
    ).to.be.equal(ctxtBeforeWithdrawal.underlyingBalanceStaticAToken.toString());

    expect(
      ctxtAfterWithdrawal.aTokenBalanceUser.toString(),
      'INVALID_ATOKEN_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(ctxtBeforeWithdrawal.aTokenBalanceUser.toString());
  });

  it('Deposit WETH on stataWETH and then withdrawDynamic some balance in aToken', async () => {
    const amountToDeposit = utils.parseEther('4');

    const ctxtParams: tContextParams = {
      staticAToken: <ERC20>staticAWeth,
      underlying: <ERC20>(<unknown>weth),
      aToken: <ERC20>aweth,
      user: user1Signer._address,
      lendingPool,
    };

    const ctxtBeforeDeposit = await getContext(ctxtParams);

    await waitForTx(await weth.approve(staticAWeth.address, amountToDeposit, defaultTxParams));

    await waitForTx(
      await staticAWeth.deposit(user1Signer._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);
    const interestAccrued = getInterestAccrued(ctxtBeforeDeposit, ctxtAfterDeposit);
    expect(ctxtAfterDeposit.aTokenBalanceStaticAToken.toString()).to.be.equal(
      ctxtBeforeDeposit.aTokenBalanceStaticAToken
        .plus(new BigNumber(amountToDeposit.toString()))
        .plus(interestAccrued)
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
        .plus(interestAccrued)
        .toString()
    );
    expect(ctxtAfterDeposit.underlyingBalanceStaticAToken.toString()).to.be.equal(
      ctxtBeforeDeposit.underlyingBalanceStaticAToken.toString()
    );
    expect(ctxtBeforeDeposit.aTokenBalanceUser.toString()).to.be.equal(
      ctxtAfterDeposit.aTokenBalanceUser.toString()
    );

    const ctxtBeforeWithdrawal = await getContext(ctxtParams);

    const amountToWithdraw = parseEther('2.0');

    await waitForTx(
      await staticAWeth.withdrawInDynamicAmount(
        user1Signer._address,
        amountToWithdraw,
        false,
        defaultTxParams
      )
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);
    const interestAccruedWithdrawal = getInterestAccrued(ctxtBeforeWithdrawal, ctxtAfterWithdrawal);
    expect(
      ctxtAfterWithdrawal.aTokenBalanceStaticAToken.toString(),
      'INVALID_ATOKEN_BALANCE_ON_STATICATOKEN_AFTER_WITHDRAW'
    ).to.be.equal(
      ctxtBeforeWithdrawal.aTokenBalanceStaticAToken
        .minus(amountToWithdraw.toString())
        .plus(interestAccruedWithdrawal)
        .plus('1') // rounding issue
        .toString()
    );
    expect(
      ctxtAfterWithdrawal.underlyingBalanceUser.toString(),
      'INVALID_UNDERLYING_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(ctxtBeforeWithdrawal.underlyingBalanceUser.toString());
    expect(
      ctxtAfterWithdrawal.userStaticATokenBalance.toString(),
      'INVALID_STATICATOKEN_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(
      ctxtBeforeWithdrawal.userStaticATokenBalance
        .minus(rayDiv(amountToWithdraw.toString(), ctxtAfterWithdrawal.currentRate))
        .toString()
    );
    expect(
      ctxtAfterWithdrawal.underlyingBalanceStaticAToken.toString(),
      'INVALID_UNDERLYNG_BALANCE_OF_STATICATOKEN_AFTER_WITHDRAWAL'
    ).to.be.equal(ctxtBeforeWithdrawal.underlyingBalanceStaticAToken.toString());
    expect(
      ctxtAfterWithdrawal.aTokenBalanceUser.toString(),
      'INVALID_ATOKEN_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(
      ctxtBeforeWithdrawal.aTokenBalanceUser.plus(amountToWithdraw.toString()).toString()
    );
  });

  // tslint:disable-next-line:max-line-length
  it('User 2 Deposits aWETH for user 1 and then withdraw some balance to second user in aToken', async () => {
    const amountToDeposit = utils.parseEther('4');

    const ctxtParams: tContextParams = {
      staticAToken: <ERC20>staticAWeth,
      underlying: <ERC20>(<unknown>weth),
      aToken: <ERC20>aweth,
      user: user1Signer._address,
      lendingPool,
    };

    const ctxtBeforeDeposit = await getContext(ctxtParams);

    await waitForTx(
      await aweth.connect(controlledPkSigner).approve(staticAWeth.address, MAX_UINT_AMOUNT)
    );

    await waitForTx(
      await staticAWeth
        .connect(controlledPkSigner)
        .deposit(user1Signer._address, amountToDeposit, 0, false, defaultTxParams)
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);
    const interestAccrued = getInterestAccrued(ctxtBeforeDeposit, ctxtAfterDeposit);
    const userInterestAccrued = getUserInterestAccrued(ctxtBeforeDeposit, ctxtAfterDeposit);
    expect(ctxtAfterDeposit.aTokenBalanceStaticAToken.toString()).to.be.equal(
      ctxtBeforeDeposit.aTokenBalanceStaticAToken
        .plus(new BigNumber(amountToDeposit.toString()))
        .plus(interestAccrued)
        .plus(1)
        .toString()
    );
    expect(ctxtAfterDeposit.underlyingBalanceUser.toString()).to.be.equal(
      ctxtBeforeDeposit.underlyingBalanceUser.toString()
    );
    expect(ctxtAfterDeposit.userDynamicStaticATokenBalance.toString()).to.be.equal(
      ctxtBeforeDeposit.userDynamicStaticATokenBalance
        .plus(new BigNumber(amountToDeposit.toString()))
        .plus(interestAccrued)
        .plus(1)
        .toString()
    );
    expect(ctxtAfterDeposit.underlyingBalanceStaticAToken.toString()).to.be.equal(
      ctxtBeforeDeposit.underlyingBalanceStaticAToken.toString()
    );
    expect(ctxtAfterDeposit.aTokenBalanceUser.toString()).to.be.equal(
      ctxtBeforeDeposit.aTokenBalanceUser.plus(userInterestAccrued).toString()
    );
    const ctxtBeforeWithdrawal = await getContext(ctxtParams);

    const amountToWithdraw = parseEther('2.0');

    await waitForTx(
      await staticAWeth.withdrawInDynamicAmount(
        user1Signer._address,
        amountToWithdraw,
        false,
        defaultTxParams
      )
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);
    const interestAccruedWithdrawal = getInterestAccrued(ctxtBeforeWithdrawal, ctxtAfterWithdrawal);
    const userInterestAccruedWithdrawal = getUserInterestAccrued(
      ctxtBeforeWithdrawal,
      ctxtAfterWithdrawal
    );
    expect(
      ctxtAfterWithdrawal.aTokenBalanceStaticAToken.toString(),
      'INVALID_ATOKEN_BALANCE_ON_STATICATOKEN_AFTER_WITHDRAW'
    ).to.be.equal(
      ctxtBeforeWithdrawal.aTokenBalanceStaticAToken
        .minus(amountToWithdraw.toString())
        .plus(interestAccruedWithdrawal)
        .plus('1') // rounding issue
        .toString()
    );
    expect(
      ctxtAfterWithdrawal.underlyingBalanceUser.toString(),
      'INVALID_UNDERLYING_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(ctxtBeforeWithdrawal.underlyingBalanceUser.toString());
    expect(
      ctxtAfterWithdrawal.userStaticATokenBalance.toString(),
      'INVALID_STATICATOKEN_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(
      ctxtBeforeWithdrawal.userStaticATokenBalance
        .minus(rayDiv(amountToWithdraw.toString(), ctxtAfterWithdrawal.currentRate))
        .toString()
    );
    expect(
      ctxtAfterWithdrawal.underlyingBalanceStaticAToken.toString(),
      'INVALID_UNDERLYNG_BALANCE_OF_STATICATOKEN_AFTER_WITHDRAWAL'
    ).to.be.equal(ctxtBeforeWithdrawal.underlyingBalanceStaticAToken.toString());
    expect(
      ctxtAfterWithdrawal.aTokenBalanceUser.toString(),
      'INVALID_ATOKEN_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(
      ctxtBeforeWithdrawal.aTokenBalanceUser
        .plus(userInterestAccruedWithdrawal)
        .plus(amountToWithdraw.toString())
        .toString()
    );
  });

  it('Deposit using permit + metaDeposit()', async () => {
    const mockFactory = new StaticATokenMetaTransactionMockFactory(controlledPkSigner);
    const metaTransactionMock = await mockFactory.deploy();
    const chainId = DRE.network.config.chainId || 1;
    const userBalance = await aweth.balanceOf(controlledPkSigner.address);
    const amountToDeposit = new BigNumber(userBalance.div(2).toString());

    const ctxtParams: tContextParams = {
      staticAToken: <ERC20>staticAWeth,
      underlying: <ERC20>(<unknown>weth),
      aToken: <ERC20>aweth,
      user: controlledPkSigner.address,
      lendingPool,
    };

    const ctxtBeforeDeposit = await getContext(ctxtParams);

    const permitParams = buildPermitParams(
      1, // mainnet fork
      aweth.address,
      '1',
      await aweth.name(),
      controlledPkSigner.address,
      staticAWeth.address,
      (await aweth._nonces(controlledPkSigner.address)).toNumber(),
      MAX_UINT_AMOUNT,
      userBalance.div(2).toString()
    );
    const depositParams = buildMetaDepositParams(
      1, // mainnet fork
      staticAWeth.address,
      '1',
      await staticAWeth.name(),
      controlledPkSigner.address,
      controlledPkSigner.address,
      (await staticAWeth._nonces(controlledPkSigner.address)).toNumber(),
      MAX_UINT_AMOUNT,
      false,
      0,
      userBalance.div(2).toString()
    );

    const ownerPrivateKey = require('../../test-wallets.js').accounts[0].secretKey;
    if (!ownerPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }
    expect(
      (await aweth.allowance(controlledPkSigner.address, metaTransactionMock.address)).toString()
    ).to.be.equal('0', 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    const { v: permitV, r: permitR, s: permitS } = getSignatureFromTypedData(
      ownerPrivateKey,
      permitParams
    );
    const { v: depositV, r: depositR, s: depositS } = getSignatureFromTypedData(
      ownerPrivateKey,
      depositParams
    );
    await metaTransactionMock.permitAndDeposit(
      staticAWeth.address,
      controlledPkSigner.address,
      userBalance.div(2),
      0,
      false,
      MAX_UINT_AMOUNT,
      {
        v: permitV,
        r: permitR,
        s: permitS,
      },
      {
        v: depositV,
        r: depositR,
        s: depositS,
      },
      1
    );
    const ctxtAfterDeposit = await getContext(ctxtParams);
    const interestAccrued = getInterestAccrued(ctxtBeforeDeposit, ctxtAfterDeposit);
    const userInterestAccrued = getUserInterestAccrued(ctxtBeforeDeposit, ctxtAfterDeposit);
    expect(ctxtAfterDeposit.aTokenBalanceStaticAToken.toString()).to.be.equal(
      ctxtBeforeDeposit.aTokenBalanceStaticAToken
        .plus(new BigNumber(amountToDeposit.toString()))
        .plus(interestAccrued)
        .minus(1)
        .toString()
    );
    expect(ctxtAfterDeposit.underlyingBalanceUser.toString()).to.be.equal(
      ctxtBeforeDeposit.underlyingBalanceUser.toString()
    );
    expect(ctxtAfterDeposit.userDynamicStaticATokenBalance.toString()).to.be.equal(
      ctxtBeforeDeposit.userDynamicStaticATokenBalance
        .plus(new BigNumber(amountToDeposit.toString()))
        .toString()
    );
    expect(ctxtAfterDeposit.underlyingBalanceStaticAToken.toString()).to.be.equal(
      ctxtBeforeDeposit.underlyingBalanceStaticAToken.toString()
    );
    expect(ctxtAfterDeposit.aTokenBalanceUser.toString()).to.be.equal(
      ctxtBeforeDeposit.aTokenBalanceUser
        .plus(userInterestAccrued)
        .minus(amountToDeposit)
        .toString()
    );
  });

  it('Withdraw using metaWithdraw()', async () => {
    const ctxtParams: tContextParams = {
      staticAToken: <ERC20>staticAWeth,
      underlying: <ERC20>(<unknown>weth),
      aToken: <ERC20>aweth,
      user: controlledPkSigner.address,
      lendingPool,
    };
    const ctxtBeforeWithdrawal = await getContext(ctxtParams);
    const amountToWithdraw = parseEther('0.1');

    const withdrawParams = buildMetaWithdrawParams(
      1, // mainnet fork
      staticAWeth.address,
      '1',
      await staticAWeth.name(),
      controlledPkSigner.address,
      controlledPkSigner.address,
      (await staticAWeth._nonces(controlledPkSigner.address)).toNumber(),
      MAX_UINT_AMOUNT,
      false,
      '0',
      amountToWithdraw.toString()
    );
    const ownerPrivateKey = require('../../test-wallets.js').accounts[0].secretKey;
    if (!ownerPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }
    const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, withdrawParams);

    await waitForTx(
      await staticAWeth.metaWithdraw(
        controlledPkSigner.address,
        controlledPkSigner.address,
        0,
        amountToWithdraw,
        false,
        MAX_UINT_AMOUNT,
        {
          v,
          r,
          s,
        },
        '1'
      )
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);
    const interestAccruedWithdrawal = getInterestAccrued(ctxtBeforeWithdrawal, ctxtAfterWithdrawal);
    const userInterestAccruedWithdrawal = getUserInterestAccrued(
      ctxtBeforeWithdrawal,
      ctxtAfterWithdrawal
    );
    expect(
      ctxtAfterWithdrawal.aTokenBalanceStaticAToken.toString(),
      'INVALID_ATOKEN_BALANCE_ON_STATICATOKEN_AFTER_WITHDRAW'
    ).to.be.equal(
      ctxtBeforeWithdrawal.aTokenBalanceStaticAToken
        .minus(amountToWithdraw.toString())
        .plus(interestAccruedWithdrawal)
        .toString()
    );
    expect(
      ctxtAfterWithdrawal.underlyingBalanceUser.toString(),
      'INVALID_UNDERLYING_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(ctxtBeforeWithdrawal.underlyingBalanceUser.toString());
    expect(
      ctxtAfterWithdrawal.userStaticATokenBalance.toString(),
      'INVALID_STATICATOKEN_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(
      ctxtBeforeWithdrawal.userStaticATokenBalance
        .minus(rayDiv(amountToWithdraw.toString(), ctxtAfterWithdrawal.currentRate))
        .toString()
    );
    expect(
      ctxtAfterWithdrawal.underlyingBalanceStaticAToken.toString(),
      'INVALID_UNDERLYNG_BALANCE_OF_STATICATOKEN_AFTER_WITHDRAWAL'
    ).to.be.equal(ctxtBeforeWithdrawal.underlyingBalanceStaticAToken.toString());
    expect(
      ctxtAfterWithdrawal.aTokenBalanceUser.toString(),
      'INVALID_ATOKEN_BALANCE_OF_USER_AFTER_WITHDRAWAL'
    ).to.be.equal(
      ctxtBeforeWithdrawal.aTokenBalanceUser
        .plus(userInterestAccruedWithdrawal)
        .plus(amountToWithdraw.toString())
        .toString()
    );
  });
});
