import {Contract, Signer, utils, ethers} from 'ethers';

import {getDb, BRE} from './misc-utils';
import {
  tEthereumAddress,
  eContractid,
  tStringTokenSmallUnits,
  eEthereumNetwork,
  AavePools,
  iParamsPerNetwork,
  iParamsPerPool,
} from './types';
import {LendingPoolAddressesProvider} from '../types/LendingPoolAddressesProvider';
import {MintableErc20} from '../types/MintableErc20';
import {LendingPoolAddressesProviderRegistry} from '../types/LendingPoolAddressesProviderRegistry';
import {LendingPoolConfigurator} from '../types/LendingPoolConfigurator';
import {readArtifact} from '@nomiclabs/buidler/plugins';
import {Artifact} from '@nomiclabs/buidler/types';
import {LendingPool} from '../types/LendingPool';
import {PriceOracle} from '../types/PriceOracle';
import {MockAggregator} from '../types/MockAggregator';
import {LendingRateOracle} from '../types/LendingRateOracle';
import {DefaultReserveInterestRateStrategy} from '../types/DefaultReserveInterestRateStrategy';
import {LendingPoolLiquidationManager} from '../types/LendingPoolLiquidationManager';
import {InitializableAdminUpgradeabilityProxy} from '../types/InitializableAdminUpgradeabilityProxy';
import {MockFlashLoanReceiver} from '../types/MockFlashLoanReceiver';
import {WalletBalanceProvider} from '../types/WalletBalanceProvider';
import {AToken} from '../types/AToken';
import {AaveProtocolTestHelpers} from '../types/AaveProtocolTestHelpers';
import BigNumber from 'bignumber.js';
import {Ierc20Detailed} from '../types/Ierc20Detailed';
import {StableDebtToken} from '../types/StableDebtToken';
import {VariableDebtToken} from '../types/VariableDebtToken';
import {MockSwapAdapter} from '../types/MockSwapAdapter';
import {signTypedData_v4, TypedData} from 'eth-sig-util';
import {fromRpcSig, ECDSASignature} from 'ethereumjs-util';

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

export const deployLendingPoolAddressesProvider = async () =>
  await deployContract<LendingPoolAddressesProvider>(eContractid.LendingPoolAddressesProvider, []);

export const deployLendingPoolAddressesProviderRegistry = async () =>
  await deployContract<LendingPoolAddressesProviderRegistry>(
    eContractid.LendingPoolAddressesProviderRegistry,
    []
  );

export const deployLendingPoolConfigurator = async () =>
  await deployContract<LendingPoolConfigurator>(eContractid.LendingPoolConfigurator, []);

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

export const deployLendingPool = async () => {
  const lendingPoolArtifact = await readArtifact(
    BRE.config.paths.artifacts,
    eContractid.LendingPool
  );

  const factory = await linkLibrariesToArtifact(lendingPoolArtifact);

  const lendingPool = await factory.deploy();
  return (await lendingPool.deployed()) as LendingPool;
};

export const deployPriceOracle = async () =>
  await deployContract<PriceOracle>(eContractid.PriceOracle, []);

export const deployMockAggregator = async (price: tStringTokenSmallUnits) =>
  await deployContract<MockAggregator>(eContractid.MockAggregator, [price]);

export const deployChainlinkProxyPriceProvider = async ([
  assetsAddresses,
  sourcesAddresses,
  fallbackOracleAddress,
]: [tEthereumAddress[], tEthereumAddress[], tEthereumAddress]) =>
  await deployContract<MockAggregator>(eContractid.ChainlinkProxyPriceProvider, [
    assetsAddresses,
    sourcesAddresses,
    fallbackOracleAddress,
  ]);

export const deployLendingRateOracle = async () =>
  await deployContract<LendingRateOracle>(eContractid.LendingRateOracle, []);

export const deployLendingPoolLiquidationManager = async () => {
  const liquidationManagerArtifact = await readArtifact(
    BRE.config.paths.artifacts,
    eContractid.LendingPoolLiquidationManager
  );

  const factory = await linkLibrariesToArtifact(liquidationManagerArtifact);

  const liquidationManager = await factory.deploy();
  return (await liquidationManager.deployed()) as LendingPoolLiquidationManager;
};

export const deployInitializableAdminUpgradeabilityProxy = async () =>
  await deployContract<InitializableAdminUpgradeabilityProxy>(
    eContractid.InitializableAdminUpgradeabilityProxy,
    []
  );

export const deployMockFlashLoanReceiver = async (addressesProvider: tEthereumAddress) =>
  await deployContract<MockFlashLoanReceiver>(eContractid.MockFlashLoanReceiver, [
    addressesProvider,
  ]);

export const deployMockSwapAdapter = async (addressesProvider: tEthereumAddress) =>
  await deployContract<MockSwapAdapter>(eContractid.MockSwapAdapter, [addressesProvider]);

export const deployWalletBalancerProvider = async (addressesProvider: tEthereumAddress) =>
  await deployContract<WalletBalanceProvider>(eContractid.WalletBalanceProvider, [
    addressesProvider,
  ]);

export const deployAaveProtocolTestHelpers = async (addressesProvider: tEthereumAddress) =>
  await deployContract<AaveProtocolTestHelpers>(eContractid.AaveProtocolTestHelpers, [
    addressesProvider,
  ]);

export const deployMintableErc20 = async ([name, symbol, decimals]: [string, string, number]) =>
  await deployContract<MintableErc20>(eContractid.MintableERC20, [name, symbol, decimals]);

export const deployDefaultReserveInterestRateStrategy = async ([
  addressesProvider,
  baseVariableBorrowRate,
  variableSlope1,
  variableSlope2,
  stableSlope1,
  stableSlope2,
]: [tEthereumAddress, string, string, string, string, string]) =>
  await deployContract<DefaultReserveInterestRateStrategy>(
    eContractid.DefaultReserveInterestRateStrategy,
    [
      addressesProvider,
      baseVariableBorrowRate,
      variableSlope1,
      variableSlope2,
      stableSlope1,
      stableSlope2,
    ]
  );

export const deployStableDebtToken = async ([name, symbol, underlyingAsset, poolAddress]: [
  string,
  string,
  tEthereumAddress,
  tEthereumAddress
]) => {
  const token = await deployContract<StableDebtToken>(eContractid.StableDebtToken, [
    poolAddress,
    underlyingAsset,
    name,
    symbol,
  ]);

  return token;
};

export const deployVariableDebtToken = async ([name, symbol, underlyingAsset, poolAddress]: [
  string,
  string,
  tEthereumAddress,
  tEthereumAddress
]) => {
  const token = await deployContract<VariableDebtToken>(eContractid.VariableDebtToken, [
    poolAddress,
    underlyingAsset,
    name,
    symbol,
  ]);

  return token;
};

export const deployGenericAToken = async ([poolAddress, underlyingAssetAddress, name, symbol]: [
  tEthereumAddress,
  tEthereumAddress,
  string,
  string
]) => {
  const token = await deployContract<AToken>(eContractid.AToken, [
    poolAddress,
    underlyingAssetAddress,
    name,
    symbol,
  ]);

  return token;
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

export const getMintableErc20 = async (address: tEthereumAddress) => {
  return await getContract<MintableErc20>(
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

export const getMockSwapAdapter = async (address?: tEthereumAddress) => {
  return await getContract<MockSwapAdapter>(
    eContractid.MockSwapAdapter,
    address ||
      (await getDb().get(`${eContractid.MockSwapAdapter}.${BRE.network.name}`).value()).address
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
