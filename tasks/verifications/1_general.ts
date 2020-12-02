import { error } from 'console';
import { zeroAddress } from 'ethereumjs-util';
import { task } from 'hardhat/config';
import {
  loadPoolConfig,
  ConfigNames,
  getWethAddress,
  getTreasuryAddress,
} from '../../helpers/configuration';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  getAaveProtocolDataProvider,
  getAddressById,
  getLendingPool,
  getLendingPoolAddressesProvider,
  getLendingPoolAddressesProviderRegistry,
  getLendingPoolCollateralManager,
  getLendingPoolCollateralManagerImpl,
  getLendingPoolConfiguratorImpl,
  getLendingPoolConfiguratorProxy,
  getLendingPoolImpl,
  getWalletProvider,
  getWETHGateway,
} from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { verifyContract } from '../../helpers/etherscan-verification';
import { notFalsyOrZeroAddress } from '../../helpers/misc-utils';
import { eEthereumNetwork, ICommonConfiguration } from '../../helpers/types';

task('verify:general', 'Deploy oracles for dev enviroment')
  .addFlag('all', 'Verify all contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ all, pool }, localDRE) => {
    await localDRE.run('set-DRE');
    const network = localDRE.network.name as eEthereumNetwork;
    const poolConfig = loadPoolConfig(pool);
    const {
      ReserveAssets,
      ReservesConfig,
      ProviderRegistry,
      MarketId,
    } = poolConfig as ICommonConfiguration;
    const treasuryAddress = await getTreasuryAddress(poolConfig);

    const registryAddress = getParamPerNetwork(ProviderRegistry, network);
    const addressesProvider = await getLendingPoolAddressesProvider();
    const addressesProviderRegistry = notFalsyOrZeroAddress(registryAddress)
      ? await getLendingPoolAddressesProviderRegistry(registryAddress)
      : await getLendingPoolAddressesProviderRegistry();
    const lendingPoolProxy = await getLendingPool();
    const lendingPoolConfigurator = await getLendingPoolConfiguratorProxy();
    const lendingPoolCollateralManager = await getLendingPoolCollateralManager();

    if (all) {
      const lendingPoolImpl = await getLendingPoolImpl();
      const lendingPoolConfiguratorImpl = await getLendingPoolConfiguratorImpl();
      const lendingPoolCollateralManagerImpl = await getLendingPoolCollateralManagerImpl();
      const dataProvider = await getAaveProtocolDataProvider();
      const walletProvider = await getWalletProvider();
      const wethGateway = await getWETHGateway();

      // Address Provider
      console.log('\n- Verifying address provider...\n');
      await verifyContract(addressesProvider.address, [MarketId]);

      // Address Provider Registry
      console.log('\n- Verifying address provider registry...\n');
      await verifyContract(addressesProviderRegistry.address, []);

      // Lending Pool implementation
      console.log('\n- Verifying LendingPool Implementation...\n');
      await verifyContract(lendingPoolImpl.address, []);

      // Lending Pool Configurator implementation
      console.log('\n- Verifying LendingPool Configurator Implementation...\n');
      await verifyContract(lendingPoolConfiguratorImpl.address, []);

      // Lending Pool Collateral Manager implementation
      console.log('\n- Verifying LendingPool Collateral Manager Implementation...\n');
      await verifyContract(lendingPoolCollateralManagerImpl.address, []);

      // Test helpers
      console.log('\n- Verifying  Aave  Provider Helpers...\n');
      await verifyContract(dataProvider.address, [addressesProvider.address]);

      // Wallet balance provider
      console.log('\n- Verifying  Wallet Balance Provider...\n');
      await verifyContract(walletProvider.address, []);

      // WETHGateway
      console.log('\n- Verifying  WETHGateway...\n');
      await verifyContract(wethGateway.address, [
        await getWethAddress(poolConfig),
        lendingPoolProxy.address,
      ]);
    }
    // Lending Pool proxy
    console.log('\n- Verifying  Lending Pool Proxy...\n');
    await verifyContract(lendingPoolProxy.address, [addressesProvider.address]);

    // LendingPool Conf proxy
    console.log('\n- Verifying  Lending Pool Configurator Proxy...\n');
    await verifyContract(lendingPoolConfigurator.address, [addressesProvider.address]);

    // Proxy collateral manager
    console.log('\n- Verifying  Lending Pool Collateral Manager Proxy...\n');
    await verifyContract(lendingPoolCollateralManager.address, []);

    // DelegatedAwareAToken
    console.log('\n- Verifying DelegatedAwareAToken...\n');
    const UNI = getParamPerNetwork(ReserveAssets, network).UNI;
    const aUNI = await getAddressById('aUNI');
    if (aUNI) {
      console.log('Verifying aUNI');
      await verifyContract(aUNI, [
        lendingPoolProxy.address,
        UNI,
        treasuryAddress,
        'Aave interest bearing UNI',
        'aUNI',
        ZERO_ADDRESS,
      ]);
    } else {
      console.error('Missing aUNI address at JSON DB. Skipping...');
    }
    console.log('Finished verifications.');
  });
