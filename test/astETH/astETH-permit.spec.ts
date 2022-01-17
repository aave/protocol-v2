import { _TypedDataEncoder } from '@ethersproject/hash';
import { expect } from 'chai';
import { zeroAddress } from 'ethereumjs-util';
import { MAX_UINT_AMOUNT } from '../../helpers/constants';
import { buildPermitParams, getSignatureFromTypedData } from '../../helpers/contracts-helpers';
import { wei } from './helpers';
import { setup } from './__setup.spec';
const chainId = 31337;

describe('AStETH Permit', () => {
  it('Checks the domain separator', async () => {
    const { astETH } = setup;
    const separator = await astETH.DOMAIN_SEPARATOR();

    const domain = {
      name: await astETH.name(),
      version: '1',
      chainId: chainId,
      verifyingContract: astETH.address,
    };
    const domainSeparator = _TypedDataEncoder.hashDomain(domain);

    expect(separator).to.be.equal(domainSeparator, 'Invalid domain separator');
  });

  it('Reverts submitting a permit with 0 expiration', async () => {
    const { astETH, deployer: owner, lenders } = setup;
    const { lenderA: spender } = lenders;

    const tokenName = await astETH.name();

    const expiration = 0;
    const nonce = (await astETH._nonces(owner.address)).toNumber();
    const permitAmount = wei(2);
    const msgParams = buildPermitParams(
      chainId,
      astETH.address,
      '1',
      tokenName,
      owner.address,
      spender.address,
      nonce,
      permitAmount,
      expiration.toFixed()
    );

    const ownerPrivateKey = require('../../test-wallets.js').accounts[0].secretKey;
    if (!ownerPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    expect((await astETH.allowance(owner.address, spender.address)).toString()).to.be.equal(
      '0',
      'INVALID_ALLOWANCE_BEFORE_PERMIT'
    );

    const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

    await expect(
      astETH
        .connect(spender.signer)
        .permit(owner.address, spender.address, permitAmount, expiration, v, r, s)
    ).to.be.revertedWith('INVALID_EXPIRATION');

    expect((await astETH.allowance(owner.address, spender.address)).toString()).to.be.equal(
      '0',
      'INVALID_ALLOWANCE_AFTER_PERMIT'
    );
  });

  it('Submits a permit with maximum expiration length', async () => {
    const { astETH, deployer: owner, lenders } = setup;
    const spender = lenders.lenderA;

    const deadline = MAX_UINT_AMOUNT;
    const nonce = (await astETH._nonces(owner.address)).toNumber();
    const permitAmount = wei(2);
    const msgParams = buildPermitParams(
      chainId,
      astETH.address,
      '1',
      await astETH.name(),
      owner.address,
      spender.address,
      nonce,
      deadline,
      permitAmount
    );

    const ownerPrivateKey = require('../../test-wallets.js').accounts[0].secretKey;
    if (!ownerPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    expect((await astETH.allowance(owner.address, spender.address)).toString()).to.be.equal(
      '0',
      'INVALID_ALLOWANCE_BEFORE_PERMIT'
    );

    const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

    const tx = await astETH
      .connect(spender.signer)
      .permit(owner.address, spender.address, permitAmount, deadline, v, r, s);
    await tx.wait();

    expect((await astETH._nonces(owner.address)).toNumber()).to.be.equal(1);
  });

  it('Cancels the previous permit', async () => {
    const { astETH, deployer: owner, lenders } = setup;
    const spender = lenders.lenderA;

    const deadline = MAX_UINT_AMOUNT;
    const nonce = (await astETH._nonces(owner.address)).toNumber();
    const permitAmount = '0';
    const msgParams = buildPermitParams(
      chainId,
      astETH.address,
      '1',
      await astETH.name(),
      owner.address,
      spender.address,
      nonce,
      deadline,
      permitAmount
    );

    const ownerPrivateKey = require('../../test-wallets.js').accounts[0].secretKey;
    if (!ownerPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

    const tx = await astETH
      .connect(spender.signer)
      .permit(owner.address, spender.address, permitAmount, deadline, v, r, s);
    await tx.wait();

    expect((await astETH.allowance(owner.address, spender.address)).toString()).to.be.equal(
      permitAmount,
      'INVALID_ALLOWANCE_BEFORE_PERMIT'
    );
    expect((await astETH._nonces(owner.address)).toNumber()).to.be.equal(1);
  });

  it('Tries to submit a permit with invalid nonce', async () => {
    const { astETH, deployer: owner, lenders } = setup;
    const spender = lenders.lenderA;

    const deadline = MAX_UINT_AMOUNT;
    const nonce = 1000;
    const permitAmount = '0';
    const msgParams = buildPermitParams(
      chainId,
      astETH.address,
      '1',
      await astETH.name(),
      owner.address,
      spender.address,
      nonce,
      deadline,
      permitAmount
    );

    const ownerPrivateKey = require('../../test-wallets.js').accounts[0].secretKey;
    if (!ownerPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

    await expect(
      astETH
        .connect(spender.signer)
        .permit(owner.address, spender.address, permitAmount, deadline, v, r, s)
    ).to.be.revertedWith('INVALID_SIGNATURE');
  });

  it('Tries to submit a permit with invalid expiration (previous to the current block)', async () => {
    const { astETH, deployer: owner, lenders } = setup;
    const spender = lenders.lenderA;

    const expiration = '1';
    const nonce = (await astETH._nonces(owner.address)).toNumber();
    const permitAmount = '0';
    const msgParams = buildPermitParams(
      chainId,
      astETH.address,
      '1',
      await astETH.name(),
      owner.address,
      spender.address,
      nonce,
      expiration,
      permitAmount
    );

    const ownerPrivateKey = require('../../test-wallets.js').accounts[0].secretKey;
    if (!ownerPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

    await expect(
      astETH
        .connect(spender.signer)
        .permit(owner.address, spender.address, expiration, permitAmount, v, r, s)
    ).to.be.revertedWith('INVALID_EXPIRATION');
  });

  it('Tries to submit a permit with invalid signature', async () => {
    const { astETH, deployer: owner, lenders } = setup;
    const spender = lenders.lenderA;

    const deadline = MAX_UINT_AMOUNT;
    const nonce = (await astETH._nonces(owner.address)).toNumber();
    const permitAmount = '0';
    const msgParams = buildPermitParams(
      chainId,
      astETH.address,
      '1',
      await astETH.name(),
      owner.address,
      spender.address,
      nonce,
      deadline,
      permitAmount
    );

    const ownerPrivateKey = require('../../test-wallets.js').accounts[0].secretKey;
    if (!ownerPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

    await expect(
      astETH
        .connect(spender.signer)
        .permit(owner.address, zeroAddress(), permitAmount, deadline, v, r, s)
    ).to.be.revertedWith('INVALID_SIGNATURE');
  });

  it('Tries to submit a permit with invalid owner', async () => {
    const { astETH, deployer: owner, lenders } = setup;
    const spender = lenders.lenderA;

    const expiration = MAX_UINT_AMOUNT;
    const nonce = (await astETH._nonces(owner.address)).toNumber();
    const permitAmount = '0';
    const msgParams = buildPermitParams(
      chainId,
      astETH.address,
      '1',
      await astETH.name(),
      owner.address,
      spender.address,
      nonce,
      expiration,
      permitAmount
    );

    const ownerPrivateKey = require('../../test-wallets.js').accounts[0].secretKey;
    if (!ownerPrivateKey) {
      throw new Error('INVALID_OWNER_PK');
    }

    const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

    await expect(
      astETH
        .connect(spender.signer)
        .permit(zeroAddress(), spender.address, expiration, permitAmount, v, r, s)
    ).to.be.revertedWith('INVALID_OWNER');
  });
});
