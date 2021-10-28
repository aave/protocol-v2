import rawDRE, { ethers } from 'hardhat';
import bnjs from 'bignumber.js';
import { solidity } from 'ethereum-waffle';
import {
  LendingPoolFactory,
  ATokenFactory,
  ERC20,
  LendingPool,
  StaticATokenLMFactory,
  ERC20Factory,
  AToken,
  StaticATokenLM,
  InitializableAdminUpgradeabilityProxyFactory,
} from '../../../../types';
import { IAaveIncentivesControllerFactory } from '../../../../types/IAaveIncentivesControllerFactory';
import {
  impersonateAccountsHardhat,
  DRE,
  waitForTx,
  evmRevert,
  evmSnapshot,
} from '../../../../helpers/misc-utils';
import { BigNumber, providers, utils } from 'ethers';
import { rayDiv, rayMul } from '../../../../helpers/ray-math';
import { MAX_UINT_AMOUNT, ZERO_ADDRESS } from '../../../../helpers/constants';
import { tEthereumAddress } from '../../../../helpers/types';

import { parseEther, _TypedDataEncoder } from 'ethers/lib/utils';
import {
  buildMetaDepositParams,
  buildMetaWithdrawParams,
  buildPermitParams,
  getSignatureFromTypedData,
} from '../../../../helpers/contracts-helpers';
import { IAaveIncentivesController } from '../../../../types/IAaveIncentivesController';
import { deploySelfdestructTransferMock } from '../../../../helpers/contracts-deployments';
import { zeroAddress } from 'ethereumjs-util';

const { expect, use } = require('chai');

use(solidity);

const DEFAULT_GAS_LIMIT = 10000000;
const DEFAULT_GAS_PRICE = utils.parseUnits('100', 'gwei');

const defaultTxParams = { gasLimit: DEFAULT_GAS_LIMIT, gasPrice: DEFAULT_GAS_PRICE };

const LENDING_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

const STKAAVE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';
const AENJ = '0xaC6Df26a590F08dcC95D5a4705ae8abbc88509Ef';
const ENJ = '0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c';
const ENJ_WHALE = '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8';

const INCENTIVES_CONTROLLER = '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5';
const EMISSION_MANAGER = '0xEE56e2B3D491590B5b31738cC34d5232F378a8D5';

const LM_ERRORS = {
  INVALID_OWNER: '1',
  INVALID_EXPIRATION: '2',
  INVALID_SIGNATURE: '3',
  INVALID_DEPOSITOR: '4',
  INVALID_RECIPIENT: '5',
  INVALID_CLAIMER: '6',
  ONLY_ONE_AMOUNT_FORMAT_ALLOWED: '7',
  ONLY_PROXY_MAY_CALL: '8',
};

type tBalancesInvolved = {
  staticATokenATokenBalance: BigNumber;
  staticATokenStkAaveBalance: BigNumber;
  staticATokenUnderlyingBalance: BigNumber;
  staticATokenScaledBalanceAToken: BigNumber;
  staticATokenTotalClaimableRewards: BigNumber;
  userStkAaveBalance: BigNumber;
  userATokenBalance: BigNumber;
  userScaledBalanceAToken: BigNumber;
  userUnderlyingBalance: BigNumber;
  userStaticATokenBalance: BigNumber;
  userDynamicStaticATokenBalance: BigNumber;
  userPendingRewards: BigNumber;
  user2StkAaveBalance: BigNumber;
  user2ATokenBalance: BigNumber;
  user2ScaledBalanceAToken: BigNumber;
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
  staticATokenScaledBalanceAToken: await aToken.scaledBalanceOf(staticAToken.address),
  staticATokenTotalClaimableRewards: await staticAToken.getTotalClaimableRewards(),
  userStaticATokenBalance: await staticAToken.balanceOf(user),
  userStkAaveBalance: await stkAave.balanceOf(user),
  userATokenBalance: await aToken.balanceOf(user),
  userScaledBalanceAToken: await aToken.scaledBalanceOf(user),
  userUnderlyingBalance: await underlying.balanceOf(user),
  userDynamicStaticATokenBalance: await staticAToken.dynamicBalanceOf(user),
  userPendingRewards: await staticAToken.getClaimableRewards(user),
  user2StkAaveBalance: await stkAave.balanceOf(user2),
  user2ATokenBalance: await aToken.balanceOf(user2),
  user2ScaledBalanceAToken: await aToken.scaledBalanceOf(user2),
  user2UnderlyingBalance: await underlying.balanceOf(user2),
  user2StaticATokenBalance: await staticAToken.balanceOf(user2),
  user2DynamicStaticATokenBalance: await staticAToken.dynamicBalanceOf(user2),
  user2PendingRewards: await staticAToken.getClaimableRewards(user2),
  currentRate: await lendingPool.getReserveNormalizedIncome(underlying.address),
  staticATokenSupply: await staticAToken.totalSupply(),
});

