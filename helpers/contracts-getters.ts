import {
  SturdyProtocolDataProviderFactory,
  ATokenFactory,
  ATokensAndRatesHelperFactory,
  SturdyOracleFactory,
  DefaultReserveInterestRateStrategyFactory,
  InitializableImmutableAdminUpgradeabilityProxyFactory,
  LendingPoolAddressesProviderFactory,
  LendingPoolAddressesProviderRegistryFactory,
  LendingPoolCollateralManagerFactory,
  LendingPoolConfiguratorFactory,
  LendingRateOracleFactory,
  MintableERC20Factory,
  MockATokenFactory,
  MockStableDebtTokenFactory,
  MockVariableDebtTokenFactory,
  PriceOracleFactory,
  ReserveLogicFactory,
  StableAndVariableTokensHelperFactory,
  StableDebtTokenFactory,
  VariableDebtTokenFactory,
  WETH9MockedFactory,
  LendingPoolFactory,
  LidoVaultFactory,
  StakedTokenIncentivesControllerFactory,
  SturdyTokenFactory,
  WalletBalanceProviderFactory,
  UiPoolDataProviderFactory,
  UiIncentiveDataProviderFactory,
  YearnVaultFactory,
  BeefyETHVaultFactory,
  MockyvWFTMFactory,
  SwapinERC20Factory,
  YearnWETHVaultFactory,
  MockyvWETHFactory,
  MockWETHForFTMFactory,
  ATokenForCollateralFactory,
  YearnWBTCVaultFactory,
  MockyvWBTCFactory,
  MockWBTCForFTMFactory,
  CollateralAdapterFactory,
  YearnBOOVaultFactory,
  BooOracleFactory,
  MockyvBOOFactory,
  TombFtmBeefyVaultFactory,
  MockMooTOMBFTMFactory,
  TombOracleFactory,
  TombFtmLPOracleFactory,
  TombMiMaticLPOracleFactory,
  TombMimaticBeefyVaultFactory,
  MockMooTOMBMIMATICFactory,
  FTMLiquidatorFactory,
  ETHLiquidatorFactory,
  YearnFBEETSVaultFactory,
  YearnLINKVaultFactory,
  DeployVaultHelperFactory,
  YearnCRVVaultFactory,
  YearnSPELLVaultFactory,
  BeetsOracleFactory,
  FBeetsOracleFactory,
  BasedOracleFactory,
  BasedMiMaticLPOracleFactory,
  BasedMimaticBeefyVaultFactory,
  MockMooBASEDMIMATICFactory,
  YearnRETHWstETHVaultFactory,
  CrvREthWstETHOracleFactory,
  ConvexCurveLPVaultFactory,
  YieldManagerFactory,
} from '../types';
import { IERC20DetailedFactory } from '../types/IERC20DetailedFactory';
import { IWETHFactory } from '../types/IWETHFactory';
import { getEthersSigners, MockTokenMap } from './contracts-helpers';
import { DRE, getDb, notFalsyOrZeroAddress, omit } from './misc-utils';
import { eContractid, PoolConfiguration, tEthereumAddress, TokenContractId } from './types';

export const getFirstSigner = async () => (await getEthersSigners())[0];

export const getLendingPoolAddressesProvider = async (address?: tEthereumAddress) => {
  return await LendingPoolAddressesProviderFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.LendingPoolAddressesProvider}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );
};
export const getLendingPoolConfiguratorProxy = async (address?: tEthereumAddress) => {
  return await LendingPoolConfiguratorFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.LendingPoolConfigurator}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );
};

