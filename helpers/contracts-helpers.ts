import {Contract, Signer, utils} from "ethers";

import {getDb, BRE} from "./misc-utils";
import {
  tEthereumAddress,
  eContractid,
  tStringTokenSmallUnits,
  eEthereumNetwork,
  AavePools,
  iParamsPerNetwork,
  iParamsPerPool,
} from "./types";
import {Example} from "../types/Example";
import {LendingPoolAddressesProvider} from "../types/LendingPoolAddressesProvider";
import {MintableErc20} from "../types/MintableErc20";
import {LendingPoolAddressesProviderRegistry} from "../types/LendingPoolAddressesProviderRegistry";
import {FeeProvider} from "../types/FeeProvider";
import {LendingPoolParametersProvider} from "../types/LendingPoolParametersProvider";
import {LendingPoolCore} from "../types/LendingPoolCore";
import {LendingPoolConfigurator} from "../types/LendingPoolConfigurator";
import {readArtifact} from "@nomiclabs/buidler/plugins";
import {Artifact} from "@nomiclabs/buidler/types";
import {LendingPoolDataProvider} from "../types/LendingPoolDataProvider";
import {LendingPool} from "../types/LendingPool";
import {PriceOracle} from "../types/PriceOracle";
import {MockAggregator} from "../types/MockAggregator";
import {LendingRateOracle} from "../types/LendingRateOracle";
import {DefaultReserveInterestRateStrategy} from "../types/DefaultReserveInterestRateStrategy";
import {LendingPoolLiquidationManager} from "../types/LendingPoolLiquidationManager";
import {MockOneSplit} from "../types/MockOneSplit";
import {OneSplitAdapter} from "../types/OneSplitAdapter";
import {TokenDistributor} from "../types/TokenDistributor";
import {InitializableAdminUpgradeabilityProxy} from "../types/InitializableAdminUpgradeabilityProxy";
import {MockFlashLoanReceiver} from "../types/MockFlashLoanReceiver";
import {WalletBalanceProvider} from "../types/WalletBalanceProvider";
import {AToken} from "../types/AToken";
import {AaveProtocolTestHelpers} from "../types/AaveProtocolTestHelpers";
import {MOCK_ETH_ADDRESS} from "./constants";
import BigNumber from "bignumber.js";
import {Ierc20Detailed} from "../types/Ierc20Detailed";

