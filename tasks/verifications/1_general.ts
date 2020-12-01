import { zeroAddress } from 'ethereumjs-util';
import { task } from 'hardhat/config';
import { loadPoolConfig, ConfigNames, getWethAddress } from '../../helpers/configuration';
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

    // Tokens verification
    const DAI = getParamPerNetwork(ReserveAssets, network).DAI;
    const stableDebtDai = await getAddressById('stableDebtDAI');
    const variableDebtDai = await getAddressById('variableDebtDAI');
    const aDAI = await getAddressById('aDAI');
    const {
      stableDebtTokenAddress,
      variableDebtTokenAddress,
      aTokenAddress,
      interestRateStrategyAddress,
    } = await lendingPoolProxy.getReserveData(DAI);
    const {
      baseVariableBorrowRate,
      variableRateSlope1,
      variableRateSlope2,
      stableRateSlope1,
      stableRateSlope2,
    } = ReservesConfig.DAI;

    // Proxy Stable Debt
    console.log('\n- Verifying DAI Stable Debt Token proxy...\n');
    await verifyContract(stableDebtTokenAddress, [lendingPoolConfigurator.address]);

    // Proxy Variable Debt
    console.log('\n- Verifying DAI Variable Debt Token proxy...\n');
    await verifyContract(variableDebtTokenAddress, [lendingPoolConfigurator.address]);

    // Proxy aToken
    console.log('\n- Verifying aDAI Token proxy...\n');
    await verifyContract(aTokenAddress, [lendingPoolConfigurator.address]);

    // Strategy Rate
    console.log('\n- Verifying Strategy rate...\n');
    await verifyContract(interestRateStrategyAddress, [
      addressesProvider.address,
      baseVariableBorrowRate,
      variableRateSlope1,
      variableRateSlope2,
      stableRateSlope1,
      stableRateSlope2,
    ]);

    // aToken
    console.log('\n- Verifying aToken...\n');
    await verifyContract(aDAI, [
      lendingPoolProxy.address,
      DAI,
      ZERO_ADDRESS,
      'Aave interest bearing DAI',
      'aDAI',
      ZERO_ADDRESS,
    ]);
    // stableDebtToken
    console.log('\n- Verifying StableDebtToken...\n');
    await verifyContract(stableDebtDai, [
      lendingPoolProxy.address,
      DAI,
      'Aave stable debt bearing DAI',
      'stableDebtDAI',
      ZERO_ADDRESS,
    ]);
    // variableDebtToken
    console.log('\n- Verifying VariableDebtToken...\n');
    await verifyContract(variableDebtDai, [
      lendingPoolProxy.address,
      DAI,
      'Aave variable debt bearing DAI',
      'variableDebtDAI',
      ZERO_ADDRESS,
    ]);
    // DelegatedAwareAToken
    console.log('\n- Verifying DelegatedAwareAToken...\n');
    const UNI = getParamPerNetwork(ReserveAssets, network).UNI;
    const aUNI = await getAddressById('aUNI');
    await verifyContract(aUNI, [
      lendingPoolProxy.address,
      UNI,
      ZERO_ADDRESS,
      'Aave interest bearing UNI',
      'aUNI',
      ZERO_ADDRESS,
    ]);
  });
