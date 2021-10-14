import { task } from 'hardhat/config';
import { eContractid } from '../../helpers/types';
import { deployUiPoolDataProvider } from '../../helpers/contracts-deployments';

task(`deploy-${eContractid.UiPoolDataProvider}`, `Deploys the UiPoolDataProvider contract`)
  .addFlag('verify', 'Verify UiPoolDataProvider contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');
    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const chainlinkAggregatorProxy = {
      mainnet: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
      kovan: '0x9326BFA02ADD2366b30bacB125260Af641031331',
      matic: '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0',
      mumbai: '0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada',
      avalanche: '0x0A77230d17318075983913bC2145DB16C7366156',
      fuji: '0x5498BB86BC934c8D34FDA08E81D444153d0D06aD',
    };
    console.log(
      `\n- UiPoolDataProvider price aggregator: ${chainlinkAggregatorProxy[localBRE.network.name]}`
    );
    console.log(`\n- UiPoolDataProvider deployment`);

    const uiPoolDataProvider = await deployUiPoolDataProvider(
      chainlinkAggregatorProxy[localBRE.network.name],
      verify
    );

    console.log('UiPoolDataProvider deployed at:', uiPoolDataProvider.address);
    console.log(`\tFinished UiPoolDataProvider deployment`);
  });
