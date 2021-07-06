import { task } from 'hardhat/config';
import { getAaveOracle } from '../../helpers/contracts-getters';
import { waitForTx } from '../../helpers/misc-utils';
import { usingTenderly } from '../../helpers/tenderly-utils';

task('dev:set-price-providers-to-aave-oracle', 'Set price providers ')
  .addParam('aaveOracle', 'Aave Oracle where you are the owner')
  .addParam('tokens', 'Token addresses separated by comma')
  .addParam('priceProviders', 'Token address price providers separated by comma')
  .setAction(async ({ aaveOracle, tokens, priceProviders }, localBRE) => {
    await localBRE.run('set-DRE');
    const oracle = await getAaveOracle(aaveOracle);
    const tokenAddresses = tokens.split(',');
    const priceProviderAddresses = priceProviders.split(',');

    await waitForTx(await oracle.setAssetSources(tokenAddresses, priceProviderAddresses));
    console.log('- Set asset sources for AaveOracle:');
    tokenAddresses.forEach((element, i) => {
      console.log('  Asset:', element);
      console.log('  Source:', priceProviderAddresses[i]);
    });

    if (usingTenderly()) {
      const postDeployHead = localBRE.tenderly.network().getHead();
      const postDeployFork = localBRE.tenderly.network().getFork();
      console.log('Tenderly Info');
      console.log('- Head', postDeployHead);
      console.log('- Fork', postDeployFork);
    }
  });
