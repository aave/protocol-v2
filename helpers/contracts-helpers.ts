import {Contract, Signer, utils, ethers} from 'ethers';
import {CommonsConfig} from '../config/commons';
import {getDb, BRE} from './misc-utils';
import {
  tEthereumAddress,
  eContractid,
  tStringTokenSmallUnits,
  eEthereumNetwork,
  AavePools,
  iParamsPerNetwork,
  iParamsPerPool,
  TokenContractId,
  iMultiPoolsAssets,
  IReserveParams,
  ICommonConfiguration,
  PoolConfiguration,
} from './types';

import {LendingPoolAddressesProvider} from '../types/LendingPoolAddressesProvider';
import {MintableErc20 as MintableERC20} from '../types/MintableErc20';
import {LendingPoolAddressesProviderRegistry} from '../types/LendingPoolAddressesProviderRegistry';
import {LendingPoolConfigurator} from '../types/LendingPoolConfigurator';
import {readArtifact} from '@nomiclabs/buidler/plugins';
import {Artifact} from '@nomiclabs/buidler/types';
import {LendingPool} from '../types/LendingPool';
import {PriceOracle} from '../types/PriceOracle';
import {MockAggregator} from '../types/MockAggregator';
import {LendingRateOracle} from '../types/LendingRateOracle';
import {DefaultReserveInterestRateStrategy} from '../types/DefaultReserveInterestRateStrategy';
import {LendingPoolCollateralManager} from '../types/LendingPoolCollateralManager';
import {InitializableAdminUpgradeabilityProxy} from '../types/InitializableAdminUpgradeabilityProxy';
import {MockFlashLoanReceiver} from '../types/MockFlashLoanReceiver';
import {WalletBalanceProvider} from '../types/WalletBalanceProvider';
import {AToken} from '../types/AToken';
import {AaveProtocolTestHelpers} from '../types/AaveProtocolTestHelpers';
import BigNumber from 'bignumber.js';
import {Ierc20Detailed} from '../types/Ierc20Detailed';
import {StableDebtToken} from '../types/StableDebtToken';
import {VariableDebtToken} from '../types/VariableDebtToken';
import {MockContract} from 'ethereum-waffle';
import {getReservesConfigByPool} from './configuration';
import {verifyContract} from './etherscan-verification';

const {
  ProtocolGlobalParams: {UsdAddress},
} = CommonsConfig;

export type MockTokenMap = {[symbol: string]: MintableERC20};
import {ZERO_ADDRESS} from './constants';
import {signTypedData_v4, TypedData} from 'eth-sig-util';
import {fromRpcSig, ECDSASignature} from 'ethereumjs-util';
import {SignerWithAddress} from '../test/helpers/make-suite';

export const registerContractInJsonDb = async (contractId: string, contractInstance: Contract) => {
  const currentNetwork = BRE.network.name;
  if (currentNetwork !== 'buidlerevm' && !currentNetwork.includes('coverage')) {
    console.log(`*** ${contractId} ***\n`);
    console.log(`Network: ${currentNetwork}`);
    console.log(`tx: ${contractInstance.deployTransaction.hash}`);
    console.log(`contract address: ${contractInstance.address}`);
    console.log(`deployer address: ${contractInstance.deployTransaction.from}`);
    console.log(`gas price: ${contractInstance.deployTransaction.gasPrice}`);
    console.log(`gas used: ${contractInstance.deployTransaction.gasLimit}`);
    console.log(`\n******`);
    console.log();
  }

  await getDb()
    .set(`${contractId}.${currentNetwork}`, {
      address: contractInstance.address,
      deployer: contractInstance.deployTransaction.from,
    })
    .write();
};

export const insertContractAddressInDb = async (id: eContractid, address: tEthereumAddress) =>
  await getDb()
    .set(`${id}.${BRE.network.name}`, {
      address,
    })
    .write();

export const getEthersSigners = async (): Promise<Signer[]> =>
  await Promise.all(await BRE.ethers.getSigners());

