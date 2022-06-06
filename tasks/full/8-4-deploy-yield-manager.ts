import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import {
  getFirstSigner,
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
} from '../../helpers/contracts-getters';
import { deployYieldManager } from '../../helpers/contracts-deployments';
import { eNetwork, ISturdyConfiguration } from '../../helpers/types';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';

const CONTRACT_NAME = 'YieldManager';

task(`full:deploy-yield-manager`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }
    const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { CRV, CVX, WETH } = poolConfig as ISturdyConfiguration;

    const yieldManager = await deployYieldManager(verify);
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator.registerVault(yieldManager.address);
    // Set Exchange Token as USDC
    await yieldManager.setExchangeToken(getParamPerNetwork(poolConfig.ReserveAssets, network).USDC);

    // Register reward asset(for now CRV & WETH)
    await yieldManager.registerAsset(getParamPerNetwork(CRV, network));
    await yieldManager.registerAsset(getParamPerNetwork(CVX, network));
    await yieldManager.registerAsset(getParamPerNetwork(WETH, network));

    // Set curve pool for swapping USDC -> DAI via curve
    const curve3Pool = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
    await yieldManager.setCurvePool(
      getParamPerNetwork(poolConfig.ReserveAssets, network).USDC,
      getParamPerNetwork(poolConfig.ReserveAssets, network).DAI,
      curve3Pool
    );
    await yieldManager.setCurvePool(
      getParamPerNetwork(poolConfig.ReserveAssets, network).USDC,
      getParamPerNetwork(poolConfig.ReserveAssets, network).USDT,
      curve3Pool
    );

    const addressProvider = await getLendingPoolAddressesProvider();
    const signer = await getFirstSigner();
    const processor = await signer.getAddress();
    await waitForTx(
      await addressProvider.setAddress(
        localBRE.ethers.utils.formatBytes32String('YIELD_PROCESSOR'),
        processor
      )
    );

    console.log(`${CONTRACT_NAME}.address`, yieldManager.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
