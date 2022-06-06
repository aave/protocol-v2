import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import {
  deployDOLA3CRVOracle,
  deployConvexDOLA3CRVVault,
} from '../../helpers/contracts-deployments';
import { getLendingPoolConfiguratorProxy, getSturdyOracle } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { eNetwork, ISturdyConfiguration } from '../../helpers/types';

const CONTRACT_NAME = 'ConvexDOLA3CRVVault';

task(`full:deploy-convex-dola-3crv-vault`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const {
      ReserveFactorTreasuryAddress,
      ReserveAssets,
      ChainlinkAggregator,
      CRV,
      CVX,
      DOLA_3CRV_LP,
    } = poolConfig as ISturdyConfiguration;
    const treasuryAddress = getParamPerNetwork(ReserveFactorTreasuryAddress, network);

    const vault = await deployConvexDOLA3CRVVault(verify);
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.registerVault(vault.address);
    await vault.setTreasuryInfo(treasuryAddress, '1000'); //10% fee
    await vault.setConfiguration(getParamPerNetwork(DOLA_3CRV_LP, network), 62); // set curve lp token & convex pool id

    const internalAssetAddress = await vault.getInternalAsset();
    console.log(`internal token: ${internalAssetAddress}`);

    // Deploy DOLA3CRV oracle
    let DOLA3CRVOracleAddress = getParamPerNetwork(ChainlinkAggregator, network).cvxDOLA_3CRV;
    if (!DOLA3CRVOracleAddress) {
      const DOLA3CRVOracle = await deployDOLA3CRVOracle(verify);
      DOLA3CRVOracleAddress = DOLA3CRVOracle.address;
    }

    // Register cDOLA3POOL3CRV-f, CRV oracle
    const sturdyOracle = await getSturdyOracle();
    await waitForTx(
      await sturdyOracle.setAssetSources(
        [
          internalAssetAddress /*, getParamPerNetwork(CRV, network), getParamPerNetwork(CVX, network)*/,
        ],
        [
          DOLA3CRVOracleAddress,
          /*getParamPerNetwork(ChainlinkAggregator, network).CRV,
          getParamPerNetwork(ChainlinkAggregator, network).CVX,*/
        ]
      )
    );
    console.log((await sturdyOracle.getAssetPrice(internalAssetAddress)).toString());

    console.log((await sturdyOracle.getAssetPrice(getParamPerNetwork(CRV, network))).toString());

    console.log((await sturdyOracle.getAssetPrice(getParamPerNetwork(CVX, network))).toString());

    console.log(`${CONTRACT_NAME}.address`, vault.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