export const getEthersSignersAddresses = async (): Promise<tEthereumAddress[]> =>
  await Promise.all((await BRE.ethers.getSigners()).map((signer) => signer.getAddress()));

export const getCurrentBlock = async () => {
  return BRE.ethers.provider.getBlockNumber();
};

export const decodeAbiNumber = (data: string): number =>
  parseInt(utils.defaultAbiCoder.decode(['uint256'], data).toString());

export const deployContract = async <ContractType extends Contract>(
  contractName: string,
  args: any[]
): Promise<ContractType> => {
  const contract = (await (await BRE.ethers.getContractFactory(contractName)).deploy(
    ...args
  )) as ContractType;

  await registerContractInJsonDb(<eContractid>contractName, contract);
  return contract;
};

export const getContract = async <ContractType extends Contract>(
  contractName: string,
  address: string
): Promise<ContractType> => (await BRE.ethers.getContractAt(contractName, address)) as ContractType;

export const deployLendingPoolAddressesProvider = async (verify?: boolean) => {
  const instance = await deployContract<LendingPoolAddressesProvider>(
    eContractid.LendingPoolAddressesProvider,
    []
  );
  if (verify) {
    await verifyContract(eContractid.LendingPoolAddressesProvider, instance.address, []);
  }
  return instance;
};

export const deployLendingPoolAddressesProviderRegistry = async (verify?: boolean) => {
  const instance = await deployContract<LendingPoolAddressesProviderRegistry>(
    eContractid.LendingPoolAddressesProviderRegistry,
    []
  );
  if (verify) {
    await verifyContract(eContractid.LendingPoolAddressesProviderRegistry, instance.address, []);
  }
  return instance;
};

