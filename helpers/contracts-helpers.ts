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
  PoolConfiguration,
} from './types';

import {MintableErc20 as MintableERC20} from '../types/MintableErc20';
import {readArtifact} from '@nomiclabs/buidler/plugins';
import {Artifact} from '@nomiclabs/buidler/types';
import {DefaultReserveInterestRateStrategy} from '../types/DefaultReserveInterestRateStrategy';
import {MockFlashLoanReceiver} from '../types/MockFlashLoanReceiver';
import {WalletBalanceProvider} from '../types/WalletBalanceProvider';
import {AToken} from '../types/AToken';
import {AaveProtocolTestHelpers} from '../types/AaveProtocolTestHelpers';
import BigNumber from 'bignumber.js';
import {StableDebtToken} from '../types/StableDebtToken';
import {VariableDebtToken} from '../types/VariableDebtToken';
import {MockContract} from 'ethereum-waffle';
import {getReservesConfigByPool} from './configuration';
import {verifyContract} from './etherscan-verification';
import {getFirstSigner, getGenericLogic} from './contracts-getters';
const {
  ProtocolGlobalParams: {UsdAddress},
} = CommonsConfig;

export type MockTokenMap = {[symbol: string]: MintableERC20};
import {ZERO_ADDRESS} from './constants';
import {MockSwapAdapter} from '../types/MockSwapAdapter';
import {signTypedData_v4, TypedData} from 'eth-sig-util';
import {fromRpcSig, ECDSASignature} from 'ethereumjs-util';
import {getIErc20Detailed} from './contracts-getters';
import {
  ChainlinkProxyPriceProviderFactory,
  GenericLogicFactory,
  InitializableAdminUpgradeabilityProxyFactory,
  LendingPoolAddressesProviderFactory,
  LendingPoolAddressesProviderRegistryFactory,
  LendingPoolCollateralManagerFactory,
  LendingPoolConfiguratorFactory,
  LendingPoolFactory,
  LendingPoolLibraryAddresses,
  LendingRateOracleFactory,
  MockAggregatorFactory,
  MockFlashLoanReceiverFactory,
  MockSwapAdapterFactory,
  PriceOracleFactory,
  ReserveLogicFactory,
  WalletBalanceProviderFactory,
} from '../types';

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

export const withSaveAndVerify = async (
  instance: Contract,
  id: string,
  args: (string | string[])[],
  verify?: boolean
) => {
  await registerContractInJsonDb(id, instance);
  if (verify) {
    await verifyContract(id, instance.address, args);
  }
  return instance;
};

export const getContract = async <ContractType extends Contract>(
  contractName: string,
  address: string
): Promise<ContractType> => (await BRE.ethers.getContractAt(contractName, address)) as ContractType;

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

export const deployGenericLogic = async (verify?: boolean) =>
  withSaveAndVerify(
    await new GenericLogicFactory(await getFirstSigner()).deploy(),
    eContractid.GenericLogic,
    [],
    verify
  );

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
  const genericLogic = await deployGenericLogic(verify);
  const validationLogic = await deployValidationLogic(reserveLogic, genericLogic, verify);

  // Hardcoded solidity placeholders, if any library changes path this will fail.
  // Placeholder can be calculated via solidity keccak, but the LendingPoolLibraryAddresses Type seems to
  // require a hardcoded string.
  //
  //  how-to: PLACEHOLDER = solidityKeccak256(['string'], `${libPath}:${libName}`).slice(2, 36)
  // '__$PLACEHOLDER$__'
  // or grab placeholdes from LendingPoolLibraryAddresses at Typechain generation.
  return {
    ['__$5201a97c05ba6aa659e2f36a933dd51801$__']: reserveLogic.address,
    ['__$d3b4366daeb9cadc7528af6145b50b2183$__']: genericLogic.address,
    ['__$4c26be947d349222af871a3168b3fe584b$__']: validationLogic.address,
  };
};

export const deployLendingPool = async (verify?: boolean) => {
  const libraries = await deployAaveLibraries(verify);
  return withSaveAndVerify(
    await new LendingPoolFactory(libraries, await getFirstSigner()).deploy(),
    eContractid.LendingPool,
    [],
    verify
  );
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
  const genericLogic = await getGenericLogic();
  const libraries = {
    // See deployAaveLibraries() function
    ['__$d3b4366daeb9cadc7528af6145b50b2183$__']: genericLogic.address,
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
