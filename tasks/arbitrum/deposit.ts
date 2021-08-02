import { getArtifactFromContractOutput } from '@nomiclabs/buidler/internal/artifacts';
import { formatEther, formatUnits, parseUnits } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { deployAllMockTokens } from '../../helpers/contracts-deployments';
import {
  getAToken,
  getFirstSigner,
  getIErc20Detailed,
  getLendingPool,
  getMockedTokens,
  getStableDebtToken,
  getVariableDebtToken,
  getWETHGateway,
} from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { eEthereumNetwork } from '../../helpers/types';
import { LendingPool } from '../../types';

task('arbitrum:deposit:usdt', 'Deposit usdt into the arbitrum market').setAction(
  async ({}, localBRE) => {
    await localBRE.run('set-DRE');

    const signer = await getFirstSigner();
    const signerAddress = await signer.getAddress();
    const ethBalance = await signer.getBalance();

    console.log(`Using: ${signerAddress} with ${formatEther(ethBalance)} eth`);

    const lendingPool = await getLendingPool();

    // Need to look up the USDT balance and such
    const config = loadPoolConfig(ConfigNames.Arbitrum);
    const tokens = await getMockedTokens(config);

    // USDT
    const usdt = tokens['USDT'];
    const depositAmount = parseUnits('1', 6);
    await usdt.connect(signer).mint(depositAmount);
    await usdt.connect(signer).approve(lendingPool.address, depositAmount);
    const depositTx = await lendingPool
      .connect(signer)
      .deposit(usdt.address, depositAmount, signerAddress, 0);
    console.log(`Deposit tx: ${depositTx.hash}`);
  }
);

task('arbitrum:deposit:wbtc', 'Deposit WBTC into the arbitrum market').setAction(
  async ({}, localBRE) => {
    await localBRE.run('set-DRE');

    const signer = await getFirstSigner();
    const signerAddress = await signer.getAddress();
    const ethBalance = await signer.getBalance();

    console.log(`Using: ${signerAddress} with ${formatEther(ethBalance)} eth`);

    const lendingPool = await getLendingPool();

    // Need to look up the wbtc balance and such
    const config = loadPoolConfig(ConfigNames.Arbitrum);
    const tokens = await getMockedTokens(config);

    // WBTC
    const wbtc = tokens['WBTC'];
    const depositAmount = parseUnits('5', 8);

    const expectedGas = await wbtc.connect(signer).estimateGas.mint(depositAmount);
    console.log(`Expected gas: ${expectedGas}, ${localBRE.network.config.gas}`);
    const mintTx = await wbtc.connect(signer).mint(depositAmount);

    console.log(`Minted tokens: ${mintTx.hash}`);
    await wbtc.connect(signer).approve(lendingPool.address, depositAmount);
    const depositTx = await lendingPool
      .connect(signer)
      .deposit(wbtc.address, depositAmount, signerAddress, 0);
    console.log(`Deposit tx: ${depositTx.hash}`);
  }
);

task('arbitrum:deposit:eth', 'Deposit eth into the arbitrum market').setAction(
  async ({}, localBRE) => {
    await localBRE.run('set-DRE');

    const signer = await getFirstSigner();
    const signerAddress = await signer.getAddress();
    const ethBalance = await signer.getBalance();

    console.log(`Using: ${signerAddress} with ${formatEther(ethBalance)} eth`);

    const lendingPool = await getLendingPool();

    const gateway = await getWETHGateway();
    const depositAmount = parseUnits('0.1', 18);
    const depositTx = await gateway
      .connect(signer)
      .depositETH(lendingPool.address, signerAddress, 0, { value: depositAmount });
    console.log(`Deposit tx: ${depositTx.hash}`);
  }
);