export const deployLendingPoolConfigurator = async (verify?: boolean) => {
  const instance = await deployContract<LendingPoolConfigurator>(
    eContractid.LendingPoolConfigurator,
    []
  );
  if (verify) {
    await verifyContract(eContractid.LendingPoolConfigurator, instance.address, []);
  }
  return instance;
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

export const deployPriceOracle = async (verify?: boolean) => {
  const instance = await deployContract<PriceOracle>(eContractid.PriceOracle, []);
  if (verify) {
    await verifyContract(eContractid.PriceOracle, instance.address, []);
  }
  return instance;
};

export const deployLendingRateOracle = async (verify?: boolean) => {
  const instance = await deployContract<LendingRateOracle>(eContractid.LendingRateOracle, []);
  if (verify) {
    await verifyContract(eContractid.LendingRateOracle, instance.address, []);
  }
  return instance;
};

export const deployMockAggregator = async (price: tStringTokenSmallUnits, verify?: boolean) => {
  const args = [price];
  const instance = await deployContract<MockAggregator>(eContractid.MockAggregator, args);
  if (verify) {
    await verifyContract(eContractid.MockAggregator, instance.address, args);
  }
  return instance;
};

export const deployChainlinkProxyPriceProvider = async (
  [assetsAddresses, sourcesAddresses, fallbackOracleAddress]: [
    tEthereumAddress[],
    tEthereumAddress[],
    tEthereumAddress
  ],
  verify?: boolean
) => {
  const args = [assetsAddresses, sourcesAddresses, fallbackOracleAddress];
  const instance = await deployContract<MockAggregator>(
    eContractid.ChainlinkProxyPriceProvider,
    args
  );
  if (verify) {
    await verifyContract(eContractid.MockAggregator, instance.address, args);
  }
  return instance;
};

export const getChainlingProxyPriceProvider = async (address?: tEthereumAddress) =>
  await getContract<MockAggregator>(
    eContractid.ChainlinkProxyPriceProvider,
    address ||
      (await getDb().get(`${eContractid.ChainlinkProxyPriceProvider}.${BRE.network.name}`).value())
        .address
  );

export const deployLendingPoolCollateralManager = async (verify?: boolean) => {
  const collateralManagerArtifact = await readArtifact(
    BRE.config.paths.artifacts,
    eContractid.LendingPoolCollateralManager
  );

  const factory = await linkLibrariesToArtifact(collateralManagerArtifact);
  const args: string[] = [];
  const collateralManager = await factory.deploy(args);
  const instance = (await collateralManager.deployed()) as LendingPoolCollateralManager;

  if (verify) {
    await verifyContract(eContractid.LendingPoolCollateralManager, instance.address, args);
  }
  return instance;
};

export const deployInitializableAdminUpgradeabilityProxy = async (verify?: boolean) => {
  const instance = await deployContract<InitializableAdminUpgradeabilityProxy>(
    eContractid.InitializableAdminUpgradeabilityProxy,
    []
  );
  if (verify) {
    await verifyContract(eContractid.InitializableAdminUpgradeabilityProxy, instance.address, []);
  }
  return instance;
};

export const deployMockFlashLoanReceiver = async (
  addressesProvider: tEthereumAddress,
  verify?: boolean
) => {
  const args = [addressesProvider];
  const instance = await deployContract<MockFlashLoanReceiver>(
    eContractid.MockFlashLoanReceiver,
    args
  );
  if (verify) {
    await verifyContract(eContractid.MockFlashLoanReceiver, instance.address, args);
  }
  return instance;
};

export const deployWalletBalancerProvider = async (
  addressesProvider: tEthereumAddress,
  verify?: boolean
) => {
  const args = [addressesProvider];
  const instance = await deployContract<WalletBalanceProvider>(
    eContractid.WalletBalanceProvider,
    args
  );
  if (verify) {
    await verifyContract(eContractid.WalletBalanceProvider, instance.address, args);
  }
  return instance;
};

export const deployAaveProtocolTestHelpers = async (
  addressesProvider: tEthereumAddress,
  verify?: boolean
) => {
  const args = [addressesProvider];
  const instance = await deployContract<AaveProtocolTestHelpers>(
    eContractid.AaveProtocolTestHelpers,
    args
  );

  if (verify) {
    await verifyContract(eContractid.AaveProtocolTestHelpers, instance.address, args);
  }
  return instance;
};

export const deployMintableERC20 = async ([name, symbol, decimals]: [string, string, number]) =>
  await deployContract<MintableERC20>(eContractid.MintableERC20, [name, symbol, decimals]);

export const deployDefaultReserveInterestRateStrategy = async (
  [
    addressesProvider,
    baseVariableBorrowRate,
    variableSlope1,
    variableSlope2,
    stableSlope1,
    stableSlope2,
  ]: [tEthereumAddress, string, string, string, string, string],
  verify: boolean
) => {
  const id = eContractid.DefaultReserveInterestRateStrategy;
  const args = [
    addressesProvider,
    baseVariableBorrowRate,
    variableSlope1,
    variableSlope2,
    stableSlope1,
    stableSlope2,
  ];
  const instance = await deployContract<DefaultReserveInterestRateStrategy>(id, args);

  if (verify) {
    await verifyContract(id, instance.address, args);
  }
  return instance;
};

export const deployStableDebtToken = async (
  [name, symbol, underlyingAsset, poolAddress, incentivesController]: [
    string,
    string,
    tEthereumAddress,
    tEthereumAddress,
    tEthereumAddress
  ],
  verify: boolean
) => {
  const id = eContractid.StableDebtToken;
  const args = [poolAddress, underlyingAsset, name, symbol, incentivesController];
  const instance = await deployContract<StableDebtToken>(id, args);

  if (verify) {
    await verifyContract(id, instance.address, args);
  }
  return instance;
};

export const deployVariableDebtToken = async (
  [name, symbol, underlyingAsset, poolAddress, incentivesController]: [
    string,
    string,
    tEthereumAddress,
    tEthereumAddress,
    tEthereumAddress
  ],
  verify: boolean
) => {
  const id = eContractid.VariableDebtToken;
  const args = [poolAddress, underlyingAsset, name, symbol, incentivesController];
  const instance = await deployContract<VariableDebtToken>(id, args);

  if (verify) {
    await verifyContract(id, instance.address, args);
  }
  return instance;
};

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
  const id = eContractid.AToken;
  const args = [
    poolAddress,
    underlyingAssetAddress,
    ZERO_ADDRESS,
    name,
    symbol,
    incentivesController,
  ];
  const instance = await deployContract<AToken>(id, args);

  if (verify) {
    await verifyContract(id, instance.address, args);
  }
  return instance;
};

