import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import {
  deployRETHWstETHLPOracle,
  deployConvexRocketPoolETHVault,
} from '../../helpers/contracts-deployments';
import { getLendingPoolConfiguratorProxy, getSturdyOracle } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { eNetwork, ISturdyConfiguration } from '../../helpers/types';

const CONTRACT_NAME = 'ConvexRocketPoolETHVault';

task(`full:deploy-convex-rocket-pool-eth-vault`, `Deploys the ${CONTRACT_NAME} contract`)
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
      RETH_WSTETH_LP,
    } = poolConfig as ISturdyConfiguration;
    const treasuryAddress = getParamPerNetwork(ReserveFactorTreasuryAddress, network);

    const vault = await deployConvexRocketPoolETHVault(verify);
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.registerVault(vault.address);
    await vault.setTreasuryInfo(treasuryAddress, '1000'); //10% fee
    await vault.setConfiguration(getParamPerNetwork(RETH_WSTETH_LP, network), 73); // set curve lp token & convex pool id

    const internalAssetAddress = await vault.getInternalAsset();
    console.log(`internal token: ${internalAssetAddress}`);

    // Deploy rETH_WstETH oracle
    let rETHWstETHOracleAddress = getParamPerNetwork(ChainlinkAggregator, network).cvxRETH_WSTETH;
    if (!rETHWstETHOracleAddress) {
      const rETHWstETHOracle = await deployRETHWstETHLPOracle(verify);
      rETHWstETHOracleAddress = rETHWstETHOracle.address;
    }

    // Register crETHwstETH-f, CRV, CVX oracle
    const sturdyOracle = await getSturdyOracle();
    await waitForTx(
      await sturdyOracle.setAssetSources(
        [internalAssetAddress, getParamPerNetwork(CRV, network), getParamPerNetwork(CVX, network)],
        [
          rETHWstETHOracleAddress,
          getParamPerNetwork(ChainlinkAggregator, network).CRV,
          getParamPerNetwork(ChainlinkAggregator, network).CVX,
        ]
      )
    );
    console.log((await sturdyOracle.getAssetPrice(internalAssetAddress)).toString());

    console.log((await sturdyOracle.getAssetPrice(getParamPerNetwork(CRV, network))).toString());

    console.log((await sturdyOracle.getAssetPrice(getParamPerNetwork(CVX, network))).toString());

    console.log(`${CONTRACT_NAME}.address`, vault.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
