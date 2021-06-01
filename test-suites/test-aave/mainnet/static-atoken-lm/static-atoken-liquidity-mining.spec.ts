import rawDRE, { ethers } from 'hardhat';
import bnjs from 'bignumber.js';
import { solidity } from 'ethereum-waffle';
import {
  LendingPoolFactory,
  WETH9Factory,
  StaticATokenFactory,
  ATokenFactory,
  ERC20,
  LendingPool,
  StaticATokenLMFactory,
  ERC20Factory,
  WETH9,
  AToken,
  StaticAToken,
  StaticATokenLM,
} from '../../../../types';
import {
  impersonateAccountsHardhat,
  DRE,
  waitForTx,
  evmRevert,
  evmSnapshot,
  timeLatest,
  advanceTimeAndBlock,
} from '../../../../helpers/misc-utils';
import { BigNumber, providers, Signer, utils } from 'ethers';
import { rayMul } from '../../../../helpers/ray-math';
import { MAX_UINT_AMOUNT, ZERO_ADDRESS } from '../../../../helpers/constants';
import { tEthereumAddress } from '../../../../helpers/types';
import { AbiCoder, formatEther, verifyTypedData } from 'ethers/lib/utils';
import { stat } from 'fs';

import { _TypedDataEncoder } from 'ethers/lib/utils';
import {
  buildMetaDepositParams,
  buildMetaWithdrawParams,
  buildPermitParams,
  getSignatureFromTypedData,
} from '../../../../helpers/contracts-helpers';
import { TypedDataUtils, typedSignatureHash, TYPED_MESSAGE_SCHEMA } from 'eth-sig-util';
import { zeroAddress } from 'ethereumjs-util';

const { expect, use } = require('chai');

use(solidity);

const DEFAULT_GAS_LIMIT = 10000000;
const DEFAULT_GAS_PRICE = utils.parseUnits('100', 'gwei');

const defaultTxParams = { gasLimit: DEFAULT_GAS_LIMIT, gasPrice: DEFAULT_GAS_PRICE };

const ETHER_BANK = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const LENDING_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const STKAAVE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';
const AWETH = '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e';

const TEST_USERS = [
  '0x0F4ee9631f4be0a63756515141281A3E2B293Bbe',
  '0x8BffC896D42F07776561A5814D6E4240950d6D3a',
];

type tBalancesInvolved = {
  staticATokenATokenBalance: BigNumber;
  staticATokenStkAaveBalance: BigNumber;
  staticATokenUnderlyingBalance: BigNumber;
  userStkAaveBalance: BigNumber;
  userATokenBalance: BigNumber;
  userUnderlyingBalance: BigNumber;
  userStaticATokenBalance: BigNumber;
  userDynamicStaticATokenBalance: BigNumber;
  userPendingRewards: BigNumber;
  user2StkAaveBalance: BigNumber;
  user2ATokenBalance: BigNumber;
  user2UnderlyingBalance: BigNumber;
  user2StaticATokenBalance: BigNumber;
  user2DynamicStaticATokenBalance: BigNumber;
  user2PendingRewards: BigNumber;
  currentRate: BigNumber;
  staticATokenSupply: BigNumber;
};

type tContextParams = {
  staticAToken: StaticATokenLM;
  underlying: ERC20;
  aToken: ERC20;
  stkAave: ERC20;
  user: tEthereumAddress;
  user2: tEthereumAddress;
  lendingPool: LendingPool;
};

