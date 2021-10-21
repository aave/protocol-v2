import BigNumber from 'bignumber.js';
import { oneEther, oneRay, RAY, ZERO_ADDRESS, MOCK_CHAINLINK_AGGREGATORS_PRICES } from '../../helpers/constants';
import { ICommonConfiguration, eEthereumNetwork } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'RealT',
  ATokenNamePrefix: 'Aave RealT market',
  StableDebtTokenNamePrefix: 'Aave RealT Market stable debt',
  VariableDebtTokenNamePrefix: 'Aave RealT Market variable debt',
  SymbolPrefix: '',
  ProviderId: 0, // Overridden in index.ts
  OracleQuoteCurrency: 'ETH',
  OracleQuoteUnit: oneEther.toString(),
  ProtocolGlobalParams: {
    TokenDistributorPercentageBase: '10000',
    MockUsdPriceInWei: '238095238095238',
    UsdAddress: '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96',
    NilAddress: '0x0000000000000000000000000000000000000000',
    OneAddress: '0x0000000000000000000000000000000000000001',
    AaveReferral: '0',
  },

  // ----------------
  // COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
  // ----------------

  Mocks: {
    AllAssetsInitialPrices: {
      ...MOCK_CHAINLINK_AGGREGATORS_PRICES,
      "REALTOKEN-S-13895-SARATOGA-ST-DETROIT-MI": '12940476190476185',
      "REALTOKEN-S-4380-BEACONSFIELD-ST-DETROIT-MI": '12269047619047614',
      "REALTOKEN-S-17813-BRADFORD-ST-DETROIT-M": '11816666666666661',
      "REALTOKEN-S-15796-HARTWELL-ST-DETROIT-MI": '12047619047619042',
      "REALTOKEN-S-9717-EVERTS-ST-DETROIT-MI": '11376190476190471',
      "REALTOKEN-S-19201-WESTPHALIA-ST-DETROIT-MI": '11816666666666661',
      "REALTOKEN-S-19163-MITCHELL-ST-DETROIT-MI": '12257142857142852',
      "REALTOKEN-S-4061-GRAND-ST-DETROIT-M": '13873809523809518',
      "REALTOKEN-S-4680-BUCKINGHAM-AVE-DETROIT-MI": '11385714285714281',
      "REALTOKEN-S-19311-KEYSTONE-ST-DETROIT-MI": '11804761904761900',
    },
  },
  // TODO: reorg alphabetically, checking the reason of tests failing
  LendingRateOracleRatesCommon: {
    'REALTOKEN-S-13895-SARATOGA-ST-DETROIT-MI': {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    'REALTOKEN-S-4380-BEACONSFIELD-ST-DETROIT-MI': {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    'REALTOKEN-S-17813-BRADFORD-ST-DETROIT-M': {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    'REALTOKEN-S-15796-HARTWELL-ST-DETROIT-MI': {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    "REALTOKEN-S-9717-EVERTS-ST-DETROIT-MI": {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    "REALTOKEN-S-19201-WESTPHALIA-ST-DETROIT-MI": {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    "REALTOKEN-S-19163-MITCHELL-ST-DETROIT-MI": {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    "REALTOKEN-S-4061-GRAND-ST-DETROIT-M": {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    "REALTOKEN-S-4680-BUCKINGHAM-AVE-DETROIT-MI": {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    "REALTOKEN-S-19311-KEYSTONE-ST-DETROIT-MI": {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.buidlerevm]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.kovan]: undefined,
    [eEthereumNetwork.ropsten]: undefined,
    [eEthereumNetwork.main]: undefined,
    [eEthereumNetwork.tenderly]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.buidlerevm]: undefined,
    [eEthereumNetwork.kovan]: undefined,
    [eEthereumNetwork.ropsten]: undefined,
    [eEthereumNetwork.main]: undefined,
    [eEthereumNetwork.tenderly]: undefined,
  },
  EmergencyAdminIndex: 1,
  ProviderRegistry: {
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.kovan]: '0x5Fc96c182Bb7E0413c08e8e03e9d7EFc6cf0B099',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  LendingRateOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
  },  
  LendingPoolCollateralManager: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  LendingPoolConfigurator: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  LendingPool: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  WethGateway: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '0xf99b8E67a0E044734B01EC4586D1c88C9a869718',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  TokenDistributor: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  AaveOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  FallbackOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: ZERO_ADDRESS,
    [eEthereumNetwork.tenderly]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.kovan]: {
      "REALTOKEN-S-13895-SARATOGA-ST-DETROIT-MI": '',
      "REALTOKEN-S-4380-BEACONSFIELD-ST-DETROIT-MI": '',
      "REALTOKEN-S-17813-BRADFORD-ST-DETROIT-M": '',
      "REALTOKEN-S-15796-HARTWELL-ST-DETROIT-MI": '',
      "REALTOKEN-S-9717-EVERTS-ST-DETROIT-MI": '',
      "REALTOKEN-S-19201-WESTPHALIA-ST-DETROIT-MI": '',
      "REALTOKEN-S-19163-MITCHELL-ST-DETROIT-MI": '',
      "REALTOKEN-S-4061-GRAND-ST-DETROIT-M": '',
      "REALTOKEN-S-4680-BUCKINGHAM-AVE-DETROIT-MI": '',
      "REALTOKEN-S-19311-KEYSTONE-ST-DETROIT-MI": '',
    },
    [eEthereumNetwork.ropsten]: {
    },
    [eEthereumNetwork.main]: {
    },
    [eEthereumNetwork.tenderly]: {
    },
  },
  ReserveAssets: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.main]: {},
    [eEthereumNetwork.kovan]: {},
    [eEthereumNetwork.ropsten]: {},
    [eEthereumNetwork.tenderly]: {},
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eEthereumNetwork.coverage]:
      '0x95b73a72c6ecf4ccbbba5178800023260bad8e75cdccdb8e4827a2977a37c820',
    [eEthereumNetwork.hardhat]:
      '0xbae024d959c6a022dc5ed37294cd39c141034b2ae5f02a955cce75c930a81bf5',
    [eEthereumNetwork.buidlerevm]:
      '0xbae024d959c6a022dc5ed37294cd39c141034b2ae5f02a955cce75c930a81bf5',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  WETH: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.buidlerevm]: '', // deployed in local evm
    [eEthereumNetwork.kovan]: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    [eEthereumNetwork.ropsten]: '0xc778417e063141139fce010982780140aa0cd5ab',
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    [eEthereumNetwork.tenderly]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  ReserveFactorTreasuryAddress: {
    [eEthereumNetwork.coverage]: '0x963309A278145D6c42725E454fE91c9471D9907a',
    [eEthereumNetwork.hardhat]: '0x963309A278145D6c42725E454fE91c9471D9907a',
    [eEthereumNetwork.buidlerevm]: '0x963309A278145D6c42725E454fE91c9471D9907a',
    [eEthereumNetwork.kovan]: '0x963309A278145D6c42725E454fE91c9471D9907a',
    [eEthereumNetwork.ropsten]: '0x963309A278145D6c42725E454fE91c9471D9907a',
    [eEthereumNetwork.main]: '0x963309A278145D6c42725E454fE91c9471D9907a',
    [eEthereumNetwork.tenderly]: '0x963309A278145D6c42725E454fE91c9471D9907a',
  },
  WrappedNativeToken: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.buidlerevm]: '', // deployed in local evm
    [eEthereumNetwork.kovan]: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    [eEthereumNetwork.ropsten]: '0xc778417e063141139fce010982780140aa0cd5ab',
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    [eEthereumNetwork.tenderly]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  IncentivesController: {
    [eEthereumNetwork.coverage]: ZERO_ADDRESS,
    [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
    [eEthereumNetwork.buidlerevm]: ZERO_ADDRESS,
    [eEthereumNetwork.kovan]: ZERO_ADDRESS,
    [eEthereumNetwork.ropsten]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: ZERO_ADDRESS,
    [eEthereumNetwork.tenderly]: ZERO_ADDRESS,
  },
};
