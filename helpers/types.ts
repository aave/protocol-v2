import BigNumber from 'bignumber.js';
import {MockTokenMap} from './contracts-helpers';

export interface SymbolMap<T> {
  [symbol: string]: T;
}

export enum eEthereumNetwork {
  buidlerevm = 'buidlerevm',
  kovan = 'kovan',
  ropsten = 'ropsten',
  main = 'main',
  coverage = 'coverage',
}

export enum EthereumNetworkNames {
  kovan = 'kovan',
  ropsten = 'ropsten',
  main = 'main',
}

export enum AavePools {
  proto = 'proto',
  secondary = 'secondary',
}

export enum eContractid {
  Example = 'Example',
  LendingPoolAddressesProvider = 'LendingPoolAddressesProvider',
  MintableERC20 = 'MintableERC20',
  LendingPoolAddressesProviderRegistry = 'LendingPoolAddressesProviderRegistry',
  LendingPoolParametersProvider = 'LendingPoolParametersProvider',
  LendingPoolConfigurator = 'LendingPoolConfigurator',
  ValidationLogic = 'ValidationLogic',
  ReserveLogic = 'ReserveLogic',
  GenericLogic = 'GenericLogic',
  LendingPool = 'LendingPool',
  PriceOracle = 'PriceOracle',
  Proxy = 'Proxy',
  MockAggregator = 'MockAggregator',
  LendingRateOracle = 'LendingRateOracle',
  ChainlinkProxyPriceProvider = 'ChainlinkProxyPriceProvider',
  DefaultReserveInterestRateStrategy = 'DefaultReserveInterestRateStrategy',
  LendingPoolCollateralManager = 'LendingPoolCollateralManager',
  InitializableAdminUpgradeabilityProxy = 'InitializableAdminUpgradeabilityProxy',
  MockFlashLoanReceiver = 'MockFlashLoanReceiver',
  MockSwapAdapter = 'MockSwapAdapter',
  WalletBalanceProvider = 'WalletBalanceProvider',
  AToken = 'AToken',
  MockAToken = 'MockAToken',
  MockStableDebtToken = 'MockStableDebtToken',
  MockVariableDebtToken = 'MockVariableDebtToken',
  AaveProtocolTestHelpers = 'AaveProtocolTestHelpers',
  IERC20Detailed = 'IERC20Detailed',
  StableDebtToken = 'StableDebtToken',
  VariableDebtToken = 'VariableDebtToken',
  FeeProvider = 'FeeProvider',
  TokenDistributor = 'TokenDistributor',
}

/*
 * Error messages prefix glossary:
 *  - VL = ValidationLogic
 *  - MATH = Math libraries
 *  - AT = aToken or DebtTokens
 *  - LP = LendingPool
 *  - LPAPR = LendingPoolAddressesProviderRegistry
 *  - LPC = LendingPoolConfiguration
 *  - RL = ReserveLogic
 *  - LPCM = LendingPoolCollateralManager
 *  - P = Pausable
 */