export const getLendingPoolAddressesProvider = async (address?: tEthereumAddress) => {
  return await getContract<LendingPoolAddressesProvider>(
    eContractid.LendingPoolAddressesProvider,
    address ||
      (await getDb().get(`${eContractid.LendingPoolAddressesProvider}.${BRE.network.name}`).value())
        .address
  );
};

export const getLendingPoolConfiguratorProxy = async (address?: tEthereumAddress) => {
  return await getContract<LendingPoolConfigurator>(
    eContractid.LendingPoolConfigurator,
    address ||
      (await getDb().get(`${eContractid.LendingPoolConfigurator}.${BRE.network.name}`).value())
        .address
  );
};

export const getLendingPool = async (address?: tEthereumAddress) => {
  const lendingPoolArtifact = await readArtifact(
    BRE.config.paths.artifacts,
    eContractid.LendingPool
  );

  const factory = await linkLibrariesToArtifact(lendingPoolArtifact);

  return <LendingPool>(
    await factory.attach(
      address ||
        (await getDb().get(`${eContractid.LendingPool}.${BRE.network.name}`).value()).address
    )
  );
};

export const getPriceOracle = async (address?: tEthereumAddress) => {
  return await getContract<PriceOracle>(
    eContractid.PriceOracle,
    address || (await getDb().get(`${eContractid.PriceOracle}.${BRE.network.name}`).value()).address
  );
};

export const getAToken = async (address?: tEthereumAddress) => {
  return await getContract<AToken>(
    eContractid.AToken,
    address || (await getDb().get(`${eContractid.AToken}.${BRE.network.name}`).value()).address
  );
};

export const getStableDebtToken = async (address?: tEthereumAddress) => {
  return await getContract<AToken>(
    eContractid.StableDebtToken,
    address ||
      (await getDb().get(`${eContractid.StableDebtToken}.${BRE.network.name}`).value()).address
  );
};

export const getVariableDebtToken = async (address?: tEthereumAddress) => {
  return await getContract<AToken>(
    eContractid.VariableDebtToken,
    address ||
      (await getDb().get(`${eContractid.VariableDebtToken}.${BRE.network.name}`).value()).address
  );
};

export const getMintableErc20 = async (address: tEthereumAddress) => {
  return await getContract<MintableERC20>(
    eContractid.MintableERC20,
    address ||
      (await getDb().get(`${eContractid.MintableERC20}.${BRE.network.name}`).value()).address
  );
};

export const getIErc20Detailed = async (address: tEthereumAddress) => {
  return await getContract<Ierc20Detailed>(
    eContractid.IERC20Detailed,
    address ||
      (await getDb().get(`${eContractid.IERC20Detailed}.${BRE.network.name}`).value()).address
  );
};

export const getAaveProtocolTestHelpers = async (address?: tEthereumAddress) => {
  return await getContract<AaveProtocolTestHelpers>(
    eContractid.AaveProtocolTestHelpers,
    address ||
      (await getDb().get(`${eContractid.AaveProtocolTestHelpers}.${BRE.network.name}`).value())
        .address
  );
};

export const getInterestRateStrategy = async (address?: tEthereumAddress) => {
  return await getContract<DefaultReserveInterestRateStrategy>(
    eContractid.DefaultReserveInterestRateStrategy,
    address ||
      (
        await getDb()
          .get(`${eContractid.DefaultReserveInterestRateStrategy}.${BRE.network.name}`)
          .value()
      ).address
  );
};

