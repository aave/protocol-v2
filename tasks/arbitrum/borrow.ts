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
} from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { eEthereumNetwork } from '../../helpers/types';
import { LendingPool } from '../../types';

task('arbitrum:borrow:wbtc', 'Borrow WBTC from the arbtirum market').setAction(
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
    const borrowAmount = parseUnits('2.5', 8);
    const borrowTx = await lendingPool
      .connect(signer)
      .borrow(wbtc.address, borrowAmount, 2, 0, signerAddress);
    console.log(`Borrow tx: ${borrowTx.hash}`);
  }
);
