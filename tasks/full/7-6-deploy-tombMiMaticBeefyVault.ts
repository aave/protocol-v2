import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import {
  deployTombMiMaticBeefyVault,
  deployTombMiMaticLPOracle,
} from '../../helpers/contracts-deployments';
import { getLendingPoolConfiguratorProxy, getSturdyOracle } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { eNetwork, IFantomConfiguration } from '../../helpers/types';

const CONTRACT_NAME = 'TombMiMaticBeefyVault';

task(`full:deploy-tomb-mimatic-beefy-vault`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveFactorTreasuryAddress, ReserveAssets, MIMATIC, ChainlinkAggregator } =
      poolConfig as IFantomConfiguration;
    const treasuryAddress = getParamPerNetwork(ReserveFactorTreasuryAddress, network);

    const tombMiMaticBeefyVault = await deployTombMiMaticBeefyVault(verify);
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.registerVault(tombMiMaticBeefyVault.address);
    await tombMiMaticBeefyVault.setTreasuryInfo(treasuryAddress, '1000'); //10% fee

    // Deploy mooTOMB_MIMATIC oracle
    let mooTombMiMaticOracleAddress = getParamPerNetwork(
      ChainlinkAggregator,
      network
    ).mooTOMB_MIMATIC;
    if (!mooTombMiMaticOracleAddress) {
      const mooTombMiMaticOracle = await deployTombMiMaticLPOracle();
      mooTombMiMaticOracleAddress = mooTombMiMaticOracle.address;
    }

    // Register MIMATIC, mooTOMB_MIMATIC oracle
    const sturdyOracle = await getSturdyOracle();
    await waitForTx(
      await sturdyOracle.setAssetSources(
        [
          getParamPerNetwork(MIMATIC, network),
          getParamPerNetwork(ReserveAssets, network).mooTOMB_MIMATIC,
        ],
        [getParamPerNetwork(ChainlinkAggregator, network).MIMATIC, mooTombMiMaticOracleAddress]
      )
    );
    console.log(
      (await sturdyOracle.getAssetPrice(getParamPerNetwork(MIMATIC, network))).toString()
    );
    console.log(
      (
        await sturdyOracle.getAssetPrice(getParamPerNetwork(ReserveAssets, network).mooTOMB_MIMATIC)
      ).toString()
    );

    console.log(`${CONTRACT_NAME}.address`, tombMiMaticBeefyVault.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
