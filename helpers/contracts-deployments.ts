import {Contract} from 'ethers';
import {BRE} from './misc-utils';
import {
  tEthereumAddress,
  eContractid,
  tStringTokenSmallUnits,
  AavePools,
  TokenContractId,
  iMultiPoolsAssets,
  IReserveParams,
  PoolConfiguration,
} from './types';

import {MintableErc20 as MintableERC20} from '../types/MintableErc20';
import {readArtifact} from '@nomiclabs/buidler/plugins';
import {MockContract} from 'ethereum-waffle';
import {getReservesConfigByPool} from './configuration';
import {getFirstSigner, getReserveLogic} from './contracts-getters';
import {ZERO_ADDRESS} from './constants';
import {
  AaveProtocolTestHelpersFactory,
  ATokenFactory,
  ChainlinkProxyPriceProviderFactory,
  DefaultReserveInterestRateStrategyFactory,
  GenericLogicFactory,
  InitializableAdminUpgradeabilityProxyFactory,
  LendingPoolAddressesProviderFactory,
  LendingPoolAddressesProviderRegistryFactory,
  LendingPoolCollateralManagerFactory,
  LendingPoolConfiguratorFactory,
  LendingPoolFactory,
  LendingPoolLibraryAddresses,
  LendingRateOracleFactory,
  MintableErc20Factory,
  MockAggregatorFactory,
  MockFlashLoanReceiverFactory,
  MockSwapAdapterFactory,
  PriceOracleFactory,
  ReserveLogicFactory,
  StableDebtTokenFactory,
  VariableDebtTokenFactory,
  WalletBalanceProviderFactory,
} from '../types';
import {withSaveAndVerify, registerContractInJsonDb, linkBytecode} from './contracts-helpers';
import {verifyContract} from './etherscan-verification';
import {LendingPool} from '../types/LendingPool';
import {Artifact} from '@nomiclabs/buidler/types';

export const deployLendingPoolAddressesProvider = async (verify?: boolean) =>
  withSaveAndVerify(
    await new LendingPoolAddressesProviderFactory(await getFirstSigner()).deploy(),
    eContractid.LendingPoolAddressesProvider,
    [],
    verify
  );

export const deployLendingPoolAddressesProviderRegistry = async (verify?: boolean) =>
  withSaveAndVerify(
    await new LendingPoolAddressesProviderRegistryFactory(await getFirstSigner()).deploy(),
    eContractid.LendingPoolAddressesProviderRegistry,
    [],
    verify
  );

export const deployLendingPoolConfigurator = async (verify?: boolean) =>
  withSaveAndVerify(
    await new LendingPoolConfiguratorFactory(await getFirstSigner()).deploy(),
    eContractid.LendingPoolConfigurator,
    [],
    verify
  );

export const deployReserveLogicLibrary = async (verify?: boolean) =>
  withSaveAndVerify(
    await new ReserveLogicFactory(await getFirstSigner()).deploy(),
    eContractid.ReserveLogic,
    [],
    verify
  );

export const deployGenericLogic = async (reserveLogic: Contract, verify?: boolean) => {
  const genericLogicArtifact = await readArtifact(
    BRE.config.paths.artifacts,
    eContractid.GenericLogic
  );

  const linkedGenericLogicByteCode = linkBytecode(genericLogicArtifact, {
    [eContractid.ReserveLogic]: reserveLogic.address,
  });

  const genericLogicFactory = await BRE.ethers.getContractFactory(
    genericLogicArtifact.abi,
    linkedGenericLogicByteCode
  );

  const genericLogic = await (await genericLogicFactory.deploy()).deployed();
  return withSaveAndVerify(genericLogic, eContractid.GenericLogic, [], verify);
};

export const deployValidationLogic = async (
  reserveLogic: Contract,
  genericLogic: Contract,
  verify?: boolean
) => {
  const validationLogicArtifact = await readArtifact(
    BRE.config.paths.artifacts,
    eContractid.ValidationLogic
  );

  const linkedValidationLogicByteCode = linkBytecode(validationLogicArtifact, {
    [eContractid.ReserveLogic]: reserveLogic.address,
    [eContractid.GenericLogic]: genericLogic.address,
  });

  const validationLogicFactory = await BRE.ethers.getContractFactory(
    validationLogicArtifact.abi,
    linkedValidationLogicByteCode
  );

  const validationLogic = await (await validationLogicFactory.deploy()).deployed();

  return withSaveAndVerify(validationLogic, eContractid.ValidationLogic, [], verify);
};

