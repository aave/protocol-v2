import { task } from 'hardhat/config';
import {
  deployLendingPoolAddressesProvider,
  //deployLendingPoolAddressesProviderRegistry,
} from '../../helpers/contracts-deployments';
import { getLendingPoolAddressesProviderRegistry } from '../../helpers/contracts-getters'
import { waitForTx } from '../../helpers/misc-utils';
import { UniswapConfig } from '../../markets/uniswap';

task(
  'dev:deploy-uniswap-address-provider',
  'Deploy uniswap market address provider'
)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const admin = await (await localBRE.ethers.getSigners())[0].getAddress();

    const addressesProvider = await deployLendingPoolAddressesProvider(UniswapConfig.MarketId, verify);
    await waitForTx(await addressesProvider.setPoolAdmin(admin));

    const addressesProviderRegistry = await getLendingPoolAddressesProviderRegistry();
    await waitForTx(
      await addressesProviderRegistry.registerAddressesProvider(addressesProvider.address, 1)
    );
    console.log(addressesProvider.address);
  });