export const registerContractInJsonDb = async (
  contractId: string,
  contractInstance: Contract
) => {
  const currentNetwork = BRE.network.name;
  if (
    currentNetwork !== "buidlerevm" &&
    currentNetwork !== "soliditycoverage"
  ) {
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

export const insertContractAddressInDb = async (
  id: eContractid,
  address: tEthereumAddress
) =>
  await getDb()
    .set(`${id}.${BRE.network.name}`, {
      address,
    })
    .write();

export const getEthersSigners = async (): Promise<Signer[]> =>
  await Promise.all(await BRE.ethers.signers());

export const getEthersSignersAddresses = async (): Promise<
  tEthereumAddress[]
> =>
  await Promise.all(
    (await BRE.ethers.signers()).map((signer) => signer.getAddress())
  );

export const getCurrentBlock = async () => {
  return BRE.ethers.provider.getBlockNumber();
};

export const decodeAbiNumber = (data: string): number =>
  parseInt(utils.defaultAbiCoder.decode(["uint256"], data).toString());

const deployContract = async <ContractType extends Contract>(
  contractName: string,
  args: any[]
): Promise<ContractType> => {
  const contract = (await (await BRE.ethers.getContract(contractName)).deploy(
    ...args
  )) as ContractType;

  await registerContractInJsonDb(<eContractid>contractName, contract);
  return contract;
};

const getContract = async <ContractType extends Contract>(
  contractName: string,
  address: string
): Promise<ContractType> =>
  (await BRE.ethers.getContractAt(contractName, address)) as ContractType;

export const deployExampleContract = async () =>
  await deployContract<Example>(eContractid.Example, []);

export const deployLendingPoolAddressesProvider = async () =>
  await deployContract<LendingPoolAddressesProvider>(
    eContractid.LendingPoolAddressesProvider,
    []
  );

export const deployLendingPoolAddressesProviderRegistry = async () =>
  await deployContract<LendingPoolAddressesProviderRegistry>(
    eContractid.LendingPoolAddressesProviderRegistry,
    []
  );

export const deployFeeProvider = async () =>
  await deployContract<FeeProvider>(eContractid.FeeProvider, []);

export const deployLendingPoolParametersProvider = async () =>
  await deployContract<LendingPoolParametersProvider>(
    eContractid.LendingPoolParametersProvider,
    []
  );

export const deployLendingPoolCore = async () => {
  const CoreLibraryFactory = await BRE.ethers.getContractFactory(
    eContractid.CoreLibrary
  );
  const coreLibrary = await CoreLibraryFactory.deploy();
  await coreLibrary.deployed();

  const lendingPoolCoreArtifact = await readArtifact(
    BRE.config.paths.artifacts,
    eContractid.LendingPoolCore
  );
  const linkedBytecode = linkBytecode(lendingPoolCoreArtifact, {
    [eContractid.CoreLibrary]: coreLibrary.address,
  });
  const LendingPoolCoreFactory = await BRE.ethers.getContractFactory(
    lendingPoolCoreArtifact.abi,
    linkedBytecode
  );

  const lendingPoolCore = await LendingPoolCoreFactory.deploy();
  return (await lendingPoolCore.deployed()) as LendingPoolCore;
};

export const deployLendingPoolConfigurator = async () =>
  await deployContract<LendingPoolConfigurator>(
    eContractid.LendingPoolConfigurator,
    []
  );

export const deployLendingPoolDataProvider = async () =>
  await deployContract<LendingPoolDataProvider>(
    eContractid.LendingPoolDataProvider,
    []
  );

export const deployLendingPool = async () =>
  await deployContract<LendingPool>(eContractid.LendingPool, []);

export const deployPriceOracle = async () =>
  await deployContract<PriceOracle>(eContractid.PriceOracle, []);

export const deployMockAggregator = async (price: tStringTokenSmallUnits) =>
  await deployContract<MockAggregator>(eContractid.MockAggregator, [price]);

export const deployChainlinkProxyPriceProvider = async ([
  assetsAddresses,
  sourcesAddresses,
  fallbackOracleAddress,
]: [tEthereumAddress[], tEthereumAddress[], tEthereumAddress]) =>
  await deployContract<MockAggregator>(
    eContractid.ChainlinkProxyPriceProvider,
    [assetsAddresses, sourcesAddresses, fallbackOracleAddress]
  );

export const deployLendingRateOracle = async () =>
  await deployContract<LendingRateOracle>(eContractid.LendingRateOracle, []);

export const deployLendingPoolLiquidationManager = async () =>
  await deployContract<LendingPoolLiquidationManager>(
    eContractid.LendingPoolLiquidationManager,
    []
  );

export const deployTokenDistributor = async () =>
  await deployContract<TokenDistributor>(eContractid.TokenDistributor, []);

export const deployInitializableAdminUpgradeabilityProxy = async () =>
  await deployContract<InitializableAdminUpgradeabilityProxy>(
    eContractid.InitializableAdminUpgradeabilityProxy,
    []
  );

export const deployMockFlashLoanReceiver = async (
  addressesProvider: tEthereumAddress
) =>
  await deployContract<MockFlashLoanReceiver>(
    eContractid.MockFlashLoanReceiver,
    [addressesProvider]
  );

export const deployWalletBalancerProvider = async (
  addressesProvider: tEthereumAddress
) =>
  await deployContract<WalletBalanceProvider>(
    eContractid.WalletBalanceProvider,
    [addressesProvider]
  );

export const deployMockOneSplit = async (tokenToBurn: tEthereumAddress) =>
  await deployContract<MockOneSplit>(eContractid.MockOneSplit, [tokenToBurn]);

export const deployOneSplitAdapter = async () =>
  await deployContract<OneSplitAdapter>(eContractid.OneSplitAdapter, []);

export const deployAaveProtocolTestHelpers = async (
  addressesProvider: tEthereumAddress
) =>
  await deployContract<AaveProtocolTestHelpers>(
    eContractid.AaveProtocolTestHelpers,
    [addressesProvider]
  );

export const deployMintableErc20 = async ([name, symbol, decimals]: [
  string,
  string,
  number
]) =>
  await deployContract<MintableErc20>(eContractid.MintableERC20, [
    name,
    symbol,
    decimals,
  ]);

export const deployDefaultReserveInterestRateStrategy = async ([
  reserve,
  addressesProvider,
  baseVariableBorrowRate,
  variableSlope1,
  variableSlope2,
  stableSlope1,
  stableSlope2,
]: [
  tEthereumAddress,
  tEthereumAddress,
  string,
  string,
  string,
  string,
  string
]) =>
  await deployContract<DefaultReserveInterestRateStrategy>(
    eContractid.DefaultReserveInterestRateStrategy,
    [
      reserve,
      addressesProvider,
      baseVariableBorrowRate,
      variableSlope1,
      variableSlope2,
      stableSlope1,
      stableSlope2,
    ]
  );

export const getLendingPoolAddressesProvider = async (
  address?: tEthereumAddress
) => {
  return await getContract<LendingPoolAddressesProvider>(
    eContractid.LendingPoolAddressesProvider,
    address ||
      (
        await getDb()
          .get(
            `${eContractid.LendingPoolAddressesProvider}.${BRE.network.name}`
          )
          .value()
      ).address
  );
};

export const getLendingPoolConfiguratorProxy = async (
  address?: tEthereumAddress
) => {
  return await getContract<LendingPoolConfigurator>(
    eContractid.LendingPoolConfigurator,
    address ||
      (
        await getDb()
          .get(`${eContractid.LendingPoolConfigurator}.${BRE.network.name}`)
          .value()
      ).address
  );
};

export const getLendingPool = async (address?: tEthereumAddress) => {
  return await getContract<LendingPool>(
    eContractid.LendingPool,
    address ||
      (
        await getDb()
          .get(`${eContractid.LendingPool}.${BRE.network.name}`)
          .value()
      ).address
  );
};

export const getLendingPoolCore = async (address?: tEthereumAddress) => {
  const CoreLibraryFactory = await BRE.ethers.getContractFactory(
    eContractid.CoreLibrary
  );
  const coreLibrary = await CoreLibraryFactory.deploy();
  await coreLibrary.deployed();

  const lendingPoolCoreArtifact = await readArtifact(
    BRE.config.paths.artifacts,
    eContractid.LendingPoolCore
  );
  const linkedBytecode = linkBytecode(lendingPoolCoreArtifact, {
    [eContractid.CoreLibrary]: coreLibrary.address,
  });
  const LendingPoolCoreFactory = await BRE.ethers.getContractFactory(
    lendingPoolCoreArtifact.abi,
    linkedBytecode
  );

  return <LendingPoolCore>(
    await LendingPoolCoreFactory.attach(
      address ||
        (
          await getDb()
            .get(`${eContractid.LendingPoolCore}.${BRE.network.name}`)
            .value()
        ).address
    )
  );
};

export const getFeeProvider = async (address?: tEthereumAddress) => {
  return await getContract<FeeProvider>(
    eContractid.FeeProvider,
    address ||
      (
        await getDb()
          .get(`${eContractid.FeeProvider}.${BRE.network.name}`)
          .value()
      ).address
  );
};

export const getLendingPoolParametersProvider = async (
  address?: tEthereumAddress
) => {
  return await getContract<LendingPoolParametersProvider>(
    eContractid.LendingPoolParametersProvider,
    address ||
      (
        await getDb()
          .get(
            `${eContractid.LendingPoolParametersProvider}.${BRE.network.name}`
          )
          .value()
      ).address
  );
};

export const getLendingPoolDataProvider = async (
  address?: tEthereumAddress
) => {
  return await getContract<LendingPoolDataProvider>(
    eContractid.LendingPoolDataProvider,
    address ||
      (
        await getDb()
          .get(`${eContractid.LendingPoolDataProvider}.${BRE.network.name}`)
          .value()
      ).address
  );
};

export const getPriceOracle = async (address?: tEthereumAddress) => {
  return await getContract<PriceOracle>(
    eContractid.PriceOracle,
    address ||
      (
        await getDb()
          .get(`${eContractid.PriceOracle}.${BRE.network.name}`)
          .value()
      ).address
  );
};

export const getAToken = async (address?: tEthereumAddress) => {
  return await getContract<AToken>(
    eContractid.AToken,
    address ||
      (await getDb().get(`${eContractid.AToken}.${BRE.network.name}`).value())
        .address
  );
};

export const getMintableErc20 = async (address?: tEthereumAddress) => {
  return await getContract<MintableErc20>(
    eContractid.MintableERC20,
    address ||
      (
        await getDb()
          .get(`${eContractid.MintableERC20}.${BRE.network.name}`)
          .value()
      ).address
  );
};

export const getIErc20Detailed = async (address?: tEthereumAddress) => {
  return await getContract<Ierc20Detailed>(
    eContractid.IERC20Detailed,
    address ||
      (
        await getDb()
          .get(`${eContractid.IERC20Detailed}.${BRE.network.name}`)
          .value()
      ).address
  );
};

export const getAaveProtocolTestHelpers = async (
  address?: tEthereumAddress
) => {
  return await getContract<AaveProtocolTestHelpers>(
    eContractid.AaveProtocolTestHelpers,
    address ||
      (
        await getDb()
          .get(`${eContractid.AaveProtocolTestHelpers}.${BRE.network.name}`)
          .value()
      ).address
  );
};

export const getInterestRateStrategy = async (address?: tEthereumAddress) => {
  return await getContract<DefaultReserveInterestRateStrategy>(
    eContractid.DefaultReserveInterestRateStrategy,
    address ||
      (
        await getDb()
          .get(
            `${eContractid.DefaultReserveInterestRateStrategy}.${BRE.network.name}`
          )
          .value()
      ).address
  );
};

const linkBytecode = (artifact: Artifact, libraries: any) => {
  let bytecode = artifact.bytecode;

  for (const [fileName, fileReferences] of Object.entries(
    artifact.linkReferences
  )) {
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
  {kovan, ropsten, main}: iParamsPerNetwork<T>,
  network: eEthereumNetwork
) => {
  switch (network) {
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

export const getParamPerPool = <T>(
  {proto, secondary}: iParamsPerPool<T>,
  pool: AavePools
) => {
  switch (pool) {
    case AavePools.proto:
      return proto;
    case AavePools.secondary:
      return secondary;
    default:
      return proto;
  }
};

export const convertToCurrencyDecimals = async (
  tokenAddress: tEthereumAddress,
  amount: string
) => {
  const isEth = tokenAddress === MOCK_ETH_ADDRESS;
  let decimals = new BigNumber(18);

  if (!isEth) {
    const token = await getIErc20Detailed(tokenAddress);
    decimals = new BigNumber(await token.decimals());
  }

  const currencyUnit = new BigNumber(10).pow(decimals);
  const amountInCurrencyDecimals = new BigNumber(amount).multipliedBy(
    currencyUnit
  );
  return amountInCurrencyDecimals.toFixed();
};

export const convertToCurrencyUnits = async (
  tokenAddress: string,
  amount: string
) => {
  const isEth = tokenAddress === MOCK_ETH_ADDRESS;

  let decimals = new BigNumber(18);
  if (!isEth) {
    const token = await getIErc20Detailed(tokenAddress);
    decimals = new BigNumber(await token.decimals());
  }
  const currencyUnit = new BigNumber(10).pow(decimals);
  const amountInCurrencyUnits = new BigNumber(amount).div(currencyUnit);
  return amountInCurrencyUnits.toFixed();
};