export const getPriceOracle = async (address?: tEthereumAddress) =>
  await PriceOracleFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.PriceOracle}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getAToken = async (address?: tEthereumAddress) =>
  await ATokenFactory.connect(
    address || (await getDb().get(`${eContractid.AToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getATokenForCollateral = async (address?: tEthereumAddress) =>
  await ATokenForCollateralFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.ATokenForCollateral}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getStableDebtToken = async (address?: tEthereumAddress) =>
  await StableDebtTokenFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.StableDebtToken}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getVariableDebtToken = async (address?: tEthereumAddress) =>
  await VariableDebtTokenFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.VariableDebtToken}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getMintableERC20 = async (address: tEthereumAddress) =>
  await MintableERC20Factory.connect(
    address ||
      (
        await getDb().get(`${eContractid.MintableERC20}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getSwapinERC20 = async (address: tEthereumAddress) =>
  await SwapinERC20Factory.connect(
    address ||
      (
        await getDb().get(`${eContractid.SwapinERC20}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getIErc20Detailed = async (address: tEthereumAddress) =>
  await IERC20DetailedFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.IERC20Detailed}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getIWETH = async (address: tEthereumAddress) =>
  await IWETHFactory.connect(address, await getFirstSigner());

export const getSturdyProtocolDataProvider = async (address?: tEthereumAddress) =>
  await SturdyProtocolDataProviderFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.SturdyProtocolDataProvider}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getInterestRateStrategy = async (address?: tEthereumAddress) =>
  await DefaultReserveInterestRateStrategyFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.DefaultReserveInterestRateStrategy}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getLendingRateOracle = async (address?: tEthereumAddress) =>
  await LendingRateOracleFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.LendingRateOracle}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getMockedTokens = async (config: PoolConfiguration) => {
  const tokenSymbols = Object.keys(config.ReservesConfig);
  const db = getDb();
  const tokens: MockTokenMap = await tokenSymbols.reduce<Promise<MockTokenMap>>(
    async (acc, tokenSymbol) => {
      const accumulator = await acc;
      const address = db.get(`${tokenSymbol.toUpperCase()}.${DRE.network.name}`).value().address;
      accumulator[tokenSymbol] = await getMintableERC20(address);
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
      const address = db.get(`${tokenSymbol.toUpperCase()}.${DRE.network.name}`).value().address;
      accumulator[tokenSymbol] = await getMintableERC20(address);
      return Promise.resolve(acc);
    },
    Promise.resolve({})
  );
  return tokens;
};

export const getQuoteCurrencies = (oracleQuoteCurrency: string): string[] => {
  switch (oracleQuoteCurrency) {
    case 'USD':
      return ['USD'];
    case 'ETH':
    case 'WETH':
    default:
      return ['ETH', 'WETH'];
  }
};

export const getPairsTokenAggregator = (
  allAssetsAddresses: {
    [tokenSymbol: string]: tEthereumAddress;
  },
  aggregatorsAddresses: { [tokenSymbol: string]: tEthereumAddress },
  oracleQuoteCurrency: string
): [string[], string[]] => {
  const assetsWithoutQuoteCurrency = omit(
    allAssetsAddresses,
    getQuoteCurrencies(oracleQuoteCurrency)
  );

  const pairs = Object.entries(assetsWithoutQuoteCurrency)
    .map(([tokenSymbol, tokenAddress]) => {
      //if (true/*tokenSymbol !== 'WETH' && tokenSymbol !== 'ETH' && tokenSymbol !== 'LpWETH'*/) {
      const aggregatorAddressIndex = Object.keys(aggregatorsAddresses).findIndex(
        (value) => value === tokenSymbol
      );
      const [, aggregatorAddress] = (
        Object.entries(aggregatorsAddresses) as [string, tEthereumAddress][]
      )[aggregatorAddressIndex];
      return [tokenAddress, aggregatorAddress];
      //}
    })
    .filter(([tokenAddress, aggregatorsAddresses]) => aggregatorsAddresses) as [string, string][];

  const mappedPairs = pairs.map(([asset]) => asset);
  const mappedAggregators = pairs.map(([, source]) => source);

  return [mappedPairs, mappedAggregators];
};

export const getLendingPoolAddressesProviderRegistry = async (address?: tEthereumAddress) =>
  await LendingPoolAddressesProviderRegistryFactory.connect(
    notFalsyOrZeroAddress(address)
      ? address
      : (
          await getDb()
            .get(`${eContractid.LendingPoolAddressesProviderRegistry}.${DRE.network.name}`)
            .value()
        ).address,
    await getFirstSigner()
  );

export const getReserveLogic = async (address?: tEthereumAddress) =>
  await ReserveLogicFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.ReserveLogic}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getStableAndVariableTokensHelper = async (address?: tEthereumAddress) =>
  await StableAndVariableTokensHelperFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.StableAndVariableTokensHelper}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getATokensAndRatesHelper = async (address?: tEthereumAddress) =>
  await ATokensAndRatesHelperFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.ATokensAndRatesHelper}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getWETHMocked = async (address?: tEthereumAddress) =>
  await WETH9MockedFactory.connect(
    address || (await getDb().get(`${eContractid.WETHMocked}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockAToken = async (address?: tEthereumAddress) =>
  await MockATokenFactory.connect(
    address || (await getDb().get(`${eContractid.MockAToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockVariableDebtToken = async (address?: tEthereumAddress) =>
  await MockVariableDebtTokenFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.MockVariableDebtToken}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getMockStableDebtToken = async (address?: tEthereumAddress) =>
  await MockStableDebtTokenFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.MockStableDebtToken}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getProxy = async (address: tEthereumAddress) =>
  await InitializableImmutableAdminUpgradeabilityProxyFactory.connect(
    address,
    await getFirstSigner()
  );

export const getLendingPoolImpl = async (address?: tEthereumAddress) =>
  await LendingPoolFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.LendingPoolImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getLendingPoolConfiguratorImpl = async (address?: tEthereumAddress) =>
  await LendingPoolConfiguratorFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.LendingPoolConfiguratorImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getLendingPoolCollateralManagerImpl = async (address?: tEthereumAddress) =>
  await LendingPoolCollateralManagerFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.LendingPoolCollateralManagerImpl}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getLendingPoolCollateralManager = async (address?: tEthereumAddress) =>
  await LendingPoolCollateralManagerFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.LendingPoolCollateralManager}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getAddressById = async (id: string): Promise<tEthereumAddress | undefined> =>
  (await getDb().get(`${id}.${DRE.network.name}`).value())?.address || undefined;

export const getSturdyOracle = async (address?: tEthereumAddress) =>
  await SturdyOracleFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.SturdyOracle}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getBooOracle = async (address?: tEthereumAddress) =>
  await BooOracleFactory.connect(
    address || (await getDb().get(`${eContractid.BooOracle}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getTombOracle = async (address?: tEthereumAddress) =>
  await TombOracleFactory.connect(
    address || (await getDb().get(`${eContractid.TombOracle}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getTombFtmLPOracle = async (address?: tEthereumAddress) =>
  await TombFtmLPOracleFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.TombFtmLPOracle}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getTombMiMaticLPOracle = async (address?: tEthereumAddress) =>
  await TombMiMaticLPOracleFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.TombMiMaticLPOracle}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getBasedOracle = async (address?: tEthereumAddress) =>
  await BasedOracleFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.BasedOracle}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getBasedMiMaticLPOracle = async (address?: tEthereumAddress) =>
  await BasedMiMaticLPOracleFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.BasedMiMaticLPOracle}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getLendingPool = async (address?: tEthereumAddress) =>
  await LendingPoolFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.LendingPool}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getLidoVaultImpl = async (address?: tEthereumAddress) =>
  await LidoVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.LidoVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getLidoVault = async (address?: tEthereumAddress) =>
  await LidoVaultFactory.connect(
    address || (await getDb().get(`${eContractid.LidoVault}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getYearnRETHWstETHVaultImpl = async (address?: tEthereumAddress) =>
  await YearnRETHWstETHVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnRETHWstETHVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnRETHWstETHVault = async (address?: tEthereumAddress) =>
  await YearnRETHWstETHVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnRETHWstETHVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getConvexRocketPoolETHVaultImpl = async (address?: tEthereumAddress) =>
  await ConvexCurveLPVaultFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.ConvexRocketPoolETHVaulttImpl}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getConvexRocketPoolETHVault = async (address?: tEthereumAddress) =>
  await ConvexCurveLPVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.ConvexRocketPoolETHVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getConvexFRAX3CRVVault = async (address?: tEthereumAddress) =>
  await ConvexCurveLPVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.ConvexFRAX3CRVVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getConvexSTETHVault = async (address?: tEthereumAddress) =>
  await ConvexCurveLPVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.ConvexSTETHVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getConvexDOLA3CRVVault = async (address?: tEthereumAddress) =>
  await ConvexCurveLPVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.ConvexDOLA3CRVVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnVaultImpl = async (address?: tEthereumAddress) =>
  await YearnVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnVault = async (address?: tEthereumAddress) =>
  await YearnVaultFactory.connect(
    address || (await getDb().get(`${eContractid.YearnVault}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getYearnWETHVaultImpl = async (address?: tEthereumAddress) =>
  await YearnWETHVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnWETHVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnWETHVault = async (address?: tEthereumAddress) =>
  await YearnWETHVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnWETHVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnWBTCVaultImpl = async (address?: tEthereumAddress) =>
  await YearnWBTCVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnWBTCVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnWBTCVault = async (address?: tEthereumAddress) =>
  await YearnWBTCVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnWBTCVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnBOOVaultImpl = async (address?: tEthereumAddress) =>
  await YearnBOOVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnBOOVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnBOOVault = async (address?: tEthereumAddress) =>
  await YearnBOOVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnBOOVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getTombFtmBeefyVaultImpl = async (address?: tEthereumAddress) =>
  await TombFtmBeefyVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.TombFtmBeefyVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getTombFtmBeefyVault = async (address?: tEthereumAddress) =>
  await TombFtmBeefyVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.TombFtmBeefyVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getTombMiMaticBeefyVaultImpl = async (address?: tEthereumAddress) =>
  await TombMimaticBeefyVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.TombMiMaticBeefyVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getTombMiMaticBeefyVault = async (address?: tEthereumAddress) =>
  await TombMimaticBeefyVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.TombMiMaticBeefyVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getBasedMiMaticBeefyVaultImpl = async (address?: tEthereumAddress) =>
  await BasedMimaticBeefyVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.BasedMiMaticBeefyVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getBasedMiMaticBeefyVault = async (address?: tEthereumAddress) =>
  await BasedMimaticBeefyVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.BasedMiMaticBeefyVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnFBEETSVaultImpl = async (address?: tEthereumAddress) =>
  await YearnFBEETSVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnFBEETSVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnFBEETSVault = async (address?: tEthereumAddress) =>
  await YearnFBEETSVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnFBEETSVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnLINKVaultImpl = async (address?: tEthereumAddress) =>
  await YearnLINKVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnLINKVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnLINKVault = async (address?: tEthereumAddress) =>
  await YearnLINKVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnLINKVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getBeefyETHVault = async (address?: tEthereumAddress) =>
  await BeefyETHVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.BeefyETHVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnCRVVaultImpl = async (address?: tEthereumAddress) =>
  await YearnCRVVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnCRVVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnCRVVault = async (address?: tEthereumAddress) =>
  await YearnCRVVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnCRVVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnSPELLVaultImpl = async (address?: tEthereumAddress) =>
  await YearnSPELLVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnSPELLVaultImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYearnSPELLVault = async (address?: tEthereumAddress) =>
  await YearnSPELLVaultFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YearnSPELLVault}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getWalletProvider = async (address?: tEthereumAddress) =>
  await WalletBalanceProviderFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.WalletBalanceProvider}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getUiPoolDataProvider = async (address?: tEthereumAddress) =>
  await UiPoolDataProviderFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.UiPoolDataProvider}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getUiIncentiveDataProvider = async (address?: tEthereumAddress) =>
  await UiIncentiveDataProviderFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.UiIncentiveDataProvider}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getSturdyIncentivesControllerImpl = async (address?: tEthereumAddress) =>
  await StakedTokenIncentivesControllerFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.StakedTokenIncentivesControllerImpl}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getSturdyIncentivesController = async (address?: tEthereumAddress) =>
  await StakedTokenIncentivesControllerFactory.connect(
    address ||
      (
        await getDb()
          .get(`${eContractid.StakedTokenIncentivesController}.${DRE.network.name}`)
          .value()
      ).address,
    await getFirstSigner()
  );

export const getSturdyTokenImpl = async (address?: tEthereumAddress) =>
  await SturdyTokenFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.SturdyTokenImpl}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getSturdyToken = async (address?: tEthereumAddress) =>
  await SturdyTokenFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.SturdyToken}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getCollateralAdapter = async (address?: tEthereumAddress) =>
  await CollateralAdapterFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.CollateralAdapter}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getMockyvWFTM = async (address?: tEthereumAddress) =>
  await MockyvWFTMFactory.connect(
    address || (await getDb().get(`${eContractid.MockyvWFTM}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockyvWETH = async (address?: tEthereumAddress) =>
  await MockyvWETHFactory.connect(
    address || (await getDb().get(`${eContractid.MockyvWETH}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockyvWBTC = async (address?: tEthereumAddress) =>
  await MockyvWBTCFactory.connect(
    address || (await getDb().get(`${eContractid.MockyvWBTC}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockyvBOO = async (address?: tEthereumAddress) =>
  await MockyvBOOFactory.connect(
    address || (await getDb().get(`${eContractid.MockyvBOO}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockMooTOMBFTM = async (address?: tEthereumAddress) =>
  await MockMooTOMBFTMFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.MockMooTOMBFTM}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getMockMooTOMBMIMATIC = async (address?: tEthereumAddress) =>
  await MockMooTOMBMIMATICFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.MockMooTOMBMIMATIC}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getMockMooBASEDMIMATIC = async (address?: tEthereumAddress) =>
  await MockMooBASEDMIMATICFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.MockMooBASEDMIMATIC}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getMockWBTCForFTM = async (address?: tEthereumAddress) =>
  await MockWBTCForFTMFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.MockWBTCForFTM}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getGenericATokenImpl = async (address?: tEthereumAddress) =>
  await ATokenFactory.connect(
    address || (await getDb().get(`${eContractid.AToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getCollateralATokenImpl = async (address?: tEthereumAddress) =>
  await ATokenForCollateralFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.ATokenForCollateral}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getFTMLiquidator = async (address?: tEthereumAddress) =>
  await FTMLiquidatorFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.FTMLiquidator}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getETHLiquidator = async (address?: tEthereumAddress) =>
  await ETHLiquidatorFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.ETHLiquidator}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getDeployVaultHelper = async (address?: tEthereumAddress) =>
  await DeployVaultHelperFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.DeployVaultHelper}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getBeetsOracle = async (address?: tEthereumAddress) =>
  await BeetsOracleFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.BeetsOracle}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getFBeetsOracle = async (address?: tEthereumAddress) =>
  await FBeetsOracleFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.FBeetsOracle}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getRETHWstETHLPOracle = async (address?: tEthereumAddress) =>
  await CrvREthWstETHOracleFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.RETHWstETHLPOracle}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getYieldManager = async (address?: tEthereumAddress) =>
  await YieldManagerFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.YieldManager}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );

export const getUniswapAdapterAddress = async () => {
  const db = await getDb().get(`${eContractid.UniswapAdapter}.${DRE.network.name}`).value();
  return db?.address;
};

export const getCurveswapAdapterAddress = async () => {
  const db = await getDb().get(`${eContractid.CurveswapAdapter}.${DRE.network.name}`).value();
  return db?.address;
};