export const getMockFlashLoanReceiver = async (address?: tEthereumAddress) => {
  return await getContract<MockFlashLoanReceiver>(
    eContractid.MockFlashLoanReceiver,
    address ||
      (await getDb().get(`${eContractid.MockFlashLoanReceiver}.${BRE.network.name}`).value())
        .address
  );
};

export const getLendingRateOracle = async (address?: tEthereumAddress) => {
  return await getContract<LendingRateOracle>(
    eContractid.LendingRateOracle,
    address ||
      (await getDb().get(`${eContractid.LendingRateOracle}.${BRE.network.name}`).value()).address
  );
};

const linkBytecode = (artifact: Artifact, libraries: any) => {
  let bytecode = artifact.bytecode;

  for (const [fileName, fileReferences] of Object.entries(artifact.linkReferences)) {
    for (const [libName, fixups] of Object.entries(fileReferences)) {
      const addr = libraries[libName];

      if (addr === undefined) {
        continue;
      }

      for (const fixup of fixups) {
        bytecode =
          bytecode.substr(0, 2 + fixup.start * 2) +
          addr.substr(2) +
          bytecode.substr(2 + (fixup.start + fixup.length) * 2);
      }
    }
  }

  return bytecode;
};

export const getParamPerNetwork = <T>(
  {kovan, ropsten, main, buidlerevm, coverage}: iParamsPerNetwork<T>,
  network: eEthereumNetwork
) => {
  switch (network) {
    case eEthereumNetwork.coverage:
      return coverage;
    case eEthereumNetwork.buidlerevm:
      return buidlerevm;
    case eEthereumNetwork.kovan:
      return kovan;
    case eEthereumNetwork.ropsten:
      return ropsten;
    case eEthereumNetwork.main:
      return main;
    default:
      return main;
  }
};

export const getParamPerPool = <T>({proto, secondary}: iParamsPerPool<T>, pool: AavePools) => {
  switch (pool) {
    case AavePools.proto:
      return proto;
    case AavePools.secondary:
      return secondary;
    default:
      return proto;
  }
};

export const convertToCurrencyDecimals = async (tokenAddress: tEthereumAddress, amount: string) => {
  const token = await getIErc20Detailed(tokenAddress);
  let decimals = (await token.decimals()).toString();

  return ethers.utils.parseUnits(amount, decimals);
};

export const convertToCurrencyUnits = async (tokenAddress: string, amount: string) => {
  const token = await getIErc20Detailed(tokenAddress);
  let decimals = new BigNumber(await token.decimals());
  const currencyUnit = new BigNumber(10).pow(decimals);
  const amountInCurrencyUnits = new BigNumber(amount).div(currencyUnit);
  return amountInCurrencyUnits.toFixed();
};

export const deployAllMockTokens = async (verify?: boolean) => {
  const tokens: {[symbol: string]: MockContract | MintableERC20} = {};

  const protoConfigData = getReservesConfigByPool(AavePools.proto);
  const secondaryConfigData = getReservesConfigByPool(AavePools.secondary);

  for (const tokenSymbol of Object.keys(TokenContractId)) {
    let decimals = 18;

    let configData = (<any>protoConfigData)[tokenSymbol];

    if (!configData) {
      configData = (<any>secondaryConfigData)[tokenSymbol];
    }

    if (!configData) {
      decimals = 18;
    }

    tokens[tokenSymbol] = await deployMintableERC20([
      tokenSymbol,
      tokenSymbol,
      configData ? configData.reserveDecimals : 18,
    ]);
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);

    if (verify) {
      await verifyContract(eContractid.MintableERC20, tokens[tokenSymbol].address, []);
    }
  }
  return tokens;
};

export const deployMockTokens = async (config: PoolConfiguration, verify?: boolean) => {
  const tokens: {[symbol: string]: MockContract | MintableERC20} = {};
  const defaultDecimals = 18;

  const configData = config.ReservesConfig;

  for (const tokenSymbol of Object.keys(config.ReserveSymbols)) {
    tokens[tokenSymbol] = await deployMintableERC20([
      tokenSymbol,
      tokenSymbol,
      Number(configData[tokenSymbol as keyof iMultiPoolsAssets<IReserveParams>].reserveDecimals) ||
        defaultDecimals,
    ]);
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);

    if (verify) {
      await verifyContract(eContractid.MintableERC20, tokens[tokenSymbol].address, []);
    }
  }
  return tokens;
};