export const deployAaveLibraries = async (
  verify?: boolean
): Promise<LendingPoolLibraryAddresses> => {
  const reserveLogic = await deployReserveLogicLibrary(verify);
  const genericLogic = await deployGenericLogic(reserveLogic, verify);
  const validationLogic = await deployValidationLogic(reserveLogic, genericLogic, verify);

  // Hardcoded solidity placeholders, if any library changes path this will fail.
  // The '__$PLACEHOLDER$__ can be calculated via solidity keccak, but the LendingPoolLibraryAddresses Type seems to
  // require a hardcoded string.
  //
  //  how-to:
  //  1. PLACEHOLDER = solidityKeccak256(['string'], `${libPath}:${libName}`).slice(2, 36)
  //  2. LIB_PLACEHOLDER = `__$${PLACEHOLDER}$__`
  // or grab placeholdes from LendingPoolLibraryAddresses at Typechain generation.
  //
  // libPath example: contracts/libraries/logic/GenericLogic.sol
  // libName example: GenericLogic
  return {
    ['__$5201a97c05ba6aa659e2f36a933dd51801$__']: validationLogic.address,
    ['__$d3b4366daeb9cadc7528af6145b50b2183$__']: reserveLogic.address,
    ['__$4c26be947d349222af871a3168b3fe584b$__']: genericLogic.address,
  };
};

export const deployLendingPoolWithFactory = async (verify?: boolean) => {
  const libraries = await deployAaveLibraries(verify);
  return withSaveAndVerify(
    await new LendingPoolFactory(libraries, await getFirstSigner()).deploy(),
    eContractid.LendingPool,
    [],
    verify
  );
};

const deployLibrary = async (libraryId: eContractid) => {
  const factory = await BRE.ethers.getContractFactory(libraryId);
  const library = await factory.deploy();
  await library.deployed();

  return library;
};

export const linkLibrariesToArtifact = async (artifact: Artifact) => {
  const reserveLogic = await deployLibrary(eContractid.ReserveLogic);

  const genericLogicArtifact = await readArtifact(
    BRE.config.paths.artifacts,
    eContractid.GenericLogic
  );

  const linkedGenericLogicByteCode = linkBytecode(genericLogicArtifact, {
    [eContractid.ReserveLogic]: reserveLogic.address,
  });

  const genericLogicFactory = await BRE.ethers.getContractFactory(
    genericLogicArtifact.abi,
    linkedGenericLogicByteCode
  );

  const genericLogic = await (await genericLogicFactory.deploy()).deployed();

  const validationLogicArtifact = await readArtifact(
    BRE.config.paths.artifacts,
    eContractid.ValidationLogic
  );

  const linkedValidationLogicByteCode = linkBytecode(validationLogicArtifact, {
    [eContractid.ReserveLogic]: reserveLogic.address,
    [eContractid.GenericLogic]: genericLogic.address,
  });

  const validationLogicFactory = await BRE.ethers.getContractFactory(
    validationLogicArtifact.abi,
    linkedValidationLogicByteCode
  );

  const validationLogic = await (await validationLogicFactory.deploy()).deployed();

  const linkedBytecode = linkBytecode(artifact, {
    [eContractid.ReserveLogic]: reserveLogic.address,
    [eContractid.GenericLogic]: genericLogic.address,
    [eContractid.ValidationLogic]: validationLogic.address,
  });
  const factory = await BRE.ethers.getContractFactory(artifact.abi, linkedBytecode);

  return factory;
};

export const deployLendingPool = async (verify?: boolean) => {
  const lendingPoolArtifact = await readArtifact(
    BRE.config.paths.artifacts,
    eContractid.LendingPool
  );
  const factory = await linkLibrariesToArtifact(lendingPoolArtifact);
  const lendingPool = await factory.deploy();
  const instance = (await lendingPool.deployed()) as LendingPool;
  if (verify) {
    await verifyContract(eContractid.LendingPool, instance.address, []);
  }
  return instance;
};

export const deployPriceOracle = async (verify?: boolean) =>
  withSaveAndVerify(
    await new PriceOracleFactory(await getFirstSigner()).deploy(),
    eContractid.PriceOracle,
    [],
    verify
  );

export const deployLendingRateOracle = async (verify?: boolean) =>
  withSaveAndVerify(
    await new LendingRateOracleFactory(await getFirstSigner()).deploy(),
    eContractid.LendingRateOracle,
    [],
    verify
  );

export const deployMockAggregator = async (price: tStringTokenSmallUnits, verify?: boolean) =>
  withSaveAndVerify(
    await new MockAggregatorFactory(await getFirstSigner()).deploy(price),
    eContractid.MockAggregator,
    [price],
    verify
  );

export const deployChainlinkProxyPriceProvider = async (
  args: [tEthereumAddress[], tEthereumAddress[], tEthereumAddress],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new ChainlinkProxyPriceProviderFactory(await getFirstSigner()).deploy(...args),
    eContractid.ChainlinkProxyPriceProvider,
    args,
    verify
  );

export const deployLendingPoolCollateralManager = async (verify?: boolean) => {
  const reservesLogic = await getReserveLogic();
  console.log('ADDRESS RESERVELOGIC', reservesLogic.address);
  const libraries = {
    // See deployAaveLibraries() function
    ['__$d3b4366daeb9cadc7528af6145b50b2183$__']: reservesLogic.address,
  };

  return withSaveAndVerify(
    await new LendingPoolCollateralManagerFactory(libraries, await getFirstSigner()).deploy(),
    eContractid.LendingPoolCollateralManager,
    [],
    verify
  );
};

