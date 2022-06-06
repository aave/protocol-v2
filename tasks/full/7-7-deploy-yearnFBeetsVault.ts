import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import {
  deployYearnFBeetsVault,
  deployFBeetsOracle,
  deployBeetsOracle,
} from '../../helpers/contracts-deployments';
import { getLendingPoolConfiguratorProxy, getSturdyOracle } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { DRE, waitForTx } from '../../helpers/misc-utils';
import { eNetwork, IFantomConfiguration } from '../../helpers/types';

const CONTRACT_NAME = 'YearnFBEETSVault';

task(`full:deploy-yearn-fbeets-vault`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveFactorTreasuryAddress, ReserveAssets, ChainlinkAggregator, BEETS } =
      poolConfig as IFantomConfiguration;
    const treasuryAddress = getParamPerNetwork(ReserveFactorTreasuryAddress, network);

    const yearnFBEETSVault = await deployYearnFBeetsVault(verify);
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.registerVault(yearnFBEETSVault.address);
    await yearnFBEETSVault.setTreasuryInfo(treasuryAddress, '1000'); //10% fee

    const poolId = '0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019';

    await yearnFBEETSVault.setBeethovenVaultAddress('0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce');
    await yearnFBEETSVault.setBeethovenLiquidityPoolId(new String(poolId).valueOf());
    await yearnFBEETSVault.setBeethovenSwapPoolId(new String(poolId).valueOf());

    // Deploy fBEETS oracle
    let fbeetsOracleAddress = getParamPerNetwork(ChainlinkAggregator, network).yvfBEETS;
    if (!fbeetsOracleAddress) {
      const yvfBeetsOracle = await deployFBeetsOracle();
      fbeetsOracleAddress = yvfBeetsOracle.address;
    }

    // Deploy BEETS oracle
    let beetsOracleAddress = getParamPerNetwork(ChainlinkAggregator, network).BEETS;
    if (!beetsOracleAddress) {
      const beetsOracle = await deployBeetsOracle();
      beetsOracleAddress = beetsOracle.address;
    }

    // Register fBEETS oracle
    const sturdyOracle = await getSturdyOracle();
    await waitForTx(
      await sturdyOracle.setAssetSources(
        [getParamPerNetwork(ReserveAssets, network).yvfBEETS, getParamPerNetwork(BEETS, network)],
        [fbeetsOracleAddress, beetsOracleAddress]
      )
    );

    console.log(
      (
        await sturdyOracle.getAssetPrice(getParamPerNetwork(ReserveAssets, network).yvfBEETS)
      ).toString()
    );

    console.log((await sturdyOracle.getAssetPrice(getParamPerNetwork(BEETS, network))).toString());

    console.log(`${CONTRACT_NAME}.address`, yearnFBEETSVault.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
