import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { deployYearnCRVVault } from '../../helpers/contracts-deployments';
import { getLendingPoolConfiguratorProxy, getSturdyOracle } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { eNetwork, IFantomConfiguration } from '../../helpers/types';

const CONTRACT_NAME = 'YearnCRVVault';

task(`full:deploy-yearn-crv-vault`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveFactorTreasuryAddress, ReserveAssets, ChainlinkAggregator } =
      poolConfig as IFantomConfiguration;
    const treasuryAddress = getParamPerNetwork(ReserveFactorTreasuryAddress, network);

    const yearnCRVVault = await deployYearnCRVVault(verify);
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.registerVault(yearnCRVVault.address);
    await yearnCRVVault.setTreasuryInfo(treasuryAddress, '1000'); //10% fee

    // Register yvCRV oracle
    const sturdyOracle = await getSturdyOracle();
    await waitForTx(
      await sturdyOracle.setAssetSources(
        [getParamPerNetwork(ReserveAssets, network).yvCRV],
        [getParamPerNetwork(ChainlinkAggregator, network).yvCRV]
      )
    );
    console.log(
      (
        await sturdyOracle.getAssetPrice(getParamPerNetwork(ReserveAssets, network).yvCRV)
      ).toString()
    );

    console.log(`${CONTRACT_NAME}.address`, yearnCRVVault.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