describe('StaticATokenLM: aToken wrapper with static balances and NO liquidity mining', () => {
  let userSigner: providers.JsonRpcSigner;
  let user2Signer: providers.JsonRpcSigner;
  let lendingPool: LendingPool;
  let incentives: IAaveIncentivesController;
  let enj: ERC20;
  let aenj: AToken;
  let stkAave: ERC20;

  let enjWhale: providers.JsonRpcSigner;

  let staticATokenImplementation: StaticATokenLM;
  let staticAToken: StaticATokenLM;

  let snap: string;

  let ctxtParams: tContextParams;

  before(async () => {
    await rawDRE.run('set-DRE');

    const [user1, user2] = await DRE.ethers.getSigners();
    userSigner = DRE.ethers.provider.getSigner(await user1.getAddress());
    user2Signer = DRE.ethers.provider.getSigner(await user2.getAddress());
    enjWhale = DRE.ethers.provider.getSigner(ENJ_WHALE);
    lendingPool = LendingPoolFactory.connect(LENDING_POOL, userSigner);
    incentives = IAaveIncentivesControllerFactory.connect(INCENTIVES_CONTROLLER, userSigner);

    enj = ERC20Factory.connect(ENJ, userSigner);
    aenj = ATokenFactory.connect(AENJ, userSigner);
    stkAave = ERC20Factory.connect(STKAAVE, userSigner);

    staticATokenImplementation = await new StaticATokenLMFactory(userSigner).deploy();
    await staticATokenImplementation.initialize(LENDING_POOL, AENJ, 'Wrapped aENJ', 'waaenj');

    const proxy = await new InitializableAdminUpgradeabilityProxyFactory(userSigner).deploy();
    const encodedInitializedParams = staticATokenImplementation.interface.encodeFunctionData(
      'initialize',
      [LENDING_POOL, AENJ, 'Wrapped aENJ', 'waaenj']
    );

    await proxy['initialize(address,address,bytes)'](
      staticATokenImplementation.address,
      zeroAddress(),
      encodedInitializedParams
    );

    staticAToken = StaticATokenLMFactory.connect(proxy.address, userSigner);

    expect(await staticATokenImplementation.isImplementation()).to.be.eq(true);
    expect(await staticAToken.isImplementation()).to.be.eq(false);

    expect(await staticAToken.getIncentivesController()).to.be.eq(zeroAddress());
    expect(await staticAToken.ASSET()).to.be.eq(await staticAToken.UNDERLYING_ASSET_ADDRESS());

    ctxtParams = {
      staticAToken: <StaticATokenLM>staticAToken,
      underlying: <ERC20>(<unknown>enj),
      aToken: <ERC20>aenj,
      stkAave: <ERC20>stkAave,
      user: userSigner._address,
      user2: user2Signer._address,
      lendingPool,
    };

    await impersonateAccountsHardhat([ENJ_WHALE]);
    const balanceWhale = await enj.balanceOf(ENJ_WHALE);
    await waitForTx(await enj.connect(enjWhale).transfer(userSigner._address, balanceWhale));

    snap = await evmSnapshot();
  });

  beforeEach(async () => {
    await evmRevert(snap);
    snap = await evmSnapshot();
  });

  after(async () => {
    await evmRevert(snap);
  });

  it('Deposit ENJ directly to implementation (expect revert)', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT;

    // Just preparation
    await waitForTx(
      await enj.approve(staticATokenImplementation.address, amountToDeposit, defaultTxParams)
    );

    // Depositing
    await expect(
      staticATokenImplementation.deposit(
        userSigner._address,
        amountToDeposit,
        0,
        true,
        defaultTxParams
      )
    ).to.be.revertedWith(LM_ERRORS.ONLY_PROXY_MAY_CALL);
  });

  it('Deposit ENJ on waaenj, then withdraw of the whole balance in underlying', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT;

    // Just preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    const ctxtInitial = await getContext(ctxtParams);

    await expect(
      staticAToken.deposit(ZERO_ADDRESS, amountToDeposit, 0, true, defaultTxParams)
    ).to.be.revertedWith(LM_ERRORS.INVALID_RECIPIENT);

    // Depositing
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);

    await expect(
      staticAToken.withdraw(ZERO_ADDRESS, amountToWithdraw, true, defaultTxParams)
    ).to.be.revertedWith(LM_ERRORS.INVALID_RECIPIENT);

    // Withdrawing all
    await waitForTx(
      await staticAToken.withdraw(userSigner._address, amountToWithdraw, true, defaultTxParams)
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);

    // Claiming the rewards
    await waitForTx(
      await staticAToken.connect(userSigner).claimRewards(userSigner._address, false)
    );

    const ctxtAfterClaimNoForce = await getContext(ctxtParams);

    await waitForTx(await staticAToken.connect(userSigner).claimRewards(userSigner._address, true));

    const ctxtAfterClaimForce = await getContext(ctxtParams);

    // Check that scaledAToken balance is equal to the static aToken supply at every stage.
    expect(ctxtInitial.staticATokenScaledBalanceAToken).to.be.eq(ctxtInitial.staticATokenSupply);
    expect(ctxtAfterDeposit.staticATokenScaledBalanceAToken).to.be.eq(
      ctxtAfterDeposit.staticATokenSupply
    );
    expect(ctxtAfterWithdrawal.staticATokenScaledBalanceAToken).to.be.eq(
      ctxtAfterWithdrawal.staticATokenSupply
    );
    expect(ctxtAfterClaimNoForce.staticATokenScaledBalanceAToken).to.be.eq(
      ctxtAfterClaimNoForce.staticATokenSupply
    );

    expect(ctxtAfterDeposit.staticATokenATokenBalance).to.be.eq(
      ctxtInitial.staticATokenATokenBalance.add(amountToDeposit)
    );
    expect(ctxtAfterDeposit.userUnderlyingBalance).to.be.eq(
      ctxtInitial.userUnderlyingBalance.sub(amountToDeposit)
    );
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

    expect(ctxtAfterWithdrawal.userStaticATokenBalance).to.be.eq(0);
    expect(ctxtAfterWithdrawal.staticATokenATokenBalance).to.be.eq(0);
    expect(ctxtAfterWithdrawal.staticATokenSupply).to.be.eq(0);
    expect(ctxtAfterWithdrawal.staticATokenUnderlyingBalance).to.be.eq(0);
    expect(ctxtAfterWithdrawal.staticATokenStkAaveBalance).to.be.eq(0);

    expect(ctxtAfterWithdrawal.staticATokenTotalClaimableRewards).to.be.eq(0);
    expect(ctxtAfterWithdrawal.userPendingRewards).to.be.eq(0);
    expect(ctxtAfterWithdrawal.userStkAaveBalance).to.be.eq(0);

    expect(ctxtAfterClaimNoForce.userStkAaveBalance).to.be.eq(0);
    expect(ctxtAfterClaimNoForce.staticATokenStkAaveBalance).to.be.eq(0);

    expect(ctxtAfterClaimForce.userStkAaveBalance).to.be.eq(0);
    expect(ctxtAfterClaimNoForce.userPendingRewards).to.be.eq(0);

    expect(ctxtAfterClaimForce.staticATokenStkAaveBalance).to.be.eq(0);
    expect(ctxtAfterClaimNoForce.staticATokenTotalClaimableRewards).to.be.eq(0);
  });

  it('Deposit ENJ on waaenj and then withdraw some balance in underlying', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = utils.parseEther('2.5');

    // Preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    const ctxtInitial = await getContext(ctxtParams);

    // Deposit
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);

    const expectedATokenWithdraw = await staticAToken.staticToDynamicAmount(amountToWithdraw);

    // Withdraw
    await waitForTx(
      await staticAToken.withdraw(userSigner._address, amountToWithdraw, true, defaultTxParams)
    );
    const ctxtAfterWithdrawal = await getContext(ctxtParams);

    // Claim
    await waitForTx(
      await staticAToken.connect(userSigner).claimRewards(userSigner._address, false)
    );
    const ctxtAfterClaim = await getContext(ctxtParams);

    await waitForTx(await staticAToken.collectAndUpdateRewards());
    const ctxtAfterUpdate = await getContext(ctxtParams);

    await waitForTx(
      await staticAToken.connect(userSigner).claimRewards(userSigner._address, false)
    );
    const ctxtAfterClaim2 = await getContext(ctxtParams);

    expect(ctxtInitial.userStaticATokenBalance).to.be.eq(0);
    expect(ctxtInitial.staticATokenSupply).to.be.eq(0);
    expect(ctxtInitial.staticATokenUnderlyingBalance).to.be.eq(0);
    expect(ctxtAfterDeposit.userDynamicStaticATokenBalance).to.be.eq(
      ctxtAfterDeposit.staticATokenATokenBalance
    );
    expect(ctxtAfterDeposit.userStaticATokenBalance).to.be.eq(ctxtAfterDeposit.staticATokenSupply);
    expect(ctxtAfterDeposit.staticATokenATokenBalance).to.be.eq(
      ctxtAfterDeposit.userDynamicStaticATokenBalance
    );
    expect(ctxtAfterDeposit.staticATokenATokenBalance).to.be.eq(amountToDeposit);

    expect(ctxtAfterWithdrawal.userDynamicStaticATokenBalance).to.be.eq(
      BigNumber.from(
        rayMul(
          new bnjs(ctxtAfterDeposit.userStaticATokenBalance.sub(amountToWithdraw).toString()),
          new bnjs(ctxtAfterWithdrawal.currentRate.toString())
        ).toString()
      )
    );
    expect(ctxtAfterWithdrawal.userStaticATokenBalance).to.be.eq(
      ctxtAfterDeposit.userStaticATokenBalance.sub(amountToWithdraw)
    );

    expect(ctxtAfterUpdate.userStkAaveBalance).to.be.eq(0);
    expect(ctxtAfterUpdate.userPendingRewards).to.be.eq(0);
    expect(ctxtAfterClaim2.userStkAaveBalance).to.be.eq(0);
    expect(ctxtAfterClaim2.userPendingRewards).to.be.eq(0);

    // Check that rewards are always covered
    expect(ctxtInitial.staticATokenTotalClaimableRewards).to.be.eq(0);
    expect(ctxtInitial.userPendingRewards).to.be.eq(0);
    expect(ctxtAfterDeposit.staticATokenTotalClaimableRewards).to.be.eq(0);
    expect(ctxtAfterDeposit.userPendingRewards).to.be.eq(0);
    expect(ctxtAfterWithdrawal.staticATokenTotalClaimableRewards).to.be.eq(0);
    expect(ctxtAfterWithdrawal.userPendingRewards).to.be.eq(0);
    expect(ctxtAfterClaim.staticATokenTotalClaimableRewards).to.be.eq(0);
    expect(ctxtAfterClaim.userPendingRewards).to.be.eq(0);
    expect(ctxtAfterUpdate.staticATokenTotalClaimableRewards).to.be.eq(0);
    expect(ctxtAfterUpdate.userPendingRewards).to.be.eq(0);

    expect(ctxtAfterClaim2.staticATokenTotalClaimableRewards).to.be.eq(0);
    expect(ctxtAfterClaim2.userPendingRewards).to.be.eq(0);
    // TODO: Look back
  });

  it('Deposit ENJ on waaenj and then withdraw all the balance in aToken', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT;

    // Preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

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

    expect(ctxtInitial.staticATokenSupply).to.be.eq(0);
    expect(ctxtInitial.userATokenBalance).to.be.eq(0);
    expect(ctxtAfterDeposit.staticATokenATokenBalance).to.be.eq(
      ctxtAfterDeposit.userDynamicStaticATokenBalance
    );
    expect(ctxtAfterDeposit.userStaticATokenBalance).to.be.eq(ctxtAfterDeposit.staticATokenSupply);
    expect(ctxtAfterDeposit.userDynamicStaticATokenBalance).to.be.eq(amountToDeposit);
    expect(ctxtAfterWithdrawal.userATokenBalance).to.be.eq(
      rayMul(
        ctxtAfterDeposit.userStaticATokenBalance.toString(),
        ctxtAfterWithdrawal.currentRate.toString()
      ).toString()
    );
    expect(ctxtAfterWithdrawal.userStaticATokenBalance).to.be.eq(0);
  });

  it('Deposit aENJ on waaenj and then withdraw some balance in aToken', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = utils.parseEther('2.5');

    // Preparation
    await waitForTx(await enj.approve(lendingPool.address, amountToDeposit, defaultTxParams));
    await waitForTx(
      await lendingPool.deposit(
        enj.address,
        amountToDeposit,
        userSigner._address,
        0,
        defaultTxParams
      )
    );
    const ctxtInitial = await getContext(ctxtParams);
    await waitForTx(await aenj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

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

    expect(ctxtInitial.userStaticATokenBalance).to.be.eq(0);
    expect(ctxtInitial.userATokenBalance).to.eq(amountToDeposit);
    expect(ctxtInitial.staticATokenSupply).to.be.eq(0);
    expect(ctxtInitial.staticATokenUnderlyingBalance).to.be.eq(0);

    expect(ctxtAfterDeposit.userDynamicStaticATokenBalance).to.be.eq(
      ctxtAfterDeposit.staticATokenATokenBalance
    );
    expect(ctxtAfterDeposit.userStaticATokenBalance).to.be.eq(ctxtAfterDeposit.staticATokenSupply);
    expect(ctxtAfterDeposit.staticATokenATokenBalance).to.be.eq(amountToDeposit);

    expect(ctxtAfterWithdrawal.userStaticATokenBalance).to.be.eq(
      ctxtAfterDeposit.userStaticATokenBalance.sub(amountToWithdraw)
    );

    expect(ctxtAfterWithdrawal.userDynamicStaticATokenBalance).to.be.eq(
      BigNumber.from(
        rayMul(
          new bnjs(ctxtAfterDeposit.userStaticATokenBalance.sub(amountToWithdraw).toString()),
          new bnjs(ctxtAfterWithdrawal.currentRate.toString())
        ).toString()
      )
    );

    expect(ctxtAfterWithdrawal.userATokenBalance).to.be.eq(
      BigNumber.from(
        rayMul(
          new bnjs(ctxtAfterDeposit.userScaledBalanceAToken.add(amountToWithdraw).toString()),
          new bnjs(ctxtAfterWithdrawal.currentRate.toString())
        ).toString()
      )
    );
  });

  it('Transfer with permit()', async () => {
    const amountToDeposit = utils.parseEther('5');

    // Just preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    // Depositing
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ctxtBeforeTransfer = await getContext(ctxtParams);

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
        .permit(spender._address, spender._address, permitAmount, expiration, v, r, s)
    ).to.be.revertedWith(LM_ERRORS.INVALID_SIGNATURE);

    await waitForTx(
      await staticAToken
        .connect(spender)
        .permit(owner._address, spender._address, permitAmount, expiration, v, r, s)
    );

    expect((await staticAToken.allowance(owner._address, spender._address)).toString()).to.be.equal(
      permitAmount,
      'INVALID_ALLOWANCE_AFTER_PERMIT'
    );

    await waitForTx(
      await staticAToken
        .connect(spender)
        .transferFrom(owner._address, spender._address, permitAmount)
    );

    const ctxtAfterTransfer = await getContext(ctxtParams);

    expect(ctxtAfterTransfer.user2StaticATokenBalance).to.be.eq(
      ctxtBeforeTransfer.user2StaticATokenBalance.add(permitAmount)
    );
    expect(ctxtAfterTransfer.userStaticATokenBalance).to.be.eq(
      ctxtBeforeTransfer.userStaticATokenBalance.sub(permitAmount)
    );
  });

  it('Transfer with permit() (expect fail)', async () => {
    const amountToDeposit = utils.parseEther('5');

    // Just preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

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
        .permit(ZERO_ADDRESS, spender._address, permitAmount, expiration, v, r, s)
    ).to.be.revertedWith(LM_ERRORS.INVALID_OWNER);

    await expect(
      staticAToken
        .connect(spender)
        .permit(owner._address, spender._address, permitAmount, expiration, v, r, s)
    ).to.be.revertedWith(LM_ERRORS.INVALID_EXPIRATION);

    expect((await staticAToken.allowance(owner._address, spender._address)).toString()).to.be.equal(
      '0',
      'INVALID_ALLOWANCE_AFTER_PERMIT'
    );
  });

  it('Deposit using metaDeposit()', async () => {
    const amountToDeposit = utils.parseEther('5');
    const chainId = DRE.network.config.chainId ? DRE.network.config.chainId : 1;

    const domain = {
      name: await staticAToken.name(),
      version: '1',
      chainId: chainId,
      verifyingContract: staticAToken.address,
    };
    const domainSeperator = _TypedDataEncoder.hashDomain(domain);
    const seperator = await staticAToken.getDomainSeparator();
    expect(seperator).to.be.eq(domainSeperator);

    const userPrivateKey = require('../../../../test-wallets.js').accounts[0].secretKey;
    if (!userPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    // Preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    const tokenName = await staticAToken.name();
    const nonce = (await staticAToken._nonces(userSigner._address)).toNumber();
    const value = amountToDeposit.toString();
    const referralCode = 0;
    const depositor = userSigner._address;
    const recipient = userSigner._address;
    const fromUnderlying = true;
    const deadline = MAX_UINT_AMOUNT;

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
          sigParams
        )
    ).to.be.revertedWith(LM_ERRORS.INVALID_DEPOSITOR);

    await expect(
      staticAToken
        .connect(user2Signer)
        .metaDeposit(depositor, recipient, value, referralCode, fromUnderlying, 0, sigParams)
    ).to.be.revertedWith(LM_ERRORS.INVALID_EXPIRATION);

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
          sigParams
        )
    ).to.be.revertedWith(LM_ERRORS.INVALID_SIGNATURE);

    // Deposit
    await waitForTx(
      await staticAToken
        .connect(user2Signer)
        .metaDeposit(depositor, recipient, value, referralCode, fromUnderlying, deadline, sigParams)
    );

    const ctxtAfterDeposit = await getContext(ctxtParams);

    expect(ctxtInitial.userStaticATokenBalance).to.be.eq(0);
    expect(ctxtAfterDeposit.userStaticATokenBalance).to.be.eq(
      BigNumber.from(rayDiv(value.toString(), ctxtAfterDeposit.currentRate.toString()).toString())
    );
    expect(ctxtAfterDeposit.userDynamicStaticATokenBalance).to.be.eq(value);
  });

  it('Withdraw using withdrawDynamicAmount()', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = utils.parseEther('1');

    // Preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    // Deposit
    await waitForTx(
      await staticAToken.deposit(userSigner._address, amountToDeposit, 0, true, defaultTxParams)
    );

    const ctxtBeforeWithdrawal = await getContext(ctxtParams);

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

    expect(ctxtBeforeWithdrawal.userATokenBalance).to.be.eq(0);
    expect(ctxtBeforeWithdrawal.staticATokenATokenBalance).to.be.closeTo(amountToDeposit, 2);
    expect(ctxtAfterWithdrawal.userATokenBalance).to.be.closeTo(amountToWithdraw, 2);
    expect(ctxtAfterWithdrawal.userDynamicStaticATokenBalance).to.be.closeTo(
      BigNumber.from(
        rayMul(
          new bnjs(ctxtBeforeWithdrawal.userStaticATokenBalance.toString()),
          new bnjs(ctxtAfterWithdrawal.currentRate.toString())
        ).toString()
      ).sub(amountToWithdraw),
      2
    );

    expect(ctxtAfterWithdrawal.userStkAaveBalance).to.be.eq(0);
  });

  it('Withdraw using metaWithdraw()', async () => {
    const amountToDeposit = utils.parseEther('5');
    const chainId = DRE.network.config.chainId ? DRE.network.config.chainId : 1;

    const domain = {
      name: await staticAToken.name(),
      version: '1',
      chainId: chainId,
      verifyingContract: staticAToken.address,
    };
    const domainSeperator = _TypedDataEncoder.hashDomain(domain);
    const seperator = await staticAToken.getDomainSeparator();
    expect(seperator).to.be.eq(domainSeperator);

    const userPrivateKey = require('../../../../test-wallets.js').accounts[0].secretKey;
    if (!userPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    // Preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

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
          sigParams
        )
    ).to.be.revertedWith(LM_ERRORS.INVALID_OWNER);

    await expect(
      staticAToken
        .connect(user2Signer)
        .metaWithdraw(owner, recipient, staticAmount, dynamicAmount, toUnderlying, 0, sigParams)
    ).to.be.revertedWith(LM_ERRORS.INVALID_EXPIRATION);

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
          sigParams
        )
    ).to.be.revertedWith(LM_ERRORS.INVALID_SIGNATURE);

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
          sigParams
        )
    );

    const ctxtAfterWithdrawal = await getContext(ctxtParams);

    expect(ctxtInitial.userDynamicStaticATokenBalance).to.be.eq(amountToDeposit);
    expect(ctxtAfterWithdrawal.userStaticATokenBalance).to.be.eq(0);
    expect(ctxtAfterWithdrawal.userDynamicStaticATokenBalance).to.be.eq(0);
  });

  it('Withdraw using metaWithdraw() (expect to fail)', async () => {
    const amountToDeposit = utils.parseEther('5');
    const chainId = DRE.network.config.chainId ? DRE.network.config.chainId : 1;

    const domain = {
      name: await staticAToken.name(),
      version: '1',
      chainId: chainId,
      verifyingContract: staticAToken.address,
    };
    const domainSeperator = _TypedDataEncoder.hashDomain(domain);
    const seperator = await staticAToken.getDomainSeparator();
    expect(seperator).to.be.eq(domainSeperator);

    const userPrivateKey = require('../../../../test-wallets.js').accounts[0].secretKey;
    if (!userPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    // Preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

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
    const deadline = MAX_UINT_AMOUNT;

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
          sigParams
        )
    ).to.be.revertedWith(LM_ERRORS.ONLY_ONE_AMOUNT_FORMAT_ALLOWED);

    const ctxtAfterDeposit = await getContext(ctxtParams);
    expect(ctxtInitial.userStaticATokenBalance).to.be.eq(ctxtAfterDeposit.userStaticATokenBalance);
  });

  it('Deposit ENJ on waaenj, then transfer and withdraw of the whole balance in underlying, finally claim', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT;

    // Preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

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
    await waitForTx(
      await staticAToken.connect(user2Signer).claimRewards(user2Signer._address, true)
    );
    const ctxtAfterClaim = await getContext(ctxtParams);

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
    expect(ctxtAfterWithdrawal.staticATokenTotalClaimableRewards).to.be.eq(0);
    expect(ctxtAfterWithdrawal.user2PendingRewards).to.be.eq(0);
    expect(ctxtAfterClaim.userStkAaveBalance).to.be.eq(0);
    expect(ctxtAfterClaim.user2StkAaveBalance).to.be.eq(0);
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.eq(
      ctxtAfterWithdrawal.staticATokenTotalClaimableRewards
    );
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.eq(0);
  });

  it('Deposit ENJ on waaenj, then transfer and withdraw of the whole balance in underlying, finally claimToSelf', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT;

    // Preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

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
    await waitForTx(await staticAToken.connect(user2Signer).claimRewardsToSelf(true));
    const ctxtAfterClaim = await getContext(ctxtParams);

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
    expect(ctxtAfterWithdrawal.staticATokenTotalClaimableRewards).to.be.eq(0);
    expect(ctxtAfterWithdrawal.user2PendingRewards).to.be.eq(0);

    expect(ctxtAfterClaim.userStkAaveBalance).to.be.eq(0);
    expect(ctxtAfterClaim.user2StkAaveBalance).to.be.eq(0);
    expect(ctxtAfterWithdrawal.user2PendingRewards).to.be.eq(0);
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.eq(
      ctxtAfterWithdrawal.staticATokenTotalClaimableRewards
    );
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.eq(0);
  });

  it('Deposit ENJ on waaenj, then transfer and withdraw of the whole balance in underlying, finally someone claims on behalf', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT;

    const [, , claimer] = await DRE.ethers.getSigners();
    const claimerSigner = DRE.ethers.provider.getSigner(await claimer.getAddress());

    await impersonateAccountsHardhat([EMISSION_MANAGER]);
    const emissionManager = DRE.ethers.provider.getSigner(EMISSION_MANAGER);

    // Fund emissionManager
    const selfdestructContract = await deploySelfdestructTransferMock();
    // Selfdestruct the mock, pointing to WETHGateway address
    await selfdestructContract
      .connect(user2Signer)
      .destroyAndTransfer(emissionManager._address, { value: parseEther('1') });

    // Preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

    const ctxtInitial = await getContext(ctxtParams);

    // Allow another use to claim on behalf of
    await waitForTx(
      await incentives
        .connect(emissionManager)
        .setClaimer(user2Signer._address, claimerSigner._address)
    );

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
    await waitForTx(
      await staticAToken
        .connect(claimerSigner)
        .claimRewardsOnBehalf(user2Signer._address, user2Signer._address, true)
    );

    const ctxtAfterClaim = await getContext(ctxtParams);

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
    expect(ctxtAfterWithdrawal.staticATokenTotalClaimableRewards).to.be.eq(0);
    expect(ctxtAfterWithdrawal.user2PendingRewards).to.be.eq(0);

    expect(ctxtAfterClaim.userStkAaveBalance).to.be.eq(0);
    expect(ctxtAfterClaim.user2StkAaveBalance).to.be.eq(0);
    expect(ctxtAfterWithdrawal.user2PendingRewards).to.be.eq(0);
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.eq(
      ctxtAfterWithdrawal.staticATokenTotalClaimableRewards
    );
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.eq(0);
  });

  it('Deposit ENJ on waaenj, then transfer and withdraw of the whole balance in underlying, finally someone NOT set as claimer claims on behalf', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT;

    const [, , claimer] = await DRE.ethers.getSigners();
    const claimerSigner = DRE.ethers.provider.getSigner(await claimer.getAddress());

    await impersonateAccountsHardhat([EMISSION_MANAGER]);
    const emissionManager = DRE.ethers.provider.getSigner(EMISSION_MANAGER);

    // Fund emissionManager
    const selfdestructContract = await deploySelfdestructTransferMock();
    // Selfdestruct the mock, pointing to WETHGateway address
    await selfdestructContract
      .connect(user2Signer)
      .destroyAndTransfer(emissionManager._address, { value: parseEther('1') });

    // Preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

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
    await waitForTx(
      await staticAToken
        .connect(claimerSigner)
        .claimRewardsOnBehalf(user2Signer._address, user2Signer._address, true)
    );

    const ctxtAfterClaim = await getContext(ctxtParams);

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
    expect(ctxtAfterWithdrawal.staticATokenTotalClaimableRewards).to.be.eq(0);
    expect(ctxtAfterWithdrawal.user2PendingRewards).to.be.eq(0);

    expect(ctxtAfterClaim.userStkAaveBalance).to.be.eq(0);
    expect(ctxtAfterClaim.user2StkAaveBalance).to.be.eq(0);
    expect(ctxtAfterWithdrawal.user2PendingRewards).to.be.eq(0);
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.eq(
      ctxtAfterWithdrawal.staticATokenTotalClaimableRewards
    );
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.eq(0);
  });

  it('Deposit ENJ on waaenj, then transfer and withdraw of the whole balance in underlying, finally claims on behalf of self', async () => {
    const amountToDeposit = utils.parseEther('5');
    const amountToWithdraw = MAX_UINT_AMOUNT;

    // Preparation
    await waitForTx(await enj.approve(staticAToken.address, amountToDeposit, defaultTxParams));

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
    await waitForTx(
      await staticAToken
        .connect(user2Signer)
        .claimRewardsOnBehalf(user2Signer._address, user2Signer._address, true)
    );
    const ctxtAfterClaim = await getContext(ctxtParams);

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
    expect(ctxtAfterWithdrawal.staticATokenTotalClaimableRewards).to.be.eq(0);
    expect(ctxtAfterWithdrawal.user2PendingRewards).to.be.eq(0);
    expect(ctxtAfterClaim.userStkAaveBalance).to.be.eq(0);
    expect(ctxtAfterClaim.user2StkAaveBalance).to.be.eq(0);
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.eq(
      ctxtAfterWithdrawal.staticATokenTotalClaimableRewards
    );
    expect(ctxtAfterClaim.staticATokenStkAaveBalance).to.be.eq(0);
  });
});