export const getMockedTokens = async (config: PoolConfiguration) => {
  const tokenSymbols = config.ReserveSymbols;
  const db = getDb();
  const tokens: MockTokenMap = await tokenSymbols.reduce<Promise<MockTokenMap>>(
    async (acc, tokenSymbol) => {
      const accumulator = await acc;
      const address = db.get(`${tokenSymbol.toUpperCase()}.${BRE.network.name}`).value().address;
      accumulator[tokenSymbol] = await getContract<MintableERC20>(
        eContractid.MintableERC20,
        address
      );
      return Promise.resolve(acc);
    },
    Promise.resolve({})
  );
  return tokens;
};

export const getAllMockedTokens = async () => {
  const db = getDb();
  const tokens: MockTokenMap = await Object.keys(TokenContractId).reduce<Promise<MockTokenMap>>(
    async (acc, tokenSymbol) => {
      const accumulator = await acc;
      const address = db.get(`${tokenSymbol.toUpperCase()}.${BRE.network.name}`).value().address;
      accumulator[tokenSymbol] = await getContract<MintableERC20>(
        eContractid.MintableERC20,
        address
      );
      return Promise.resolve(acc);
    },
    Promise.resolve({})
  );
  return tokens;
};

export const getPairsTokenAggregator = (
  allAssetsAddresses: {
    [tokenSymbol: string]: tEthereumAddress;
  },
  aggregatorsAddresses: {[tokenSymbol: string]: tEthereumAddress}
): [string[], string[]] => {
  const {ETH, USD, WETH, ...assetsAddressesWithoutEth} = allAssetsAddresses;

  const pairs = Object.entries(assetsAddressesWithoutEth).map(([tokenSymbol, tokenAddress]) => {
    if (tokenSymbol !== 'WETH' && tokenSymbol !== 'ETH') {
      const aggregatorAddressIndex = Object.keys(aggregatorsAddresses).findIndex(
        (value) => value === tokenSymbol
      );
      const [, aggregatorAddress] = (Object.entries(aggregatorsAddresses) as [
        string,
        tEthereumAddress
      ][])[aggregatorAddressIndex];
      return [tokenAddress, aggregatorAddress];
    }
  }) as [string, string][];

  const mappedPairs = pairs.map(([asset]) => asset);
  const mappedAggregators = pairs.map(([, source]) => source);

  return [mappedPairs, mappedAggregators];
};

