import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import {
  deployBasedMiMaticBeefyVault,
  deployBasedMiMaticLPOracle,
  deployBasedOracle,
} from '../../helpers/contracts-deployments';
import { getLendingPoolConfiguratorProxy, getSturdyOracle } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { eNetwork, IFantomConfiguration } from '../../helpers/types';

const CONTRACT_NAME = 'BasedMiMaticBeefyVault';

task(`full:deploy-based-mimatic-beefy-vault`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveFactorTreasuryAddress, ReserveAssets, BASED, ChainlinkAggregator } =
      poolConfig as IFantomConfiguration;
    const treasuryAddress = getParamPerNetwork(ReserveFactorTreasuryAddress, network);

    const basedMiMaticBeefyVault = await deployBasedMiMaticBeefyVault(verify);
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.registerVault(basedMiMaticBeefyVault.address);
    await basedMiMaticBeefyVault.setTreasuryInfo(treasuryAddress, '1000'); //10% fee

    // Deploy BASED, mooBASED_MIMATIC oracle
    let basedOracleAddress = getParamPerNetwork(ChainlinkAggregator, network).BASED;
    if (!basedOracleAddress) {
      const basedOracle = await deployBasedOracle();
      basedOracleAddress = basedOracle.address;
    }

    let mooBasedMiMaticOracleAddress = getParamPerNetwork(
      ChainlinkAggregator,
      network
    ).mooBASED_MIMATIC;
    if (!mooBasedMiMaticOracleAddress) {
      const mooBasedMiMaticOracle = await deployBasedMiMaticLPOracle();
      mooBasedMiMaticOracleAddress = mooBasedMiMaticOracle.address;
    }

    // Register MIMATIC, mooBASED_MIMATIC oracle
    const sturdyOracle = await getSturdyOracle();
    await waitForTx(
      await sturdyOracle.setAssetSources(
        [
          getParamPerNetwork(BASED, network),
          getParamPerNetwork(ReserveAssets, network).mooBASED_MIMATIC,
        ],
        [basedOracleAddress, mooBasedMiMaticOracleAddress]
      )
    );
    console.log((await sturdyOracle.getAssetPrice(getParamPerNetwork(BASED, network))).toString());
    console.log(
      (
        await sturdyOracle.getAssetPrice(
          getParamPerNetwork(ReserveAssets, network).mooBASED_MIMATIC
        )
      ).toString()
    );

    console.log(`${CONTRACT_NAME}.address`, basedMiMaticBeefyVault.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
