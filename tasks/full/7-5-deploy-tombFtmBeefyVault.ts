import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import {
  deployTombFTMBeefyVault,
  deployTombFtmLPOracle,
  deployTombOracle,
} from '../../helpers/contracts-deployments';
import { getLendingPoolConfiguratorProxy, getSturdyOracle } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { eNetwork, IFantomConfiguration } from '../../helpers/types';

const CONTRACT_NAME = 'TombFtmBeefyVault';

task(`full:deploy-tomb-ftm-beefy-vault`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveFactorTreasuryAddress, ReserveAssets, TOMB, ChainlinkAggregator } =
      poolConfig as IFantomConfiguration;
    const treasuryAddress = getParamPerNetwork(ReserveFactorTreasuryAddress, network);

    const tombFtmBeefyVault = await deployTombFTMBeefyVault(verify);
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.registerVault(tombFtmBeefyVault.address);
    await tombFtmBeefyVault.setTreasuryInfo(treasuryAddress, '1000'); //10% fee

    // Deploy TOMB, mooTOMB_FTM oracle
    let tombOracleAddress = getParamPerNetwork(ChainlinkAggregator, network).TOMB;
    if (!tombOracleAddress) {
      const tombOracle = await deployTombOracle();
      tombOracleAddress = tombOracle.address;
    }

    let mooTombFtmOracleAddress = getParamPerNetwork(ChainlinkAggregator, network).mooTOMB_FTM;
    if (!mooTombFtmOracleAddress) {
      const mooTombFtmOracle = await deployTombFtmLPOracle();
      mooTombFtmOracleAddress = mooTombFtmOracle.address;
    }

    // Register TOMB, mooTOMB_FTM oracle
    const sturdyOracle = await getSturdyOracle();
    await waitForTx(
      await sturdyOracle.setAssetSources(
        [getParamPerNetwork(TOMB, network), getParamPerNetwork(ReserveAssets, network).mooTOMB_FTM],
        [tombOracleAddress, mooTombFtmOracleAddress]
      )
    );
    console.log((await sturdyOracle.getAssetPrice(getParamPerNetwork(TOMB, network))).toString());
    console.log(
      (
        await sturdyOracle.getAssetPrice(getParamPerNetwork(ReserveAssets, network).mooTOMB_FTM)
      ).toString()
    );

    console.log(`${CONTRACT_NAME}.address`, tombFtmBeefyVault.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
