import { task } from 'hardhat/config';
import { ConfigNames } from '../../helpers/configuration';
import { deployFTMLiquidator, deployETHLiquidator } from '../../helpers/contracts-deployments';
import { getLendingPoolAddressesProvider } from '../../helpers/contracts-getters';
import { eNetwork } from '../../helpers/types';

const CONTRACT_NAME = 'Liquidator';

task(`full:deploy-liquidator`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>localBRE.network.name;
    const addressesProvider = await getLendingPoolAddressesProvider();
    const liquidator =
      network == 'ftm'
        ? await deployFTMLiquidator([addressesProvider.address], verify)
        : await deployETHLiquidator([addressesProvider.address], verify);

    console.log(`${CONTRACT_NAME}.address`, liquidator.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
