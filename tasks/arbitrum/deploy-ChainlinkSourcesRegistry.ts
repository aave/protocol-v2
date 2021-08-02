import { getArtifactFromContractOutput } from '@nomiclabs/buidler/internal/artifacts';
import { sign } from 'crypto';
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
import { getParamPerNetwork, withSaveAndVerify } from '../../helpers/contracts-helpers';
import { eArbitrumNetwork, eContractid, eEthereumNetwork } from '../../helpers/types';
import { ChainlinkSourcesRegistryFactory, LendingPool } from '../../types';

const deployChainlinkSourcesRegistry = async (verify: boolean) => {
  return withSaveAndVerify(
    await new ChainlinkSourcesRegistryFactory(await getFirstSigner()).deploy(),
    'ChainlinkSourcesRegistry',
    [],
    verify
  );
};

task(
  'arbitrum:deploy:chainlink-sources-registry',
  'Deploy chainlink sources registry to arbitrum'
).setAction(async ({}, localBRE) => {
  await localBRE.run('set-DRE');

  const conf = loadPoolConfig(ConfigNames.Arbitrum);
  const network = localBRE.network.name;

  let assetNames = Object.keys(conf.ReserveAssets[network]);
  let assets: string[] = [];
  let aggregators: string[] = [];

  assetNames.forEach((assetName) => {
    assets.push(conf.ReserveAssets[network][assetName]);
    aggregators.push(conf.ChainlinkAggregator[network][assetName]);
  });

  console.log('Assets', assets, 'Aggregators', aggregators);

  const signer = await getFirstSigner();

  const chainlinkSourcesRegistry = await deployChainlinkSourcesRegistry(false);
  console.log(`Deployed ChainlinkSourcesRegistry to: ${chainlinkSourcesRegistry.address}`);

  await chainlinkSourcesRegistry.connect(signer).initialize();
  await chainlinkSourcesRegistry.connect(signer).updateAggregators(assets, aggregators);

  // Lookup to see if it updated
  for (let i = 0; i < assets.length; i++) {
    let asset = assets[i];
    const aggregatorFromContract = await chainlinkSourcesRegistry.aggregatorsOfAssets(asset);
    console.log(`${assetNames[i]} at ${asset} with aggregator at: ${aggregatorFromContract}`);
  }
});
