import BigNumber from 'bignumber.js';

export enum eEthereumNetwork {
  buidlerevm = 'buidlerevm',
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
  LendingPoolLiquidationManager = 'LendingPoolLiquidationManager',
  InitializableAdminUpgradeabilityProxy = 'InitializableAdminUpgradeabilityProxy',
  MockFlashLoanReceiver = 'MockFlashLoanReceiver',
  WalletBalanceProvider = 'WalletBalanceProvider',
  AToken = 'AToken',
  MockAToken = 'MockAToken',
  MockStableDebtToken = 'MockStableDebtToken',
  MockVariableDebtToken = 'MockVariableDebtToken',
  AaveProtocolTestHelpers = 'AaveProtocolTestHelpers',
  IERC20Detailed = 'IERC20Detailed',
  StableDebtToken = 'StableDebtToken',
  VariableDebtToken = 'VariableDebtToken',
}

export enum ProtocolErrors {
  // require error messages - ValidationLogic
  AMOUNT_NOT_GREATER_THAN_0 = '1', // 'Amount must be greater than 0'
  NO_ACTIVE_RESERVE = '2', // 'Action requires an active reserve'
  NO_UNFREEZED_RESERVE = '3', // 'Action requires an unfreezed reserve'
  CURRENT_AVAILABLE_LIQUIDITY_NOT_ENOUGH = '4', // 'The current liquidity is not enough'
  NOT_ENOUGH_AVAILABLE_USER_BALANCE = '5', // 'User cannot withdraw more than the available balance'
  TRANSFER_NOT_ALLOWED = '6', // 'Transfer cannot be allowed.'
  BORROWING_NOT_ENABLED = '7', // 'Borrowing is not enabled'
  INVALID_INTERESTRATE_MODE_SELECTED = '8', // 'Invalid interest rate mode selected'
  COLLATERAL_BALANCE_IS_0 = '9', // 'The collateral balance is 0'
  HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD = '10', // 'Health factor is lesser than the liquidation threshold'
  COLLATERAL_CANNOT_COVER_NEW_BORROW = '11', // 'There is not enough collateral to cover a new borrow'
  STABLE_BORROWING_NOT_ENABLED = '12', // stable borrowing not enabled
  CALLATERAL_SAME_AS_BORROWING_CURRENCY = '13', // collateral is (mostly) the same currency that is being borrowed
  AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE = '14', // 'The requested amount is greater than the max loan size in stable rate mode
  NO_DEBT_OF_SELECTED_TYPE = '15', // 'for repayment of stable debt, the user needs to have stable debt, otherwise, he needs to have variable debt'
  NO_EPLICIT_AMOUNT_TO_REPAY_ON_BEHALF = '16', // 'To repay on behalf of an user an explicit amount to repay is needed'
  NO_STABLE_RATE_LOAN_IN_RESERVE = '17', // 'User does not have a stable rate loan in progress on this reserve'
  NO_VARIABLE_RATE_LOAN_IN_RESERVE = '18', // 'User does not have a variable rate loan in progress on this reserve'
  UNDERLYING_BALANCE_NOT_GREATER_THAN_0 = '19', // 'The underlying balance needs to be greater than 0'
  DEPOSIT_ALREADY_IN_USE = '20', // 'User deposit is already being used as collateral'

  // require error messages - LendingPool
  NOT_ENOUGH_STABLE_BORROW_BALANCE = '21', // 'User does not have any stable rate loan for this reserve'
  INTERESTRATE_REBALANCE_CONDITIONS_NOT_MET = '22', // 'Interest rate rebalance conditions were not met'
  LIQUIDATION_CALL_FAILED = '23', // 'Liquidation call failed'
  NOT_ENOUGH_LIQUIDITY_TO_BORROW = '24', // 'There is not enough liquidity available to borrow'
  REQUESTED_AMOUNT_TO_SMALL = '25', // 'The requested amount is too small for a FlashLoan.'
  INCONSISTENT_PROTOCOL_ACTUAL_BALANCE = '26', // 'The actual balance of the protocol is inconsistent'

  // require error messages - aToken
  CALLER_MUST_BE_LENDING_POOL = '27', // 'The caller of this function must be a lending pool'
  TRANSFER_CANNOT_BE_ALLOWED = '28', // 'Transfer cannot be allowed.'
  NOT_ALLOWED_TO_REDIRECT_INTEREST = '29', // 'Caller is not allowed to redirect the interest of the user'
  CANNOT_GIVE_ALLOWANCE_TO_HIMSELF = '30', // 'User cannot give allowance to himself'
  TRANSFER_AMOUNT_NOT_GT_0 = '31', // 'Transferred amount needs to be greater than zero'
  INTEREST_ALREADY_REDIRECTED = '32', // 'Interest is already redirected to the user'
  NO_VALID_BALANCE_FOR_REDIRECT_INT_STREAM = '33', // 'Interest stream can only be redirected if there is a valid balance'

  // old

  INVALID_CONFIGURATOR_CALLER_MSG = 'The caller must be a lending pool configurator contract',
  INVALID_POOL_CALLER_MSG = 'The caller must be a lending pool contract',
  // INVALID_POOL_CALLER_MSG_1 = 'The caller of this function must be a lending pool', => CALLER_MUST_BE_LENDING_POOL
  INVALID_POOL_MANAGER_CALLER_MSG = 'The caller must be a lending pool manager',
  INVALID_FROM_BALANCE_AFTER_TRANSFER = 'Invalid from balance after transfer',
  INVALID_TO_BALANCE_AFTER_TRANSFER = 'Invalid from balance after transfer',
  INVALID_OWNER_REVERT_MSG = 'Ownable: caller is not the owner',
  INVALID_REDIRECTED_BALANCE_BEFORE_TRANSFER = 'Invalid redirected balance before transfer',
  INVALID_REDIRECTED_BALANCE_AFTER_TRANSFER = 'Invalid redirected balance after transfer',
  INVALID_REDIRECTION_ADDRESS = 'Invalid redirection address',
  TRANSFERRED_AMOUNT_GT_ZERO = 'Transferred amount needs to be greater than zero',
  ZERO_COLLATERAL = 'The collateral balance is 0',
  INCONSISTENT_PROTOCOL_BALANCE = 'The actual balance of the protocol is inconsistent',
  TOO_SMALL_FLASH_LOAN = 'The requested amount is too small for a FlashLoan.',
  // NOT_ENOUGH_LIQUIDITY_TO_BORROW = 'There is not enough liquidity available to borrow',
  HF_IS_NOT_BELLOW_THRESHOLD = 'Health factor is not below the threshold',
  INVALID_HF = 'Invalid health factor',
  USER_DID_NOT_BORROW_SPECIFIED = 'User did not borrow the specified currency',
  THE_COLLATERAL_CHOSEN_CANNOT_BE_LIQUIDATED = 'The collateral chosen cannot be liquidated',
}

export enum OLD_ProtocolErrors {
  INVALID_CONFIGURATOR_CALLER_MSG = 'The caller must be a lending pool configurator contract',
  INVALID_POOL_CALLER_MSG = 'The caller must be a lending pool contract',
  // INVALID_POOL_CALLER_MSG_1 = 'The caller of this function must be a lending pool', => CALLER_MUST_BE_LENDING_POOL
  INVALID_POOL_MANAGER_CALLER_MSG = 'The caller must be a lending pool manager',
  INVALID_FROM_BALANCE_AFTER_TRANSFER = 'Invalid from balance after transfer',
  INVALID_TO_BALANCE_AFTER_TRANSFER = 'Invalid from balance after transfer',
  INVALID_OWNER_REVERT_MSG = 'Ownable: caller is not the owner',
  INVALID_REDIRECTED_BALANCE_BEFORE_TRANSFER = 'Invalid redirected balance before transfer',
  INVALID_REDIRECTED_BALANCE_AFTER_TRANSFER = 'Invalid redirected balance after transfer',
  INVALID_REDIRECTION_ADDRESS = 'Invalid redirection address',
  TRANSFERRED_AMOUNT_GT_ZERO = 'Transferred amount needs to be greater than zero',
  ZERO_COLLATERAL = 'The collateral balance is 0',
  INCONSISTENT_PROTOCOL_BALANCE = 'The actual balance of the protocol is inconsistent',
  TOO_SMALL_FLASH_LOAN = 'The requested amount is too small for a FlashLoan.',
  NOT_ENOUGH_LIQUIDITY_TO_BORROW = 'There is not enough liquidity available to borrow',
  HF_IS_NOT_BELLOW_THRESHOLD = 'Health factor is not below the threshold',
  INVALID_HF = 'Invalid health factor',
  USER_DID_NOT_BORROW_SPECIFIED = 'User did not borrow the specified currency',
  THE_COLLATERAL_CHOSEN_CANNOT_BE_LIQUIDATED = 'The collateral chosen cannot be liquidated',
}

export type tEthereumAddress = string;
export type tStringTokenBigUnits = string; // 1 ETH, or 10e6 USDC or 10e18 DAI
export type tBigNumberTokenBigUnits = BigNumber;
export type tStringTokenSmallUnits = string; // 1 wei, or 1 basic unit of USDC, or 1 basic unit of DAI
export type tBigNumberTokenSmallUnits = BigNumber;

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
  | 'WETH'
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

export type iMultiPoolsAssets<T> = iAavePoolAssets<T> | iAaveSecondPoolAssets<T>;

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
