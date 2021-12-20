import BigNumber from 'bignumber.js';

import { TestEnv, makeSuite } from './helpers/make-suite';
import { MAX_UINT_AMOUNT, ZERO_ADDRESS } from '../helpers/constants';
import { buildPermitParams, getSignatureFromTypedData } from '../helpers/contracts-helpers';
import { ethers } from 'ethers';
import { AStETH } from '../types/AStETH';
import { getAStETH } from '../helpers/contracts-getters';
import { expect } from 'chai';
import { ProtocolErrors } from '../helpers/types';
import { BUIDLEREVM_CHAINID } from '../helpers/buidler-constants';
import { DRE } from '../helpers/misc-utils';
import { waitForTx, evmSnapshot, evmRevert } from '../helpers/misc-utils';
import { _TypedDataEncoder } from 'ethers/lib/utils';

const { parseEther } = ethers.utils;

let reserveData, astETH: AStETH, evmSnapshotId;

makeSuite('StETH aToken', (testEnv: TestEnv) => {
  before(async () => {
    evmSnapshotId = await evmSnapshot();
    const { stETH, pool } = testEnv;
    reserveData = await pool.getReserveData(stETH.address);
    astETH = await getAStETH(reserveData.aTokenAddress);
  });

  after(async () => {
    await evmRevert(evmSnapshotId);
  });

  describe('Modifiers', () => {
    const { CT_CALLER_MUST_BE_LENDING_POOL } = ProtocolErrors;

    it('Tries to invoke mint not being the LendingPool', async () => {
      const { deployer } = testEnv;
      await expect(astETH.mint(deployer.address, '1', '1')).to.be.revertedWith(
        CT_CALLER_MUST_BE_LENDING_POOL
      );
    });

    it('Tries to invoke burn not being the LendingPool', async () => {
      const { deployer } = testEnv;
      await expect(astETH.burn(deployer.address, deployer.address, '1', '1')).to.be.revertedWith(
        CT_CALLER_MUST_BE_LENDING_POOL
      );
    });

    it('Tries to invoke transferOnLiquidation not being the LendingPool', async () => {
      const { deployer, users } = testEnv;
      await expect(
        astETH.transferOnLiquidation(deployer.address, users[0].address, '1')
      ).to.be.revertedWith(CT_CALLER_MUST_BE_LENDING_POOL);
    });

    it('Tries to invoke transferUnderlyingTo not being the LendingPool', async () => {
      const { deployer } = testEnv;
      await expect(astETH.transferUnderlyingTo(deployer.address, '1')).to.be.revertedWith(
        CT_CALLER_MUST_BE_LENDING_POOL
      );
    });
  });
  describe('Permit', () => {
    it('Checks the domain separator', async () => {
      const separator = await astETH.DOMAIN_SEPARATOR();

      const domain = {
        name: await astETH.name(),
        version: '1',
        chainId: DRE.network.config.chainId,
        verifyingContract: astETH.address,
      };
      const domainSeparator = _TypedDataEncoder.hashDomain(domain);

      expect(separator).to.be.equal(domainSeparator, 'Invalid domain separator');
    });

    it('Reverts submitting a permit with 0 expiration', async () => {
      const { deployer, users } = testEnv;
      const owner = deployer;
      const spender = users[1];

      const tokenName = await astETH.name();

      const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
      const expiration = 0;
      const nonce = (await astETH._nonces(owner.address)).toNumber();
      const permitAmount = parseEther('2').toString();
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

      const ownerPrivateKey = require('../test-wallets.js').accounts[0].secretKey;
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
      const { deployer, users } = testEnv;
      const owner = deployer;
      const spender = users[1];

      const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
      const deadline = MAX_UINT_AMOUNT;
      const nonce = (await astETH._nonces(owner.address)).toNumber();
      const permitAmount = parseEther('2').toString();
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

      const ownerPrivateKey = require('../test-wallets.js').accounts[0].secretKey;
      if (!ownerPrivateKey) {
        throw new Error('INVALID_OWNER_PK');
      }

      expect((await astETH.allowance(owner.address, spender.address)).toString()).to.be.equal(
        '0',
        'INVALID_ALLOWANCE_BEFORE_PERMIT'
      );

      const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

      await waitForTx(
        await astETH
          .connect(spender.signer)
          .permit(owner.address, spender.address, permitAmount, deadline, v, r, s)
      );

      expect((await astETH._nonces(owner.address)).toNumber()).to.be.equal(1);
    });

    it('Cancels the previous permit', async () => {
      const { deployer, users } = testEnv;
      const owner = deployer;
      const spender = users[1];

      const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
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

      const ownerPrivateKey = require('../test-wallets.js').accounts[0].secretKey;
      if (!ownerPrivateKey) {
        throw new Error('INVALID_OWNER_PK');
      }

      const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

      expect((await astETH.allowance(owner.address, spender.address)).toString()).to.be.equal(
        ethers.utils.parseEther('2'),
        'INVALID_ALLOWANCE_BEFORE_PERMIT'
      );
      expect((await astETH._nonces(owner.address)).toNumber()).to.be.equal(1);
    });

    it('Tries to submit a permit with invalid nonce', async () => {
      const { deployer, users } = testEnv;
      const owner = deployer;
      const spender = users[1];

      const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
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

      const ownerPrivateKey = require('../test-wallets.js').accounts[0].secretKey;
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
      const { deployer, users } = testEnv;
      const owner = deployer;
      const spender = users[1];

      const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
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

      const ownerPrivateKey = require('../test-wallets.js').accounts[0].secretKey;
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
      const { deployer, users } = testEnv;
      const owner = deployer;
      const spender = users[1];

      const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
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

      const ownerPrivateKey = require('../test-wallets.js').accounts[0].secretKey;
      if (!ownerPrivateKey) {
        throw new Error('INVALID_OWNER_PK');
      }

      const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

      await expect(
        astETH
          .connect(spender.signer)
          .permit(owner.address, ZERO_ADDRESS, permitAmount, deadline, v, r, s)
      ).to.be.revertedWith('INVALID_SIGNATURE');
    });

    it('Tries to submit a permit with invalid owner', async () => {
      const { deployer, users } = testEnv;
      const owner = deployer;
      const spender = users[1];

      const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
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

      const ownerPrivateKey = require('../test-wallets.js').accounts[0].secretKey;
      if (!ownerPrivateKey) {
        throw new Error('INVALID_OWNER_PK');
      }

      const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

      await expect(
        astETH
          .connect(spender.signer)
          .permit(ZERO_ADDRESS, spender.address, expiration, permitAmount, v, r, s)
      ).to.be.revertedWith('INVALID_OWNER');
    });
  });
});
