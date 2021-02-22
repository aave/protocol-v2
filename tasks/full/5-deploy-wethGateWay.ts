import { task } from 'hardhat/config';
import { AaveConfig } from '../../markets/aave/index';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { deployWETHGateway } from '../../helpers/contracts-deployments';
import { DRE } from '../../helpers/misc-utils';
import { eEthereumNetwork } from '../../helpers/types';

const CONTRACT_NAME = 'WETHGateway';

task(`full-deploy-weth-gateway`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eEthereumNetwork>localBRE.network.name;
    const Weth = AaveConfig.ReserveAssets[DRE.network.name].WETH;
    const poolConfig = loadPoolConfig(pool);
    const { WethGateway } = poolConfig;

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }
    let gateWay = getParamPerNetwork(WethGateway, network);
    if (gateWay === '') {
      const wethGateWay = await deployWETHGateway([Weth], verify);
      console.log(`${CONTRACT_NAME}.address`, wethGateWay.address);
      console.log(`\tFinished ${CONTRACT_NAME} deployment`);
    } else {
      console.log(`Weth gateway already deployed. Address: ${gateWay}`);
    }
  });
