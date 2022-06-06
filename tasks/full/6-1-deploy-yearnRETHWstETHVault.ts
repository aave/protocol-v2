import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import {
  deployRETHWstETHLPOracle,
  deployYearnRETHWstETHVaultVault,
} from '../../helpers/contracts-deployments';
import { getLendingPoolConfiguratorProxy, getSturdyOracle } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { eNetwork, ISturdyConfiguration } from '../../helpers/types';

const CONTRACT_NAME = 'YearnRETHWstETHVault';

task(`full:deploy-yearn-reth-wsteth-vault`, `Deploys the ${CONTRACT_NAME} contract`)
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
      poolConfig as ISturdyConfiguration;
    const treasuryAddress = getParamPerNetwork(ReserveFactorTreasuryAddress, network);

    const vault = await deployYearnRETHWstETHVaultVault(verify);
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.registerVault(vault.address);
    await vault.setTreasuryInfo(treasuryAddress, '1000'); //10% fee

    // Deploy rETH_WstETH oracle
    let rETHWstETHOracleAddress = getParamPerNetwork(ChainlinkAggregator, network).yvRETH_WSTETH;
    if (!rETHWstETHOracleAddress) {
      const rETHWstETHOracle = await deployRETHWstETHLPOracle(verify);
      rETHWstETHOracleAddress = rETHWstETHOracle.address;
    }

    // Register yvSPELL oracle
    const sturdyOracle = await getSturdyOracle();
    await waitForTx(
      await sturdyOracle.setAssetSources(
        [getParamPerNetwork(ReserveAssets, network).yvRETH_WSTETH],
        [rETHWstETHOracleAddress]
      )
    );
    console.log(
      (
        await sturdyOracle.getAssetPrice(getParamPerNetwork(ReserveAssets, network).yvRETH_WSTETH)
      ).toString()
    );

    console.log(`${CONTRACT_NAME}.address`, vault.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