export enum ProtocolErrors {
  VL_AMOUNT_NOT_GREATER_THAN_0 = '1', // 'Amount must be greater than 0'
  VL_NO_ACTIVE_RESERVE = '2', // 'Action requires an active reserve'
  VL_NO_UNFREEZED_RESERVE = '3', // 'Action requires an unfreezed reserve'
  VL_CURRENT_AVAILABLE_LIQUIDITY_NOT_ENOUGH = '4', // 'The current liquidity is not enough'
  VL_NOT_ENOUGH_AVAILABLE_USER_BALANCE = '5', // 'User cannot withdraw more than the available balance'
  VL_TRANSFER_NOT_ALLOWED = '6', // 'Transfer cannot be allowed.'
  VL_BORROWING_NOT_ENABLED = '7', // 'Borrowing is not enabled'
  VL_INVALID_INTEREST_RATE_MODE_SELECTED = '8', // 'Invalid interest rate mode selected'
  VL_COLLATERAL_BALANCE_IS_0 = '9', // 'The collateral balance is 0'
  VL_HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD = '10', // 'Health factor is lesser than the liquidation threshold'
  VL_COLLATERAL_CANNOT_COVER_NEW_BORROW = '11', // 'There is not enough collateral to cover a new borrow'
  VL_STABLE_BORROWING_NOT_ENABLED = '12', // stable borrowing not enabled
  VL_CALLATERAL_SAME_AS_BORROWING_CURRENCY = '13', // collateral is (mostly) the same currency that is being borrowed
  VL_AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE = '14', // 'The requested amount is greater than the max loan size in stable rate mode
  VL_NO_DEBT_OF_SELECTED_TYPE = '15', // 'for repayment of stable debt, the user needs to have stable debt, otherwise, he needs to have variable debt'
  VL_NO_EXPLICIT_AMOUNT_TO_REPAY_ON_BEHALF = '16', // 'To repay on behalf of an user an explicit amount to repay is needed'
  VL_NO_STABLE_RATE_LOAN_IN_RESERVE = '17', // 'User does not have a stable rate loan in progress on this reserve'
  VL_NO_VARIABLE_RATE_LOAN_IN_RESERVE = '18', // 'User does not have a variable rate loan in progress on this reserve'
  VL_UNDERLYING_BALANCE_NOT_GREATER_THAN_0 = '19', // 'The underlying balance needs to be greater than 0'
  VL_DEPOSIT_ALREADY_IN_USE = '20', // 'User deposit is already being used as collateral'
  LP_NOT_ENOUGH_STABLE_BORROW_BALANCE = '21', // 'User does not have any stable rate loan for this reserve'
  LP_INTEREST_RATE_REBALANCE_CONDITIONS_NOT_MET = '22', // 'Interest rate rebalance conditions were not met'
  LP_LIQUIDATION_CALL_FAILED = '23', // 'Liquidation call failed'
  LP_NOT_ENOUGH_LIQUIDITY_TO_BORROW = '24', // 'There is not enough liquidity available to borrow'
  LP_REQUESTED_AMOUNT_TOO_SMALL = '25', // 'The requested amount is too small for a FlashLoan.'
  LP_INCONSISTENT_PROTOCOL_ACTUAL_BALANCE = '26', // 'The actual balance of the protocol is inconsistent'
  LP_CALLER_NOT_LENDING_POOL_CONFIGURATOR = '27', // 'The actual balance of the protocol is inconsistent'
  AT_CALLER_MUST_BE_LENDING_POOL = '28', // 'The caller of this function must be a lending pool'
  AT_CANNOT_GIVE_ALLOWANCE_TO_HIMSELF = '30', // 'User cannot give allowance to himself'
  AT_TRANSFER_AMOUNT_NOT_GT_0 = '31', // 'Transferred amount needs to be greater than zero'
  RL_RESERVE_ALREADY_INITIALIZED = '34', // 'Reserve has already been initialized'
  LPC_CALLER_NOT_AAVE_ADMIN = '35', // 'The caller must be the aave admin'
  LPC_RESERVE_LIQUIDITY_NOT_0 = '36', // 'The liquidity of the reserve needs to be 0'
  LPAPR_PROVIDER_NOT_REGISTERED = '37', // 'Provider is not registered'
  LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD = '38', // 'Health factor is not below the threshold'
  LPCM_COLLATERAL_CANNOT_BE_LIQUIDATED = '39', // 'The collateral chosen cannot be liquidated'
  LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER = '40', // 'User did not borrow the specified currency'
  LPCM_NOT_ENOUGH_LIQUIDITY_TO_LIQUIDATE = '41', // "There isn't enough liquidity available to liquidate"
  LPCM_NO_ERRORS = '42', // 'No errors'
  LP_INVALID_FLASHLOAN_MODE = '43', //Invalid flashloan mode
  LP_INVALID_EQUAL_ASSETS_TO_SWAP = '56', // User can't use same reserve as destination of liquidity swap
  P_IS_PAUSED = '58', // Pool is paused
  LP_INVALID_FLASH_LOAN_EXECUTOR_RETURN = '60', // The flash loan received returned 0 (EOA)

  // old

  INVALID_FROM_BALANCE_AFTER_TRANSFER = 'Invalid from balance after transfer',
  INVALID_TO_BALANCE_AFTER_TRANSFER = 'Invalid from balance after transfer',
  INVALID_OWNER_REVERT_MSG = 'Ownable: caller is not the owner',
  INVALID_HF = 'Invalid health factor',
  TRANSFER_AMOUNT_EXCEEDS_BALANCE = 'ERC20: transfer amount exceeds balance',
  SAFEERC20_LOWLEVEL_CALL = 'SafeERC20: low-level call failed',
}

export type tEthereumAddress = string;
export type tStringTokenBigUnits = string; // 1 ETH, or 10e6 USDC or 10e18 DAI
export type tBigNumberTokenBigUnits = BigNumber;
export type tStringTokenSmallUnits = string; // 1 wei, or 1 basic unit of USDC, or 1 basic unit of DAI
export type tBigNumberTokenSmallUnits = BigNumber;