const getContext = async ({
  staticAToken,
  underlying,
  aToken,
  stkAave,
  user,
  user2,
  lendingPool,
}: tContextParams): Promise<tBalancesInvolved> => ({
  staticATokenATokenBalance: await aToken.balanceOf(staticAToken.address),
  staticATokenStkAaveBalance: await stkAave.balanceOf(staticAToken.address),
  staticATokenUnderlyingBalance: await underlying.balanceOf(staticAToken.address),
  userStaticATokenBalance: await staticAToken.balanceOf(user),
  userStkAaveBalance: await stkAave.balanceOf(user),
  userATokenBalance: await aToken.balanceOf(user),
  userUnderlyingBalance: await underlying.balanceOf(user),
  userDynamicStaticATokenBalance: await staticAToken.dynamicBalanceOf(user),
  userPendingRewards: await staticAToken.getClaimableRewards(user),
  user2StkAaveBalance: await stkAave.balanceOf(user2),
  user2ATokenBalance: await aToken.balanceOf(user2),
  user2UnderlyingBalance: await underlying.balanceOf(user2),
  user2StaticATokenBalance: await staticAToken.balanceOf(user2),
  user2DynamicStaticATokenBalance: await staticAToken.dynamicBalanceOf(user2),
  user2PendingRewards: await staticAToken.getClaimableRewards(user2),
  currentRate: await lendingPool.getReserveNormalizedIncome(WETH),
  staticATokenSupply: await staticAToken.totalSupply(),
});