export const initReserves = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: {[symbol: string]: tEthereumAddress},
  lendingPoolAddressesProvider: LendingPoolAddressesProvider,
  lendingPool: LendingPool,
  helpers: AaveProtocolTestHelpers,
  lendingPoolConfigurator: LendingPoolConfigurator,
  aavePool: AavePools,
  incentivesController: tEthereumAddress,
  verify: boolean
) => {
  if (aavePool !== AavePools.proto && aavePool !== AavePools.secondary) {
    console.log(`Invalid Aave pool ${aavePool}`);
    process.exit(1);
  }

  for (let [assetSymbol, {reserveDecimals}] of Object.entries(reservesParams) as [
    string,
    IReserveParams
  ][]) {
    const assetAddressIndex = Object.keys(tokenAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, tokenAddress] = (Object.entries(tokenAddresses) as [string, string][])[
      assetAddressIndex
    ];

    const {isActive: reserveInitialized} = await helpers.getReserveConfigurationData(tokenAddress);

    if (reserveInitialized) {
      console.log(`Reserve ${assetSymbol} is already active, skipping configuration`);
      continue;
    }

    try {
      const reserveParamIndex = Object.keys(reservesParams).findIndex(
        (value) => value === assetSymbol
      );
      const [
        ,
        {
          baseVariableBorrowRate,
          variableRateSlope1,
          variableRateSlope2,
          stableRateSlope1,
          stableRateSlope2,
        },
      ] = (Object.entries(reservesParams) as [string, IReserveParams][])[reserveParamIndex];
      console.log('deploy def reserve');
      const rateStrategyContract = await deployDefaultReserveInterestRateStrategy(
        [
          lendingPoolAddressesProvider.address,
          baseVariableBorrowRate,
          variableRateSlope1,
          variableRateSlope2,
          stableRateSlope1,
          stableRateSlope2,
        ],
        verify
      );

      console.log('deploy stable deb totken ', assetSymbol);
      const stableDebtToken = await deployStableDebtToken(
        [
          `Aave stable debt bearing ${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
          `stableDebt${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
          tokenAddress,
          lendingPool.address,
          incentivesController,
        ],
        verify
      );

      console.log('deploy var deb totken ', assetSymbol);
      const variableDebtToken = await deployVariableDebtToken(
        [
          `Aave variable debt bearing ${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
          `variableDebt${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
          tokenAddress,
          lendingPool.address,
          incentivesController,
        ],
        verify
      );

      console.log('deploy a token ', assetSymbol);
      const aToken = await deployGenericAToken(
        [
          lendingPool.address,
          tokenAddress,
          `Aave interest bearing ${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
          `a${assetSymbol === 'WETH' ? 'ETH' : assetSymbol}`,
          incentivesController,
        ],
        verify
      );

      if (process.env.POOL === AavePools.secondary) {
        if (assetSymbol.search('UNI') === -1) {
          assetSymbol = `Uni${assetSymbol}`;
        } else {
          assetSymbol = assetSymbol.replace(/_/g, '').replace('UNI', 'Uni');
        }
      }

      console.log('init reserve currency ', assetSymbol);
      await lendingPoolConfigurator.initReserve(
        tokenAddress,
        aToken.address,
        stableDebtToken.address,
        variableDebtToken.address,
        reserveDecimals,
        rateStrategyContract.address
      );
    } catch (e) {
      console.log(`Reserve initialization for ${assetSymbol} failed with error ${e}. Skipped.`);
    }
  }
};

export const getLendingPoolAddressesProviderRegistry = async (address?: tEthereumAddress) => {
  return await getContract<LendingPoolAddressesProviderRegistry>(
    eContractid.LendingPoolAddressesProviderRegistry,
    address ||
      (
        await getDb()
          .get(`${eContractid.LendingPoolAddressesProviderRegistry}.${BRE.network.name}`)
          .value()
      ).address
  );
};

export const buildPermitParams = (
  chainId: number,
  token: tEthereumAddress,
  revision: string,
  tokenName: string,
  owner: tEthereumAddress,
  spender: tEthereumAddress,
  nonce: number,
  deadline: string,
  value: tStringTokenSmallUnits
) => ({
  types: {
    EIP712Domain: [
      {name: 'name', type: 'string'},
      {name: 'version', type: 'string'},
      {name: 'chainId', type: 'uint256'},
      {name: 'verifyingContract', type: 'address'},
    ],
    Permit: [
      {name: 'owner', type: 'address'},
      {name: 'spender', type: 'address'},
      {name: 'value', type: 'uint256'},
      {name: 'nonce', type: 'uint256'},
      {name: 'deadline', type: 'uint256'},
    ],
  },
  primaryType: 'Permit' as const,
  domain: {
    name: tokenName,
    version: revision,
    chainId: chainId,
    verifyingContract: token,
  },
  message: {
    owner,
    spender,
    value,
    nonce,
    deadline,
  },
});

export const getSignatureFromTypedData = (
  privateKey: string,
  typedData: any // TODO: should be TypedData, from eth-sig-utils, but TS doesn't accept it
): ECDSASignature => {
  const signature = signTypedData_v4(Buffer.from(privateKey.substring(2, 66), 'hex'), {
    data: typedData,
  });
  return fromRpcSig(signature);
};
