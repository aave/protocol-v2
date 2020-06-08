import BigNumber from "bignumber.js";

export enum eEthereumNetwork {
  buidlerevm = "buidlerevm",
  kovan = "kovan",
  ropsten = "ropsten",
  main = "main",
}

export enum AavePools {
  proto = "proto",
  secondary = "secondary",
}

export enum eContractid {
  Example = "Example",
  LendingPoolAddressesProvider = "LendingPoolAddressesProvider",
  MintableERC20 = "MintableERC20",
  LendingPoolAddressesProviderRegistry = "LendingPoolAddressesProviderRegistry",
  FeeProvider = "FeeProvider",
  LendingPoolParametersProvider = "LendingPoolParametersProvider",
  LendingPoolCore = "LendingPoolCore",
  LendingPoolConfigurator = "LendingPoolConfigurator",
  CoreLibrary = "CoreLibrary",
  LendingPoolDataProvider = "LendingPoolDataProvider",
  LendingPool = "LendingPool",
  PriceOracle = "PriceOracle",
  Proxy = "Proxy",
  MockAggregator = "MockAggregator",
  LendingRateOracle = "LendingRateOracle",
  ChainlinkProxyPriceProvider = "ChainlinkProxyPriceProvider",
  DefaultReserveInterestRateStrategy = "DefaultReserveInterestRateStrategy",
  LendingPoolLiquidationManager = "LendingPoolLiquidationManager",
  MockOneSplit = "MockOneSplit",
  OneSplitAdapter = "OneSplitAdapter",
  TokenDistributor = "TokenDistributor",
  InitializableAdminUpgradeabilityProxy = "InitializableAdminUpgradeabilityProxy",
  MockFlashLoanReceiver = "MockFlashLoanReceiver",
  WalletBalanceProvider = "WalletBalanceProvider",
  AToken = "AToken",
  AaveProtocolTestHelpers = "AaveProtocolTestHelpers",
}

export type tEthereumAddress = string;
export type tStringTokenBigUnits = string; // 1 ETH, or 10e6 USDC or 10e18 DAI
export type tBigNumberTokenBigUnits = BigNumber;
export type tStringTokenSmallUnits = string; // 1 wei, or 1 basic unit of USDC, or 1 basic unit of DAI
export type tBigNumberTokenSmallUnits = BigNumber;

export interface iAssetBase<T> {
  ETH: T;
  DAI: T;
  TUSD: T;
  USDC: T;
  USDT: T;
  SUSD: T;
  LEND: T;
  BAT: T;
  REP: T;
  MKR: T;
  LINK: T;
  KNC: T;
  WBTC: T;
  MANA: T;
  ZRX: T;
  SNX: T;
  BUSD: T;

  USD: T;

  UNI_DAI_ETH: T;
  UNI_USDC_ETH: T;
  UNI_SETH_ETH: T;
  UNI_LEND_ETH: T;
  UNI_MKR_ETH: T;
  UNI_LINK_ETH: T;
}

export type iAssetsWithoutETH<T> = Omit<iAssetBase<T>, "ETH">;

export type iAssetsWithoutUSD<T> = Omit<iAssetBase<T>, "USD">;

export type iAavePoolAssets<T> = Pick<
  iAssetsWithoutUSD<T>,
  | "ETH"
  | "DAI"
  | "TUSD"
  | "USDC"
  | "USDT"
  | "SUSD"
  | "LEND"
  | "BAT"
  | "REP"
  | "MKR"
  | "LINK"
  | "KNC"
  | "WBTC"
  | "MANA"
  | "ZRX"
  | "SNX"
  | "BUSD"
>;

export type iUniAssets<T> = Pick<
  iAssetBase<T>,
  | "UNI_DAI_ETH"
  | "UNI_USDC_ETH"
  | "UNI_SETH_ETH"
  | "UNI_LEND_ETH"
  | "UNI_MKR_ETH"
  | "UNI_LINK_ETH"
>;

export type iAaveSecondPoolAssets<T> = Pick<
  iAssetBase<T>,
  | "ETH"
  | "DAI"
  | "USDC"
  | "USDT"
  | "UNI_DAI_ETH"
  | "UNI_USDC_ETH"
  | "UNI_SETH_ETH"
  | "UNI_LEND_ETH"
  | "UNI_MKR_ETH"
  | "UNI_LINK_ETH"
>;

export type iMultiPoolsAssets<T> =
  | iAavePoolAssets<T>
  | iAaveSecondPoolAssets<T>;

export type iAavePoolTokens<T> = Omit<iAavePoolAssets<T>, "ETH">;

export type iAssetAggregatorBase<T> = iAssetsWithoutETH<T>;

export enum TokenContractId {
  DAI = "DAI",
  LEND = "LEND",
  TUSD = "TUSD",
  BAT = "BAT",
  ETH = "ETH",
  USDC = "USDC",
  USDT = "USDT",
  SUSD = "SUSD",
  ZRX = "ZRX",
  MKR = "MKR",
  WBTC = "WBTC",
  LINK = "LINK",
  KNC = "KNC",
  MANA = "MANA",
  REP = "REP",
  SNX = "SNX",
  BUSD = "BUSD",
  USD = "USD",
  UNI_DAI_ETH = "UNI_DAI_ETH",
  UNI_USDC_ETH = "UNI_USDC_ETH",
  UNI_SETH_ETH = "UNI_SETH_ETH",
  UNI_LINK_ETH = "UNI_LINK_ETH",
  UNI_MKR_ETH = "UNI_MKR_ETH",
  UNI_LEND_ETH = "UNI_LEND_ETH",
}

export interface IReserveParams
  extends IReserveBorrowParams,
    IReserveCollateralParams {}

export interface IReserveBorrowParams {
  baseVariableBorrowRate: string;
  variableRateSlope1: string;
  variableRateSlope2: string;
  stableRateSlope1: string;
  stableRateSlope2: string;
  borrowingEnabled: boolean;
  stableBorrowRateEnabled: boolean;
  reserveDecimals: string;
}

export interface IReserveCollateralParams {
  baseLTVAsCollateral: string;
  liquidationThreshold: string;
  liquidationBonus: string;
}
export interface IMarketRates {
  borrowRate: string;
}

export interface iParamsPerNetwork<T> {
  [eEthereumNetwork.kovan]: T;
  [eEthereumNetwork.ropsten]: T;
  [eEthereumNetwork.main]: T;
}

export interface iParamsPerPool<T> {
  [AavePools.proto]: T;
  [AavePools.secondary]: T;
}

export interface iBasicDistributionParams {
  receivers: string[];
  percentages: string[];
}