export const deployInitializableAdminUpgradeabilityProxy = async (verify?: boolean) =>
  withSaveAndVerify(
    await new InitializableAdminUpgradeabilityProxyFactory(await getFirstSigner()).deploy(),
    eContractid.InitializableAdminUpgradeabilityProxy,
    [],
    verify
  );

export const deployMockFlashLoanReceiver = async (
  addressesProvider: tEthereumAddress,
  verify?: boolean
) =>
  withSaveAndVerify(
    await new MockFlashLoanReceiverFactory(await getFirstSigner()).deploy(addressesProvider),
    eContractid.MockFlashLoanReceiver,
    [addressesProvider],
    verify
  );

export const deployWalletBalancerProvider = async (
  addressesProvider: tEthereumAddress,
  verify?: boolean
) =>
  withSaveAndVerify(
    await new WalletBalanceProviderFactory(await getFirstSigner()).deploy(addressesProvider),
    eContractid.WalletBalanceProvider,
    [addressesProvider],
    verify
  );

export const deployMockSwapAdapter = async (addressesProvider: tEthereumAddress) =>
  await new MockSwapAdapterFactory(await getFirstSigner()).deploy(addressesProvider);

export const deployAaveProtocolTestHelpers = async (
  addressesProvider: tEthereumAddress,
  verify?: boolean
) =>
  withSaveAndVerify(
    await new AaveProtocolTestHelpersFactory(await getFirstSigner()).deploy(addressesProvider),
    eContractid.AaveProtocolTestHelpers,
    [addressesProvider],
    verify
  );

export const deployMintableERC20 = async (
  args: [string, string, string],
  verify?: boolean
): Promise<MintableERC20> =>
  withSaveAndVerify(
    await new MintableErc20Factory(await getFirstSigner()).deploy(...args),
    eContractid.MintableERC20,
    args,
    verify
  );

export const deployDefaultReserveInterestRateStrategy = async (
  args: [tEthereumAddress, string, string, string, string, string],
  verify: boolean
) =>
  withSaveAndVerify(
    await new DefaultReserveInterestRateStrategyFactory(await getFirstSigner()).deploy(...args),
    eContractid.DefaultReserveInterestRateStrategy,
    args,
    verify
  );

export const deployStableDebtToken = async (
  args: [tEthereumAddress, tEthereumAddress, string, string, tEthereumAddress],
  verify: boolean
) =>
  withSaveAndVerify(
    await new StableDebtTokenFactory(await getFirstSigner()).deploy(...args),
    eContractid.StableDebtToken,
    args,
    verify
  );

export const deployVariableDebtToken = async (
  args: [tEthereumAddress, tEthereumAddress, string, string, tEthereumAddress],
  verify: boolean
) =>
  withSaveAndVerify(
    await new VariableDebtTokenFactory(await getFirstSigner()).deploy(...args),
    eContractid.VariableDebtToken,
    args,
    verify
  );

export const deployGenericAToken = async (
  [poolAddress, underlyingAssetAddress, name, symbol, incentivesController]: [
    tEthereumAddress,
    tEthereumAddress,
    string,
    string,
    tEthereumAddress
  ],
  verify: boolean
) => {
  const args: [
    tEthereumAddress,
    tEthereumAddress,
    tEthereumAddress,
    string,
    string,
    tEthereumAddress
  ] = [poolAddress, underlyingAssetAddress, ZERO_ADDRESS, name, symbol, incentivesController];
  return withSaveAndVerify(
    await new ATokenFactory(await getFirstSigner()).deploy(...args),
    eContractid.AToken,
    args,
    verify
  );
};

export const deployAllMockTokens = async (verify?: boolean) => {
  const tokens: {[symbol: string]: MockContract | MintableERC20} = {};

  const protoConfigData = getReservesConfigByPool(AavePools.proto);
  const secondaryConfigData = getReservesConfigByPool(AavePools.secondary);

  for (const tokenSymbol of Object.keys(TokenContractId)) {
    let decimals = '18';

    let configData = (<any>protoConfigData)[tokenSymbol];

    if (!configData) {
      configData = (<any>secondaryConfigData)[tokenSymbol];
    }

    tokens[tokenSymbol] = await deployMintableERC20(
      [tokenSymbol, tokenSymbol, configData ? configData.reserveDecimals : decimals],
      verify
    );
  }
  return tokens;
};

export const deployMockTokens = async (config: PoolConfiguration, verify?: boolean) => {
  const tokens: {[symbol: string]: MockContract | MintableERC20} = {};
  const defaultDecimals = 18;

  const configData = config.ReservesConfig;

  for (const tokenSymbol of Object.keys(config.ReserveSymbols)) {
    tokens[tokenSymbol] = await deployMintableERC20(
      [
        tokenSymbol,
        tokenSymbol,
        configData[tokenSymbol as keyof iMultiPoolsAssets<IReserveParams>].reserveDecimals ||
          defaultDecimals.toString(),
      ],
      verify
    );
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
  }
  return tokens;
};