describe('StaticATokenLM: aToken wrapper with static balances and liquidity mining', () => {
  let userSigner: providers.JsonRpcSigner;
  let user2Signer: providers.JsonRpcSigner;
  let lendingPool: LendingPool;
  let weth: WETH9;
  let aweth: AToken;
  let stkAave: ERC20;

  let staticAToken: StaticATokenLM;

  let snap: string;

  let ctxtParams: tContextParams;

  before(async () => {
    await rawDRE.run('set-DRE');

    const [user1, user2] = await DRE.ethers.getSigners();
    userSigner = DRE.ethers.provider.getSigner(await user1.getAddress());
    user2Signer = DRE.ethers.provider.getSigner(await user2.getAddress());
    lendingPool = LendingPoolFactory.connect(LENDING_POOL, userSigner);

    weth = WETH9Factory.connect(WETH, userSigner);
    aweth = ATokenFactory.connect(AWETH, userSigner);
    stkAave = ERC20Factory.connect(STKAAVE, userSigner);

    staticAToken = await new StaticATokenLMFactory(userSigner).deploy(
      LENDING_POOL,
      AWETH,
      'Static Aave Interest Bearing WETH',
      'stataAAVE'
    );

    ctxtParams = {
      staticAToken: <StaticATokenLM>staticAToken,
      underlying: <ERC20>(<unknown>weth),
      aToken: <ERC20>aweth,
      stkAave: <ERC20>stkAave,
      user: userSigner._address,
      user2: user2Signer._address,
      lendingPool,
    };

    snap = await evmSnapshot();
  });

  beforeEach(async () => {
    await evmRevert(snap);
    snap = await evmSnapshot();
  });

  after(async () => {
    await evmRevert(snap);
  });

  it('Deposit WETH on stataWETH, then withdraw of the whole balance in underlying', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT; // Still need to figure out why this works :eyes:

    // Just preparation
    await waitForTx(await weth.deposit({ value: amountToDeposit }));
    await waitForTx(await weth.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    const ctxtInitial = await getContext(ctxtParams);

    await expect(
      staticAToken.deposit(ZERO_ADDRESS, amountToDeposit, 0, true, defaultTxParams)
    ).to.be.revertedWith('INVALID_RECIPIENT');

    // Depositing
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);

    /*    console.log(
      `ScaledBalanceOf ${formatEther(
        await aweth.scaledBalanceOf(staticAToken.address)
      )}... Static supply: ${formatEther(await staticAToken.totalSupply())}... ${formatEther(
        await staticAToken.balanceOf(userSigner._address)
      )} `
    );*/

    await expect(
      staticAToken.withdraw(ZERO_ADDRESS, amountToWithdraw, true, defaultTxParams)
    ).to.be.revertedWith('INVALID_RECIPIENT');

    // Withdrawing all
    await waitForTx(
      await staticAToken.withdraw(userSigner._address, amountToWithdraw, true, defaultTxParams)
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);

    // Claiming the rewards
    await waitForTx(await staticAToken.claimRewards(userSigner._address));

    const ctxtAfterClaim = await getContext(ctxtParams);

    // Check values throughout

    // Check that aWETH balance of staticAToken contract is increased as expected
    expect(ctxtAfterDeposit.staticATokenATokenBalance).to.be.eq(
      ctxtInitial.staticATokenATokenBalance.add(amountToDeposit)
    );

    // Check user WETH balance of user is decreased as expected
    expect(ctxtAfterDeposit.userUnderlyingBalance).to.be.eq(
      ctxtInitial.userUnderlyingBalance.sub(amountToDeposit)
    );
    /*console.log(
      `Deposit amount ${formatEther(amountToDeposit)}. Dynamic balance: ${formatEther(
        ctxtAfterDeposit.userDynamicStaticATokenBalance
      )}. aWEth bal: ${formatEther(ctxtAfterDeposit.staticATokenATokenBalance)}`
    );*/
    expect(ctxtAfterDeposit.userDynamicStaticATokenBalance).to.be.eq(
      ctxtInitial.userDynamicStaticATokenBalance.add(amountToDeposit)
    );
    expect(ctxtAfterDeposit.userDynamicStaticATokenBalance).to.be.eq(
      ctxtAfterDeposit.staticATokenATokenBalance
    );
    expect(ctxtAfterDeposit.staticATokenUnderlyingBalance).to.be.eq(
      ctxtInitial.staticATokenUnderlyingBalance
    );
    expect(ctxtAfterDeposit.userATokenBalance).to.be.eq(ctxtInitial.userATokenBalance);
    expect(ctxtAfterDeposit.userStkAaveBalance).to.be.eq(0);
    expect(ctxtAfterDeposit.staticATokenStkAaveBalance).to.be.eq(0);

    expect(
      ctxtAfterWithdrawal.staticATokenATokenBalance,
      'INVALID_ATOKEN_BALANCE_ON_STATICATOKEN_AFTER_WITHDRAW'
    ).to.be.eq(
      BigNumber.from(
        rayMul(
          new bnjs(
            ctxtAfterWithdrawal.staticATokenSupply
              .add(ctxtAfterDeposit.userStaticATokenBalance)
              .toString()
          ),
          new bnjs(ctxtAfterWithdrawal.currentRate.toString())
        )
          .minus(
            rayMul(
              new bnjs(ctxtAfterDeposit.userStaticATokenBalance.toString()),
              new bnjs(ctxtAfterWithdrawal.currentRate.toString())
            )
          )
          .toString()
      )
    );

    expect(ctxtAfterWithdrawal.userStaticATokenBalance).to.be.eq(0);
    expect(ctxtAfterWithdrawal.staticATokenSupply).to.be.eq(0);
    expect(ctxtAfterWithdrawal.staticATokenUnderlyingBalance).to.be.eq(0);

    // Check with possible rounding error. Sometimes we have an issue with it being 0 lower as well.
    expect(ctxtAfterWithdrawal.staticATokenStkAaveBalance).to.be.gte(
      ctxtAfterWithdrawal.userPendingRewards
    );
    expect(ctxtAfterWithdrawal.staticATokenStkAaveBalance).to.be.lte(
      ctxtAfterWithdrawal.userPendingRewards.add(1)
    );
    expect(ctxtAfterWithdrawal.userStkAaveBalance).to.be.eq(0);

    expect(ctxtAfterClaim.userStkAaveBalance).to.be.eq(ctxtAfterWithdrawal.userPendingRewards);
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.lte(1);
  });

  it('Deposit WETH on stataWETH and then withdraw some balance in underlying', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = utils.parseEther('2.5');

    // Preparation
    await waitForTx(await weth.deposit({ value: amountToDeposit }));
    await waitForTx(await weth.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    const ctxtInitial = await getContext(ctxtParams);

    // Deposit
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);

    // Withdraw
    await waitForTx(
      await staticAToken.withdraw(userSigner._address, amountToWithdraw, true, defaultTxParams)
    );
    const ctxtAfterWithdrawal = await getContext(ctxtParams);

    // Claim
    await waitForTx(await staticAToken.claimRewards(userSigner._address));
    const ctxtAfterClaim = await getContext(ctxtParams);
  });

  it('Deposit WETH on stataWETH and then withdraw all the balance in aToken', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT; // Still need to figure out why this works :eyes:

    // Preparation
    await waitForTx(await weth.deposit({ value: amountToDeposit }));
    await waitForTx(await weth.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    const ctxtInitial = await getContext(ctxtParams);

    // Deposit
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);

    // Withdraw
    await waitForTx(
      await staticAToken.withdraw(userSigner._address, amountToWithdraw, false, defaultTxParams)
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);

    // Claim
    await waitForTx(await staticAToken.claimRewards(userSigner._address));
    const ctxtAfterClaim = await getContext(ctxtParams);
  });

  it('Deposit aWETH on stataWETH and then withdraw some balance in aToken', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = utils.parseEther('2.5');

    // Preparation
    await waitForTx(await weth.deposit({ value: amountToDeposit }));
    await waitForTx(await weth.approve(lendingPool.address, amountToDeposit, defaultTxParams));
    await waitForTx(
      await lendingPool.deposit(
        weth.address,
        amountToDeposit,
        userSigner._address,
        0,
        defaultTxParams
      )
    );
    await waitForTx(await aweth.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    const ctxtInitial = await getContext(ctxtParams);

    // Deposit
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, false, defaultTxParams)
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);

    // Withdraw
    await waitForTx(
      await staticAToken.withdraw(userSigner._address, amountToWithdraw, false, defaultTxParams)
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);

    // Claim
    await waitForTx(await staticAToken.claimRewards(userSigner._address));
    const ctxtAfterClaim = await getContext(ctxtParams);
  });

  it('Transfer with permit() (expect fail)', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT; // Still need to figure out why this works :eyes:

    // Just preparation
    await waitForTx(await weth.deposit({ value: amountToDeposit }));
    await waitForTx(await weth.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    // Depositing
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ownerPrivateKey = require('../../../../test-wallets.js').accounts[0].secretKey;
    if (!ownerPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    const owner = userSigner;
    const spender = user2Signer;

    const tokenName = await staticAToken.name();

    const chainId = DRE.network.config.chainId || 1;
    const expiration = 0;
    const nonce = (await staticAToken._nonces(owner._address)).toNumber();
    const permitAmount = ethers.utils.parseEther('2').toString();
    const msgParams = buildPermitParams(
      chainId,
      staticAToken.address,
      '1',
      tokenName,
      owner._address,
      spender._address,
      nonce,
      expiration.toFixed(),
      permitAmount
    );

    expect((await staticAToken.allowance(owner._address, spender._address)).toString()).to.be.equal(
      '0',
      'INVALID_ALLOWANCE_BEFORE_PERMIT'
    );

    const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

    await expect(
      staticAToken
        .connect(spender)
        .permit(ZERO_ADDRESS, spender._address, permitAmount, expiration, v, r, s, chainId)
    ).to.be.revertedWith('INVALID_OWNER');

    await expect(
      staticAToken
        .connect(spender)
        .permit(owner._address, spender._address, permitAmount, expiration, v, r, s, chainId)
    ).to.be.revertedWith('INVALID_EXPIRATION');

    expect((await staticAToken.allowance(owner._address, spender._address)).toString()).to.be.equal(
      '0',
      'INVALID_ALLOWANCE_AFTER_PERMIT'
    );
  });

  it('Transfer with permit()', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT; // Still need to figure out why this works :eyes:

    // Just preparation
    await waitForTx(await weth.deposit({ value: amountToDeposit }));
    await waitForTx(await weth.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    // Depositing
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ownerPrivateKey = require('../../../../test-wallets.js').accounts[0].secretKey;
    if (!ownerPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    const owner = userSigner;
    const spender = user2Signer;

    const tokenName = await staticAToken.name();

    const chainId = DRE.network.config.chainId || 1;
    const expiration = MAX_UINT_AMOUNT;
    const nonce = (await staticAToken._nonces(owner._address)).toNumber();
    const permitAmount = ethers.utils.parseEther('2').toString();
    const msgParams = buildPermitParams(
      chainId,
      staticAToken.address,
      '1',
      tokenName,
      owner._address,
      spender._address,
      nonce,
      expiration,
      permitAmount
    );

    expect((await staticAToken.allowance(owner._address, spender._address)).toString()).to.be.equal(
      '0',
      'INVALID_ALLOWANCE_BEFORE_PERMIT'
    );

    const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

    await expect(
      staticAToken
        .connect(spender)
        .permit(spender._address, spender._address, permitAmount, expiration, v, r, s, chainId)
    ).to.be.revertedWith('INVALID_SIGNATURE');

    await waitForTx(
      await staticAToken
        .connect(spender)
        .permit(owner._address, spender._address, permitAmount, expiration, v, r, s, chainId)
    );

    expect((await staticAToken.allowance(owner._address, spender._address)).toString()).to.be.equal(
      permitAmount,
      'INVALID_ALLOWANCE_AFTER_PERMIT'
    );
  });

  it('Deposit using metaDeposit()', async () => {
    // What is a metadeposit
    const amountToDeposit = utils.parseEther('5');
    const chainId = DRE.network.config.chainId ? DRE.network.config.chainId : 1;

    const domain = {
      name: await staticAToken.name(),
      version: '1',
      chainId: chainId,
      verifyingContract: staticAToken.address,
    };
    const domainSeperator = _TypedDataEncoder.hashDomain(domain);
    const seperator = await staticAToken.getDomainSeparator(chainId);
    expect(seperator).to.be.eq(domainSeperator);

    const userPrivateKey = require('../../../../test-wallets.js').accounts[0].secretKey;
    if (!userPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    // Preparation
    await waitForTx(await weth.deposit({ value: amountToDeposit }));
    await waitForTx(await weth.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    // Here it begins
    const tokenName = await staticAToken.name();
    const nonce = (await staticAToken._nonces(userSigner._address)).toNumber();
    const value = amountToDeposit.toString();
    const referralCode = 0;
    const depositor = userSigner._address;
    const recipient = userSigner._address;
    const fromUnderlying = true;
    const deadline = MAX_UINT_AMOUNT; // (await timeLatest()).plus(60 * 60).toFixed();

    const msgParams = buildMetaDepositParams(
      chainId,
      staticAToken.address,
      '1',
      tokenName,
      depositor,
      recipient,
      referralCode,
      fromUnderlying,
      nonce,
      deadline,
      value
    );

    const { v, r, s } = getSignatureFromTypedData(userPrivateKey, msgParams);

    const sigParams = {
      v,
      r,
      s,
    };

    const ctxtInitial = await getContext(ctxtParams);

    await expect(
      staticAToken
        .connect(user2Signer)
        .metaDeposit(
          ZERO_ADDRESS,
          recipient,
          value,
          referralCode,
          fromUnderlying,
          deadline,
          sigParams,
          chainId
        )
    ).to.be.revertedWith('INVALID_DEPOSITOR');

    await expect(
      staticAToken
        .connect(user2Signer)
        .metaDeposit(
          depositor,
          recipient,
          value,
          referralCode,
          fromUnderlying,
          0,
          sigParams,
          chainId
        )
    ).to.be.revertedWith('INVALID_EXPIRATION');

    await expect(
      staticAToken
        .connect(user2Signer)
        .metaDeposit(
          user2Signer._address,
          recipient,
          value,
          referralCode,
          fromUnderlying,
          deadline,
          sigParams,
          chainId
        )
    ).to.be.revertedWith('INVALID_SIGNATURE');

    // Deposit
    await waitForTx(
      await staticAToken
        .connect(user2Signer)
        .metaDeposit(
          depositor,
          recipient,
          value,
          referralCode,
          fromUnderlying,
          deadline,
          sigParams,
          chainId
        )
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);
  });

  it('Withdraw using withdrawDynamicAmount()', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = utils.parseEther('1');

    // Preparation
    await waitForTx(await weth.deposit({ value: amountToDeposit }));
    await waitForTx(await weth.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    const ctxtInitial = await getContext(ctxtParams);

    // Deposit
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);

    // Withdraw dynamic amount
    await waitForTx(
      await staticAToken.withdrawDynamicAmount(
        userSigner._address,
        amountToWithdraw,
        false,
        defaultTxParams
      )
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);

    // Claim
    await waitForTx(await staticAToken.claimRewards(userSigner._address));
    const ctxtAfterClaim = await getContext(ctxtParams);
  });

  it('Withdraw using metaWithdraw()', async () => {
    // What is a metadeposit
    const amountToDeposit = utils.parseEther('5');
    const chainId = DRE.network.config.chainId ? DRE.network.config.chainId : 1;

    const domain = {
      name: await staticAToken.name(),
      version: '1',
      chainId: chainId,
      verifyingContract: staticAToken.address,
    };
    const domainSeperator = _TypedDataEncoder.hashDomain(domain);
    const seperator = await staticAToken.getDomainSeparator(chainId);
    expect(seperator).to.be.eq(domainSeperator);

    const userPrivateKey = require('../../../../test-wallets.js').accounts[0].secretKey;
    if (!userPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    // Preparation
    await waitForTx(await weth.deposit({ value: amountToDeposit }));
    await waitForTx(await weth.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    // Deposit
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    // Meta withdraw
    const tokenName = await staticAToken.name();
    const nonce = (await staticAToken._nonces(userSigner._address)).toNumber();
    const owner = userSigner._address;
    const recipient = userSigner._address;
    const staticAmount = (await staticAToken.balanceOf(userSigner._address)).toString();
    const dynamicAmount = '0';
    const toUnderlying = true;
    const deadline = MAX_UINT_AMOUNT; // (await timeLatest()).plus(60 * 60).toFixed();

    const msgParams = buildMetaWithdrawParams(
      chainId,
      staticAToken.address,
      '1',
      tokenName,
      owner,
      recipient,
      staticAmount,
      dynamicAmount,
      toUnderlying,
      nonce,
      deadline
    );

    const { v, r, s } = getSignatureFromTypedData(userPrivateKey, msgParams);

    const sigParams = {
      v,
      r,
      s,
    };

    const ctxtInitial = await getContext(ctxtParams);

    await expect(
      staticAToken
        .connect(user2Signer)
        .metaWithdraw(
          ZERO_ADDRESS,
          recipient,
          staticAmount,
          dynamicAmount,
          toUnderlying,
          deadline,
          sigParams,
          chainId
        )
    ).to.be.revertedWith('INVALID_OWNER');

    await expect(
      staticAToken
        .connect(user2Signer)
        .metaWithdraw(
          owner,
          recipient,
          staticAmount,
          dynamicAmount,
          toUnderlying,
          0,
          sigParams,
          chainId
        )
    ).to.be.revertedWith('INVALID_EXPIRATION');

    await expect(
      staticAToken
        .connect(user2Signer)
        .metaWithdraw(
          user2Signer._address,
          recipient,
          staticAmount,
          dynamicAmount,
          toUnderlying,
          deadline,
          sigParams,
          chainId
        )
    ).to.be.revertedWith('INVALID_SIGNATURE');

    // Deposit
    await waitForTx(
      await staticAToken
        .connect(user2Signer)
        .metaWithdraw(
          owner,
          recipient,
          staticAmount,
          dynamicAmount,
          toUnderlying,
          deadline,
          sigParams,
          chainId
        )
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);
  });

  it('Withdraw using metaWithdraw() (expect to fail)', async () => {
    // What is a metadeposit
    const amountToDeposit = utils.parseEther('5');
    const chainId = DRE.network.config.chainId ? DRE.network.config.chainId : 1;

    const domain = {
      name: await staticAToken.name(),
      version: '1',
      chainId: chainId,
      verifyingContract: staticAToken.address,
    };
    const domainSeperator = _TypedDataEncoder.hashDomain(domain);
    const seperator = await staticAToken.getDomainSeparator(chainId);
    expect(seperator).to.be.eq(domainSeperator);

    const userPrivateKey = require('../../../../test-wallets.js').accounts[0].secretKey;
    if (!userPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    // Preparation
    await waitForTx(await weth.deposit({ value: amountToDeposit }));
    await waitForTx(await weth.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    // Deposit
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    // Meta withdraw
    const tokenName = await staticAToken.name();
    const nonce = (await staticAToken._nonces(userSigner._address)).toNumber();
    const owner = userSigner._address;
    const recipient = userSigner._address;
    const staticAmount = (await staticAToken.balanceOf(userSigner._address)).toString();
    const dynamicAmount = (
      await await staticAToken.dynamicBalanceOf(userSigner._address)
    ).toString();
    const toUnderlying = true;
    const deadline = MAX_UINT_AMOUNT; // (await timeLatest()).plus(60 * 60).toFixed();

    const msgParams = buildMetaWithdrawParams(
      chainId,
      staticAToken.address,
      '1',
      tokenName,
      owner,
      recipient,
      staticAmount,
      dynamicAmount,
      toUnderlying,
      nonce,
      deadline
    );

    const { v, r, s } = getSignatureFromTypedData(userPrivateKey, msgParams);

    const sigParams = {
      v,
      r,
      s,
    };

    const ctxtInitial = await getContext(ctxtParams);

    await expect(
      staticAToken
        .connect(user2Signer)
        .metaWithdraw(
          owner,
          recipient,
          staticAmount,
          dynamicAmount,
          toUnderlying,
          deadline,
          sigParams,
          chainId
        )
    ).to.be.revertedWith('ONLY_ONE_AMOUNT_FORMAT_ALLOWED');

    const ctxtAfterDeposit = await getContext(ctxtParams);
  });

  it('Deposit WETH on stataWETH, then transfer and withdraw of the whole balance in underlying, finally claim', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT; // Still need to figure out why this works :eyes:

    // Preparation
    await waitForTx(await weth.deposit({ value: amountToDeposit }));
    await waitForTx(await weth.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    const ctxtInitial = await getContext(ctxtParams);

    // Deposit
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);
    // Transfer staticATokens to other user
    await waitForTx(
      await staticAToken.transfer(user2Signer._address, ctxtAfterDeposit.userStaticATokenBalance)
    );

    const ctxtAfterTransfer = await getContext(ctxtParams);

    // Withdraw
    await waitForTx(
      await staticAToken
        .connect(user2Signer)
        .withdraw(user2Signer._address, amountToWithdraw, true, defaultTxParams)
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);

    // Claim
    await waitForTx(await staticAToken.claimRewards(user2Signer._address));
    const ctxtAfterClaim = await getContext(ctxtParams);

    // TODO: Need to do some checks with the transferred (fresh rewards) as well.
    // e.g., we need to show that the received is more than he have gained "by himself" in the same period.

    // Checks
    expect(ctxtAfterDeposit.staticATokenATokenBalance).to.be.eq(
      ctxtInitial.staticATokenATokenBalance.add(amountToDeposit)
    );
    expect(ctxtAfterDeposit.userUnderlyingBalance).to.be.eq(
      ctxtInitial.userUnderlyingBalance.sub(amountToDeposit)
    );
    expect(ctxtAfterTransfer.user2StaticATokenBalance).to.be.eq(
      ctxtAfterDeposit.userStaticATokenBalance
    );
    expect(ctxtAfterTransfer.userStaticATokenBalance).to.be.eq(0);
    expect(ctxtAfterTransfer.userPendingRewards).to.be.eq(0);
    expect(ctxtAfterTransfer.user2PendingRewards).to.be.eq(0);
    expect(ctxtAfterWithdrawal.staticATokenSupply).to.be.eq(0);
    expect(ctxtAfterWithdrawal.staticATokenATokenBalance).to.be.eq(0);
    expect(ctxtAfterWithdrawal.userPendingRewards).to.be.eq(0);
    expect(ctxtAfterWithdrawal.user2PendingRewards).to.be.lte(
      ctxtAfterWithdrawal.staticATokenStkAaveBalance
    );
    expect(ctxtAfterClaim.user2StkAaveBalance).to.be.eq(ctxtAfterWithdrawal.user2PendingRewards);
    expect(ctxtAfterClaim.userStkAaveBalance).to.be.eq(0);
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.eq(
      ctxtAfterWithdrawal.staticATokenStkAaveBalance.sub(ctxtAfterWithdrawal.user2PendingRewards)
    );
    // Expect dust to be left in the contract
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.lt(5);
  });
});
