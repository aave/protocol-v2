import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames, getTreasuryAddress } from '../../helpers/configuration';
import { eEthereumNetwork, ICommonConfiguration } from '../../helpers/types';
import { waitForTx } from '../../helpers/misc-utils';
import { initTokenReservesByHelper } from '../../helpers/init-helpers';
import { exit } from 'process';
import {
  getFirstSigner,
  getLendingPoolAddressesProvider,
  getLendingPoolAddressesProviderRegistry,
} from '../../helpers/contracts-getters';
import { Signer } from 'ethers';
import { formatEther, parseEther } from 'ethers/lib/utils';

task('full:initialize-tokens', 'Initialize lending pool configuration.')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam('ratesDeployer', `RatesHelper address `)
  .addParam('dataProvider', `Data provider address`)
  .addFlag('verify')
  .setAction(async ({ verify, pool, dataProvider, ratesDeployer }, DRE) => {
    try {
      await DRE.run('set-DRE');
      let signer: Signer;
      const network =
        process.env.MAINNET_FORK === 'true'
          ? eEthereumNetwork.main
          : <eEthereumNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const { ReserveAssets, ReservesConfig } = poolConfig as ICommonConfiguration;

      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);

      const treasuryAddress = await getTreasuryAddress(poolConfig);
      const providerRegistryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);
      const providerRegistryOwner = getParamPerNetwork(poolConfig.ProviderRegistryOwner, network);

      const providerRegistry = await getLendingPoolAddressesProviderRegistry(
        providerRegistryAddress
      );

      const providers = await providerRegistry.getAddressesProvidersList();

      const addressesProvider = await getLendingPoolAddressesProvider(providers[0]); // Checks first provider

      const admin = await addressesProvider.getPoolAdmin();
      if (!reserveAssets) {
        throw 'Reserve assets is undefined. Check ReserveAssets configuration at config directory';
      }

      if (process.env.MAINNET_FORK === 'true') {
        await DRE.network.provider.request({
          method: 'hardhat_impersonateAccount',
          params: [providerRegistryOwner],
        });
        signer = DRE.ethers.provider.getSigner(providerRegistryOwner);
        const user = await getFirstSigner();
        await waitForTx(
          await user.sendTransaction({ to: await signer.getAddress(), value: parseEther('10') })
        );

        const balance = await signer.getBalance();
        console.log('signer balance', formatEther(balance));
      } else {
        signer = await getFirstSigner();
        const deployerAddress = await signer.getAddress();
        if (providerRegistryOwner !== (await signer.getAddress())) {
          throw Error(
            `Current signer is not provider registry owner. \nCurrent deployer address: ${deployerAddress} \nExpected address: ${poolConfig.ProviderRegistryOwner}`
          );
        }
      }

      // Init unitilialized reserves
      await initTokenReservesByHelper(
        ReservesConfig,
        reserveAssets,
        admin,
        addressesProvider.address,
        ratesDeployer,
        dataProvider,
        signer,
        treasuryAddress,
        verify
      );

      // Show contracts state
      await DRE.run('print-config', {
        pool: 'Aave',
        dataProvider,
      });
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });
