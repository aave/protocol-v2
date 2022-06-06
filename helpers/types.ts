import BigNumber from 'bignumber.js';

export interface SymbolMap<T> {
  [symbol: string]: T;
}

export type eNetwork = eEthereumNetwork | eFantomNetwork;

export enum eEthereumNetwork {
  buidlerevm = 'buidlerevm',
  kovan = 'kovan',
  ropsten = 'ropsten',
  main = 'main',
  coverage = 'coverage',
  hardhat = 'hardhat',
  geth = 'geth',
  localhost = 'localhost',
  tenderly = 'tenderly',
  goerli = 'goerli',
}

export enum eFantomNetwork {
  ftm = 'ftm',
  ftm_test = 'ftm_test',
  tenderlyFTM = 'tenderlyFTM',
}

export enum EthereumNetworkNames {
  kovan = 'kovan',
  ropsten = 'ropsten',
  main = 'main',
  fantom = 'fantom',
}

export enum SturdyPools {
  proto = 'proto',
  fantom = 'fantom',
}

export enum eContractid {
  Example = 'Example',
  LendingPoolAddressesProvider = 'LendingPoolAddressesProvider',
  MintableERC20 = 'MintableERC20',
  MintableDelegationERC20 = 'MintableDelegationERC20',
  LendingPoolAddressesProviderRegistry = 'LendingPoolAddressesProviderRegistry',
  LendingPoolParametersProvider = 'LendingPoolParametersProvider',
  LendingPoolConfigurator = 'LendingPoolConfigurator',
  ValidationLogic = 'ValidationLogic',
  ReserveLogic = 'ReserveLogic',
  GenericLogic = 'GenericLogic',
  PriceOracle = 'PriceOracle',
  Proxy = 'Proxy',
  MockAggregator = 'MockAggregator',
  LendingRateOracle = 'LendingRateOracle',
  SturdyOracle = 'SturdyOracle',
  BooOracle = 'BooOracle',
  TombOracle = 'TombOracle',
  TombFtmLPOracle = 'TombFtmLPOracle',
  MiMaticOracle = 'MiMaticOracle',
  TombMiMaticLPOracle = 'TombMiMaticLPOracle',
  FBeetsOracle = 'FBeetsOracle',
  BeetsOracle = 'BeetsOracle',
  BasedOracle = 'BasedOracle',
  BasedMiMaticLPOracle = 'BasedMiMaticLPOracle',
  RETHWstETHLPOracle = 'RETHWstETHLPOracle',
  FRAX3CRVOracle = 'FRAX3CRVOracle',
  STECRVOracle = 'STECRVOracle',
  DOLA3CRVOracle = 'DOLA3CRVOracle',
  DefaultReserveInterestRateStrategy = 'DefaultReserveInterestRateStrategy',
  LendingPoolCollateralManager = 'LendingPoolCollateralManager',
  InitializableImmutableAdminUpgradeabilityProxy = 'InitializableImmutableAdminUpgradeabilityProxy',
  AToken = 'AToken',
  ATokenForCollateral = 'ATokenForCollateral',
  MockAToken = 'MockAToken',
  MockStableDebtToken = 'MockStableDebtToken',
  MockVariableDebtToken = 'MockVariableDebtToken',
  StakedTokenIncentivesControllerImpl = 'StakedTokenIncentivesControllerImpl',
  StakedTokenIncentivesController = 'StakedTokenIncentivesController',
  SturdyTokenImpl = 'SturdyTokenImpl',
  SturdyToken = 'SturdyToken',
  SturdyProtocolDataProvider = 'SturdyProtocolDataProvider',
  WalletBalanceProvider = 'WalletBalanceProvider',
  UiIncentiveDataProvider = 'UiIncentiveDataProvider',
  UiPoolDataProvider = 'UiPoolDataProvider',
  IERC20Detailed = 'IERC20Detailed',
  SwapinERC20 = 'SwapinERC20',
  StableDebtToken = 'StableDebtToken',
  VariableDebtToken = 'VariableDebtToken',
  StableAndVariableTokensHelper = 'StableAndVariableTokensHelper',
  ATokensAndRatesHelper = 'ATokensAndRatesHelper',
  DAIToken = 'DAIToken',
  USDCToken = 'USDCToken',
  USDTToken = 'USDTToken',
  WETHMocked = 'WETHMocked',
  LendingPoolImpl = 'LendingPoolImpl',
  LendingPoolConfiguratorImpl = 'LendingPoolConfiguratorImpl',
  LendingPoolCollateralManagerImpl = 'LendingPoolCollateralManagerImpl',
  LendingPool = 'LendingPool',
  LidoVaultImpl = 'LidoVaultImpl',
  LidoVault = 'LidoVault',
  YearnRETHWstETHVaultImpl = 'YearnRETHWstETHVaultImpl',
  YearnRETHWstETHVault = 'YearnRETHWstETHVault',
  ConvexRocketPoolETHVaulttImpl = 'ConvexRocketPoolETHVaulttImpl',
  ConvexRocketPoolETHVault = 'ConvexRocketPoolETHVault',
  ConvexFRAX3CRVVaultImpl = 'ConvexFRAX3CRVVaultImpl',
  ConvexFRAX3CRVVault = 'ConvexFRAX3CRVVault',
  ConvexSTETHVaultImpl = 'ConvexSTETHVaultImpl',
  ConvexSTETHVault = 'ConvexSTETHVault',
  ConvexDOLA3CRVVaultImpl = 'ConvexDOLA3CRVVaultImpl',
  ConvexDOLA3CRVVault = 'ConvexDOLA3CRVVault',
  YearnVaultImpl = 'YearnVaultImpl',
  YearnVault = 'YearnVault',
  YearnWETHVaultImpl = 'YearnWETHVaultImpl',
  YearnWETHVault = 'YearnWETHVault',
  YearnWBTCVaultImpl = 'YearnWBTCVaultImpl',
  YearnWBTCVault = 'YearnWBTCVault',
  YearnBOOVaultImpl = 'YearnBOOVaultImpl',
  YearnBOOVault = 'YearnBOOVault',
  TombFtmBeefyVaultImpl = 'TombFtmBeefyVaultImpl',
  TombFtmBeefyVault = 'TombFtmBeefyVault',
  TombMiMaticBeefyVaultImpl = 'TombMiMaticBeefyVaultImpl',
  TombMiMaticBeefyVault = 'TombMiMaticBeefyVault',
  YearnFBEETSVaultImpl = 'YearnFBEETSVaultImpl',
  YearnFBEETSVault = 'YearnFBEETSVault',
  YearnLINKVaultImpl = 'YearnLINKVaultImpl',
  YearnLINKVault = 'YearnLINKVault',
  YearnCRVVaultImpl = 'YearnCRVVaultImpl',
  YearnCRVVault = 'YearnCRVVault',
  YearnSPELLVaultImpl = 'YearnSPELLVaultImpl',
  YearnSPELLVault = 'YearnSPELLVault',
  BasedMiMaticBeefyVaultImpl = 'BasedMiMaticBeefyVaultImpl',
  BasedMiMaticBeefyVault = 'BasedMiMaticBeefyVault',
  MockyvWFTM = 'MockyvWFTM',
  MockyvWETH = 'MockyvWETH',
  MockyvWBTC = 'MockyvWBTC',
  MockyvBOO = 'MockyvBOO',
  MockMooTOMBFTM = 'MockMooTOMBFTM',
  MockMooTOMBMIMATIC = 'MockMooTOMBMIMATIC',
  MockMooBASEDMIMATIC = 'MockMooBASEDMIMATIC',
  MockWETHForFTM = 'MockWETHForFTM',
  MockWBTCForFTM = 'MockWBTCForFTM',
  MockBOOForFTM = 'MockBOOForFTM',
  BeefyETHVault = 'BeefyETHVault',
  BeefyETHVaultImpl = 'BeefyETHVaultImpl',
  CollateralAdapter = 'CollateralAdapter',
  CollateralAdapterImpl = 'CollateralAdapterImpl',
  FTMLiquidator = 'FTMLiquidator',
  ETHLiquidator = 'ETHLiquidator',
  MockLINKForFTM = 'MockLINKForFTM',
  MockFBEETSForFTM = 'MockFBEETSForFTM',
  MockBeeefyETHForFTM = 'MockBeeefyETHForFTM',
  MockCRVForFTM = 'MockCRVForFTM',
  MockSPELLForFTM = 'MockSPELLForFTM',
  DeployVaultHelper = 'DeployVaultHelper',
  YieldManagerImpl = 'YieldManagerImpl',
  YieldManager = 'YieldManager',
  UniswapAdapter = 'UniswapAdapter',
  CurveswapAdapter = 'CurveswapAdapter',
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
  //common errors
  CALLER_NOT_POOL_ADMIN = '33', // 'The caller must be the pool admin'

  //contract specific errors
  VL_INVALID_AMOUNT = '1', // 'Amount must be greater than 0'
  VL_NO_ACTIVE_RESERVE = '2', // 'Action requires an active reserve'
  VL_RESERVE_FROZEN = '3', // 'Action requires an unfrozen reserve'
  VL_CURRENT_AVAILABLE_LIQUIDITY_NOT_ENOUGH = '4', // 'The current liquidity is not enough'
  VL_NOT_ENOUGH_AVAILABLE_USER_BALANCE = '5', // 'User cannot withdraw more than the available balance'
  VL_TRANSFER_NOT_ALLOWED = '6', // 'Transfer cannot be allowed.'
  VL_BORROWING_NOT_ENABLED = '7', // 'Borrowing is not enabled'
  VL_INVALID_INTEREST_RATE_MODE_SELECTED = '8', // 'Invalid interest rate mode selected'
  VL_COLLATERAL_BALANCE_IS_0 = '9', // 'The collateral balance is 0'
  VL_HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD = '10', // 'Health factor is lesser than the liquidation threshold'
  VL_COLLATERAL_CANNOT_COVER_NEW_BORROW = '11', // 'There is not enough collateral to cover a new borrow'
  VL_STABLE_BORROWING_NOT_ENABLED = '12', // stable borrowing not enabled
  VL_COLLATERAL_SAME_AS_BORROWING_CURRENCY = '13', // collateral is (mostly) the same currency that is being borrowed
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
  LP_CALLER_NOT_LENDING_POOL_CONFIGURATOR = '27', // 'The caller is not the lending pool configurator'
  LP_INCONSISTENT_FLASHLOAN_PARAMS = '28',
  CT_CALLER_MUST_BE_LENDING_POOL = '29', // 'The caller of this function must be a lending pool'
  CT_CANNOT_GIVE_ALLOWANCE_TO_HIMSELF = '30', // 'User cannot give allowance to himself'
  CT_TRANSFER_AMOUNT_NOT_GT_0 = '31', // 'Transferred amount needs to be greater than zero'
  RL_RESERVE_ALREADY_INITIALIZED = '32', // 'Reserve has already been initialized'
  LPC_RESERVE_LIQUIDITY_NOT_0 = '34', // 'The liquidity of the reserve needs to be 0'
  LPC_INVALID_ATOKEN_POOL_ADDRESS = '35', // 'The liquidity of the reserve needs to be 0'
  LPC_INVALID_STABLE_DEBT_TOKEN_POOL_ADDRESS = '36', // 'The liquidity of the reserve needs to be 0'
  LPC_INVALID_VARIABLE_DEBT_TOKEN_POOL_ADDRESS = '37', // 'The liquidity of the reserve needs to be 0'
  LPC_INVALID_STABLE_DEBT_TOKEN_UNDERLYING_ADDRESS = '38', // 'The liquidity of the reserve needs to be 0'
  LPC_INVALID_VARIABLE_DEBT_TOKEN_UNDERLYING_ADDRESS = '39', // 'The liquidity of the reserve needs to be 0'
  LPC_INVALID_ADDRESSES_PROVIDER_ID = '40', // 'The liquidity of the reserve needs to be 0'
  LPC_CALLER_NOT_EMERGENCY_ADMIN = '76', // 'The caller must be the emergencya admin'
  LPAPR_PROVIDER_NOT_REGISTERED = '41', // 'Provider is not registered'
  LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD = '42', // 'Health factor is not below the threshold'
  LPCM_COLLATERAL_CANNOT_BE_LIQUIDATED = '43', // 'The collateral chosen cannot be liquidated'
  LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER = '44', // 'User did not borrow the specified currency'
  LPCM_NOT_ENOUGH_LIQUIDITY_TO_LIQUIDATE = '45', // "There isn't enough liquidity available to liquidate"
  LPCM_NO_ERRORS = '46', // 'No errors'
  LP_INVALID_FLASHLOAN_MODE = '47', //Invalid flashloan mode selected
  MATH_MULTIPLICATION_OVERFLOW = '48',
  MATH_ADDITION_OVERFLOW = '49',
  MATH_DIVISION_BY_ZERO = '50',
  RL_LIQUIDITY_INDEX_OVERFLOW = '51', //  Liquidity index overflows uint128
  RL_VARIABLE_BORROW_INDEX_OVERFLOW = '52', //  Variable borrow index overflows uint128
  RL_LIQUIDITY_RATE_OVERFLOW = '53', //  Liquidity rate overflows uint128
  RL_VARIABLE_BORROW_RATE_OVERFLOW = '54', //  Variable borrow rate overflows uint128
  RL_STABLE_BORROW_RATE_OVERFLOW = '55', //  Stable borrow rate overflows uint128
  CT_INVALID_MINT_AMOUNT = '56', //invalid amount to mint
  LP_FAILED_REPAY_WITH_COLLATERAL = '57',
  CT_INVALID_BURN_AMOUNT = '58', //invalid amount to burn
  LP_BORROW_ALLOWANCE_NOT_ENOUGH = '59', // User borrows on behalf, but allowance are too small
  LP_FAILED_COLLATERAL_SWAP = '60',
  LP_INVALID_EQUAL_ASSETS_TO_SWAP = '61',
  LP_REENTRANCY_NOT_ALLOWED = '62',
  LP_CALLER_MUST_BE_AN_ATOKEN = '63',
  LP_IS_PAUSED = '64', // 'Pool is paused'
  LP_NO_MORE_RESERVES_ALLOWED = '65',
  LP_INVALID_FLASH_LOAN_EXECUTOR_RETURN = '66',
  RC_INVALID_LTV = '67',
  RC_INVALID_LIQ_THRESHOLD = '68',
  RC_INVALID_LIQ_BONUS = '69',
  RC_INVALID_DECIMALS = '70',
  RC_INVALID_RESERVE_FACTOR = '71',
  LPAPR_INVALID_ADDRESSES_PROVIDER_ID = '72',

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
  USDC: T;
  USDT: T;
  fUSDT: T;
  USD: T;
  stETH: T;
  yvRETH_WSTETH: T;
  cvxRETH_WSTETH: T;
  cvxFRAX_3CRV: T;
  cvxSTECRV: T;
  cvxDOLA_3CRV: T;
  yvWFTM: T;
  mooWETH: T;
  yvWETH: T;
  yvWBTC: T;
  yvBOO: T;
  mooTOMB_FTM: T;
  mooTOMB_MIMATIC: T;
  yvfBEETS: T;
  yvLINK: T;
  yvCRV: T;
  yvSPELL: T;
  mooBASED_MIMATIC: T;
}

export type iAssetsWithoutETH<T> = Omit<iAssetBase<T>, 'ETH'>;

export type iAssetsWithoutUSD<T> = Omit<iAssetBase<T>, 'USD'>;

export type iSturdyPoolAssets<T> = Pick<
  iAssetsWithoutUSD<T>,
  | 'DAI'
  | 'USDC'
  | 'USDT'
  | 'stETH'
  | 'yvRETH_WSTETH'
  | 'cvxRETH_WSTETH'
  | 'cvxFRAX_3CRV'
  | 'cvxSTECRV'
  | 'cvxDOLA_3CRV'
>;

export type iFantomPoolAssets<T> = Pick<
  iAssetsWithoutUSD<T>,
  | 'DAI'
  | 'USDC'
  | 'yvWFTM'
  | 'mooWETH'
  | 'fUSDT'
  | 'yvWETH'
  | 'yvWBTC'
  | 'yvBOO'
  | 'mooTOMB_FTM'
  | 'mooTOMB_MIMATIC'
  | 'yvfBEETS'
  | 'yvLINK'
  | 'yvCRV'
  | 'yvSPELL'
  | 'mooBASED_MIMATIC'
>;

export type iMultiPoolsAssets<T> = iAssetCommon<T> | iSturdyPoolAssets<T>;

export type iSturdyPoolTokens<T> = Omit<iSturdyPoolAssets<T>, 'ETH'>;

export type iAssetAggregatorBase<T> = iAssetsWithoutETH<T>;

export enum TokenContractId {
  DAI = 'DAI',
  WETH = 'WETH',
  USDC = 'USDC',
  USDT = 'USDT',
  stETH = 'stETH',
  yvRETH_WSTETH = 'yvRETH_WSTETH',
  cvxRETH_WSTETH = 'cvxRETH_WSTETH',
  cvxFRAX_3CRV = 'cvxFRAX_3CRV',
  cvxSTECRV = 'cvxSTECRV',
  cvxDOLA_3CRV = 'cvxDOLA_3CRV',
  yvWFTM = 'yvWFTM',
  mooWETH = 'mooWETH',
  yvWETH = 'yvWETH',
  yvWBTC = 'yvWBTC',
  yvBOO = 'yvBOO',
  mooTOMB_FTM = 'mooTOMB_FTM',
  mooTOMB_MATIC = 'mooTOMB_MATIC',
  yvfBEETS = 'yvfBEETS',
  yvLINK = 'yvLINK',
  yvCRV = 'yvCRV',
  yvSPELL = 'yvSPELL',
  mooBASED_MATIC = 'mooBASED_MATIC',
}

export interface IReserveParams extends IReserveBorrowParams, IReserveCollateralParams {
  aTokenImpl: eContractid;
  reserveFactor: string;
  emissionPerSecond: string;
  strategy: IInterestRateStrategyParams;
}

export interface IInterestRateStrategyParams {
  name: string;
  optimalUtilizationRate: string;
  baseVariableBorrowRate: string;
  variableRateSlope1: string;
  variableRateSlope2: string;
  stableRateSlope1: string;
  stableRateSlope2: string;
  capacity: string;
}

export interface IReserveBorrowParams {
  borrowingEnabled: boolean;
  stableBorrowRateEnabled: boolean;
  reserveDecimals: string;
}

export interface IReserveCollateralParams {
  baseLTVAsCollateral: string;
  liquidationThreshold: string;
  liquidationBonus: string;
  collateralEnabled: boolean;
}
export interface IMarketRates {
  borrowRate: string;
}

export type iParamsPerNetwork<T> = iEthereumParamsPerNetwork<T> | iFantomParamsPerNetwork<T>;

export interface iParamsPerNetworkAll<T> extends iEthereumParamsPerNetwork<T> {}

export interface iEthereumParamsPerNetwork<T> {
  [eEthereumNetwork.coverage]: T;
  [eEthereumNetwork.buidlerevm]: T;
  [eEthereumNetwork.kovan]: T;
  [eEthereumNetwork.ropsten]: T;
  [eEthereumNetwork.main]: T;
  [eEthereumNetwork.hardhat]: T;
  [eEthereumNetwork.geth]: T;
  [eEthereumNetwork.localhost]: T;
  [eEthereumNetwork.tenderly]: T;
  [eEthereumNetwork.goerli]: T;
}

export interface iFantomParamsPerNetwork<T> {
  [eFantomNetwork.ftm]: T;
  [eFantomNetwork.ftm_test]: T;
  [eFantomNetwork.tenderlyFTM]: T;
}

export interface iParamsPerPool<T> {
  [SturdyPools.proto]: T;
  [SturdyPools.fantom]: T;
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

export interface IProtocolGlobalConfig {
  TokenDistributorPercentageBase: string;
  MockUsdPriceInWei: string;
  UsdAddress: tEthereumAddress;
  NilAddress: tEthereumAddress;
  OneAddress: tEthereumAddress;
  SturdyReferral: string;
}

export interface IMocksConfig {
  AllAssetsInitialPrices: iAssetBase<string>;
}

export interface ILendingRateOracleRatesCommon {
  [token: string]: ILendingRate;
}

export interface ILendingRate {
  borrowRate: string;
}

export interface IBaseConfiguration {
  MarketId: string;
  ATokenNamePrefix: string;
  StableDebtTokenNamePrefix: string;
  VariableDebtTokenNamePrefix: string;
  SymbolPrefix: string;
  ProviderId: number;
  ProtocolGlobalParams: IProtocolGlobalConfig;
  Mocks: IMocksConfig;
  ProviderRegistry: iParamsPerNetwork<tEthereumAddress | undefined>;
  ProviderRegistryOwner: iParamsPerNetwork<tEthereumAddress | undefined>;
  LendingPoolCollateralManager: iParamsPerNetwork<tEthereumAddress>;
  LendingPoolConfigurator: iParamsPerNetwork<tEthereumAddress>;
  LendingPool: iParamsPerNetwork<tEthereumAddress>;
  LendingRateOracleRatesCommon: iMultiPoolsAssets<IMarketRates>;
  LendingRateOracle: iParamsPerNetwork<tEthereumAddress>;
  TokenDistributor: iParamsPerNetwork<tEthereumAddress>;
  SturdyOracle: iParamsPerNetwork<tEthereumAddress>;
  FallbackOracle: iParamsPerNetwork<tEthereumAddress>;
  ChainlinkAggregator: iParamsPerNetwork<ITokenAddress>;
  PoolAdmin: iParamsPerNetwork<tEthereumAddress | undefined>;
  PoolAdminIndex: number;
  EmergencyAdmin: iParamsPerNetwork<tEthereumAddress | undefined>;
  EmergencyAdminIndex: number;
  ReserveAssets: iParamsPerNetwork<SymbolMap<tEthereumAddress>>;
  ATokenDomainSeparator: iParamsPerNetwork<string>;
  WFTM: iParamsPerNetwork<tEthereumAddress>;
  WETH: iParamsPerNetwork<tEthereumAddress>;
  WBTC: iParamsPerNetwork<tEthereumAddress>;
  WrappedNativeToken: iParamsPerNetwork<tEthereumAddress>;
  ReserveFactorTreasuryAddress: iParamsPerNetwork<tEthereumAddress>;
  IncentivesController: iParamsPerNetwork<tEthereumAddress>;
}

export interface ICommonConfiguration extends IBaseConfiguration {
  ReservesConfig: iMultiPoolsAssets<IReserveParams>;
  OracleQuoteCurrency: string;
  OracleQuoteUnit: string;
}

export interface ISturdyConfiguration extends ICommonConfiguration {
  ReservesConfig: iSturdyPoolAssets<IReserveParams>;
  Lido: iParamsPerNetwork<tEthereumAddress>;
  WSTETH: iParamsPerNetwork<tEthereumAddress>;
  RETH_WSTETH_LP: iParamsPerNetwork<tEthereumAddress>;
  FRAX_3CRV_LP: iParamsPerNetwork<tEthereumAddress>;
  STECRV_LP: iParamsPerNetwork<tEthereumAddress>;
  DOLA_3CRV_LP: iParamsPerNetwork<tEthereumAddress>;
  CRV: iParamsPerNetwork<tEthereumAddress>;
  CVX: iParamsPerNetwork<tEthereumAddress>;
  YearnRETHWstETHVault: iParamsPerNetwork<tEthereumAddress>;
  CurveswapLidoPool: iParamsPerNetwork<tEthereumAddress>;
  UniswapRouter: iParamsPerNetwork<tEthereumAddress>;
  CurveswapAddressProvider: iParamsPerNetwork<tEthereumAddress>;
  AavePool: iParamsPerNetwork<tEthereumAddress>;
}

export interface IFantomConfiguration extends ICommonConfiguration {
  ReservesConfig: iFantomPoolAssets<IReserveParams>;
  BOO: iParamsPerNetwork<tEthereumAddress>;
  TOMB: iParamsPerNetwork<tEthereumAddress>;
  MIMATIC: iParamsPerNetwork<tEthereumAddress>;
  BASED: iParamsPerNetwork<tEthereumAddress>;
  TOMB_FTM_LP: iParamsPerNetwork<tEthereumAddress>;
  TOMB_MIMATIC_LP: iParamsPerNetwork<tEthereumAddress>;
  BASED_MIMATIC_LP: iParamsPerNetwork<tEthereumAddress>;
  fBEETS: iParamsPerNetwork<tEthereumAddress>;
  BEETS: iParamsPerNetwork<tEthereumAddress>;
  LINK: iParamsPerNetwork<tEthereumAddress>;
  CRV: iParamsPerNetwork<tEthereumAddress>;
  SPELL: iParamsPerNetwork<tEthereumAddress>;
  YearnVaultFTM: iParamsPerNetwork<tEthereumAddress>;
  YearnWETHVaultFTM: iParamsPerNetwork<tEthereumAddress>;
  YearnWBTCVaultFTM: iParamsPerNetwork<tEthereumAddress>;
  YearnBOOVaultFTM: iParamsPerNetwork<tEthereumAddress>;
  BeefyVaultTOMB_FTM: iParamsPerNetwork<tEthereumAddress>;
  BeefyVaultTOMB_MIMATIC: iParamsPerNetwork<tEthereumAddress>;
  BeefyVaultBASED_MIMATIC: iParamsPerNetwork<tEthereumAddress>;
  YearnFBEETSVaultFTM: iParamsPerNetwork<tEthereumAddress>;
  YearnLINKVaultFTM: iParamsPerNetwork<tEthereumAddress>;
  BeefyETHVault: iParamsPerNetwork<tEthereumAddress>;
  YearnCRVVaultFTM: iParamsPerNetwork<tEthereumAddress>;
  YearnSPELLVaultFTM: iParamsPerNetwork<tEthereumAddress>;
  UniswapRouter: iParamsPerNetwork<tEthereumAddress>;
  TombSwapRouter: iParamsPerNetwork<tEthereumAddress>;
  AavePool: iParamsPerNetwork<tEthereumAddress>;
}

export interface ITokenAddress {
  [token: string]: tEthereumAddress;
}

export type PoolConfiguration = ICommonConfiguration | ISturdyConfiguration | IFantomConfiguration;
