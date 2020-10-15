import {
  AaveProtocolTestHelpersFactory,
  ATokenFactory,
  DefaultReserveInterestRateStrategyFactory,
  LendingPoolAddressesProviderFactory,
  LendingPoolAddressesProviderRegistryFactory,
  LendingPoolConfiguratorFactory,
  LendingPoolFactory,
  LendingRateOracleFactory,
  MintableErc20Factory,
  MockFlashLoanReceiverFactory,
  MockSwapAdapterFactory,
  PriceOracleFactory,
  StableDebtTokenFactory,
  VariableDebtTokenFactory,
} from '../types';
import {Ierc20DetailedFactory} from '../types/Ierc20DetailedFactory';
import {MockTokenMap} from './contracts-helpers';
import {BRE, getDb} from './misc-utils';
import {eContractid, PoolConfiguration, tEthereumAddress, TokenContractId} from './types';

export const getLendingPoolAddressesProvider = async (address?: tEthereumAddress) =>
  await LendingPoolAddressesProviderFactory.connect(
    address ||
      (await getDb().get(`${eContractid.LendingPoolAddressesProvider}.${BRE.network.name}`).value())
        .address,
    BRE.ethers.provider
  );

export const getLendingPoolConfiguratorProxy = async (address?: tEthereumAddress) => {
  return await LendingPoolConfiguratorFactory.connect(
    address ||
      (await getDb().get(`${eContractid.LendingPoolConfigurator}.${BRE.network.name}`).value())
        .address,
    BRE.ethers.provider
  );
};

export const getLendingPool = async (address?: tEthereumAddress) =>
  await LendingPoolFactory.connect(
    address ||
      (await getDb().get(`${eContractid.LendingPool}.${BRE.network.name}`).value()).address,
    BRE.ethers.provider
  );

export const getPriceOracle = async (address?: tEthereumAddress) =>
  await PriceOracleFactory.connect(
    address ||
      (await getDb().get(`${eContractid.PriceOracle}.${BRE.network.name}`).value()).address,
    BRE.ethers.provider
  );

export const getAToken = async (address?: tEthereumAddress) =>
  await ATokenFactory.connect(
    address || (await getDb().get(`${eContractid.AToken}.${BRE.network.name}`).value()).address,
    BRE.ethers.provider
  );

export const getStableDebtToken = async (address?: tEthereumAddress) =>
  await StableDebtTokenFactory.connect(
    address ||
      (await getDb().get(`${eContractid.StableDebtToken}.${BRE.network.name}`).value()).address,
    BRE.ethers.provider
  );

export const getVariableDebtToken = async (address?: tEthereumAddress) =>
  await VariableDebtTokenFactory.connect(
    address ||
      (await getDb().get(`${eContractid.VariableDebtToken}.${BRE.network.name}`).value()).address,
    BRE.ethers.provider
  );

export const getMintableErc20 = async (address: tEthereumAddress) =>
  await MintableErc20Factory.connect(
    address ||
      (await getDb().get(`${eContractid.MintableERC20}.${BRE.network.name}`).value()).address,
    BRE.ethers.provider
  );

export const getIErc20Detailed = async (address: tEthereumAddress) =>
  await Ierc20DetailedFactory.connect(
    address ||
      (await getDb().get(`${eContractid.IERC20Detailed}.${BRE.network.name}`).value()).address,
    BRE.ethers.provider
  );

export const getAaveProtocolTestHelpers = async (address?: tEthereumAddress) =>
  await AaveProtocolTestHelpersFactory.connect(
    address ||
      (await getDb().get(`${eContractid.AaveProtocolTestHelpers}.${BRE.network.name}`).value())
        .address,
    BRE.ethers.provider
  );

export const getInterestRateStrategy = async (address?: tEthereumAddress) =>
  await DefaultReserveInterestRateStrategyFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.DefaultReserveInterestRateStrategy}.${BRE.network.name}`)
          .value()
      ).address,
    BRE.ethers.provider
  );

export const getMockFlashLoanReceiver = async (address?: tEthereumAddress) =>
  await MockFlashLoanReceiverFactory.connect(
    address ||
      (await getDb().get(`${eContractid.MockFlashLoanReceiver}.${BRE.network.name}`).value())
        .address,
    BRE.ethers.provider
  );

export const getMockSwapAdapter = async (address?: tEthereumAddress) =>
  await MockSwapAdapterFactory.connect(
    address ||
      (await getDb().get(`${eContractid.MockSwapAdapter}.${BRE.network.name}`).value()).address,
    BRE.ethers.provider
  );

export const getLendingRateOracle = async (address?: tEthereumAddress) =>
  await LendingRateOracleFactory.connect(
    address ||
      (await getDb().get(`${eContractid.LendingRateOracle}.${BRE.network.name}`).value()).address,
    BRE.ethers.provider
  );

export const getMockedTokens = async (config: PoolConfiguration) => {
  const tokenSymbols = config.ReserveSymbols;
  const db = getDb();
  const tokens: MockTokenMap = await tokenSymbols.reduce<Promise<MockTokenMap>>(
    async (acc, tokenSymbol) => {
      const accumulator = await acc;
      const address = db.get(`${tokenSymbol.toUpperCase()}.${BRE.network.name}`).value().address;
      accumulator[tokenSymbol] = await getMintableErc20(address);
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
      accumulator[tokenSymbol] = await getMintableErc20(address);
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

export const getLendingPoolAddressesProviderRegistry = async (address?: tEthereumAddress) =>
  await LendingPoolAddressesProviderRegistryFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.LendingPoolAddressesProviderRegistry}.${BRE.network.name}`)
          .value()
      ).address,
    BRE.ethers.provider
  );