export interface iAssetCommon<T> {
  [key: string]: T;
}
export interface iAssetBase<T> {
  WETH: T;
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

export type iAssetsWithoutETH<T> = Omit<iAssetBase<T>, 'ETH'>;

export type iAssetsWithoutUSD<T> = Omit<iAssetBase<T>, 'USD'>;

export type iAavePoolAssets<T> = Pick<
  iAssetsWithoutUSD<T>,
  | 'DAI'
  | 'TUSD'
  | 'USDC'
  | 'USDT'
  | 'SUSD'
  | 'LEND'
  | 'BAT'
  | 'REP'
  | 'MKR'
  | 'LINK'
  | 'KNC'
  | 'WBTC'
  | 'MANA'
  | 'ZRX'
  | 'SNX'
  | 'BUSD'
  | 'WETH'
>;

export type iUniAssets<T> = Pick<
  iAssetBase<T>,
  'UNI_DAI_ETH' | 'UNI_USDC_ETH' | 'UNI_SETH_ETH' | 'UNI_LEND_ETH' | 'UNI_MKR_ETH' | 'UNI_LINK_ETH'
>;

export type iAaveSecondPoolAssets<T> = Pick<
  iAssetBase<T>,
  | 'WETH'
  | 'DAI'
  | 'USDC'
  | 'USDT'
  | 'UNI_DAI_ETH'
  | 'UNI_USDC_ETH'
  | 'UNI_SETH_ETH'
  | 'UNI_LEND_ETH'
  | 'UNI_MKR_ETH'
  | 'UNI_LINK_ETH'
>;

export type iMultiPoolsAssets<T> = iAssetCommon<T> | iAavePoolAssets<T> | iAaveSecondPoolAssets<T>;

export type iAavePoolTokens<T> = Omit<iAavePoolAssets<T>, 'ETH'>;

export type iAssetAggregatorBase<T> = iAssetsWithoutETH<T>;

export enum TokenContractId {
  DAI = 'DAI',
  LEND = 'LEND',
  TUSD = 'TUSD',
  BAT = 'BAT',
  WETH = 'WETH',
  USDC = 'USDC',
  USDT = 'USDT',
  SUSD = 'SUSD',
  ZRX = 'ZRX',
  MKR = 'MKR',
  WBTC = 'WBTC',
  LINK = 'LINK',
  KNC = 'KNC',
  MANA = 'MANA',
  REP = 'REP',
  SNX = 'SNX',
  BUSD = 'BUSD',
  USD = 'USD',
  UNI_DAI_ETH = 'UNI_DAI_ETH',
  UNI_USDC_ETH = 'UNI_USDC_ETH',
  UNI_SETH_ETH = 'UNI_SETH_ETH',
  UNI_LINK_ETH = 'UNI_LINK_ETH',
  UNI_MKR_ETH = 'UNI_MKR_ETH',
  UNI_LEND_ETH = 'UNI_LEND_ETH',
}

export interface IReserveParams extends IReserveBorrowParams, IReserveCollateralParams {}

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
  [eEthereumNetwork.coverage]: T;
  [eEthereumNetwork.buidlerevm]: T;
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

export enum RateMode {
  None = '0',
  Stable = '1',
  Variable = '2',
}

export interface ObjectString {
  [key: string]: string;
}

export enum EthereumNetwork {
  kovan = 'kovan',
  ropsten = 'ropsten',
  development = 'development',
  main = 'main',
  coverage = 'soliditycoverage',
}

export interface IProtocolGlobalConfig {
  OptimalUtilizationRate: BigNumber;
  ExcessUtilizationRate: BigNumber;
  ApprovalAmountLendingPoolCore: string;
  TokenDistributorPercentageBase: string;
  MockUsdPriceInWei: string;
  EthereumAddress: tEthereumAddress;
  UsdAddress: tEthereumAddress;
  NilAddress: tEthereumAddress;
  OneAddress: tEthereumAddress;
  AaveReferral: string;
}

export interface IMocksConfig {
  ChainlinkAggregatorPrices: iAssetBase<string>;
  AllAssetsInitialPrices: iAssetBase<string>;
}

export interface ILendingRateOracleRatesCommon {
  [token: string]: ILendingRate;
}

export interface ILendingRate {
  borrowRate: string;
}

export interface ICommonConfiguration {
  ConfigName: string;
  ProviderId: number;
  ReserveSymbols: string[];
  ProtocolGlobalParams: IProtocolGlobalConfig;
  Mocks: IMocksConfig;
  ProviderRegistry: iParamsPerNetwork<tEthereumAddress | undefined>;
  LendingRateOracleRatesCommon: iMultiPoolsAssets<IMarketRates>;
  LendingRateOracle: iParamsPerNetwork<tEthereumAddress>;
  TokenDistributor: iParamsPerNetwork<tEthereumAddress>;
  ChainlinkProxyPriceProvider: iParamsPerNetwork<tEthereumAddress>;
  FallbackOracle: iParamsPerNetwork<tEthereumAddress>;
  ChainlinkAggregator: iParamsPerNetwork<ITokenAddress>;
  AaveAdmin: iParamsPerNetwork<tEthereumAddress | undefined>;
  AaveAdminIndex: number;
  ReserveAssets: iParamsPerNetwork<SymbolMap<tEthereumAddress>>;
  ReservesConfig: iMultiPoolsAssets<IReserveParams>;
  ATokenDomainSeparator: iParamsPerNetwork<string>;
}

export interface IAaveConfiguration extends ICommonConfiguration {
  ReservesConfig: iAavePoolAssets<IReserveParams>;
}

export interface IUniswapConfiguration extends ICommonConfiguration {
  ReservesConfig: iAaveSecondPoolAssets<IReserveParams>;
}

export interface ITokenAddress {
  [token: string]: tEthereumAddress;
}

export type PoolConfiguration = ICommonConfiguration | IAaveConfiguration | IUniswapConfiguration;
