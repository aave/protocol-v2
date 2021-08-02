import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { deployAllMockTokens, deployMockTokens } from '../../helpers/contracts-deployments';
import { getFirstSigner, getMockedTokens } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { eEthereumNetwork } from '../../helpers/types';

task('arbitrum:deploy-mock-tokens', 'Deploy mock tokens').setAction(async ({}, localBRE) => {
  await localBRE.run('set-DRE');
  const conf = loadPoolConfig(ConfigNames.Arbitrum);

  await deployMockTokens(conf, false);
});
