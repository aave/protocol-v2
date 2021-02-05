import BigNumber from 'bignumber.js';
import { oneEther, oneRay, RAY, ZERO_ADDRESS } from '../../helpers/constants';
import { ICommonConfiguration, EthereumNetwork, eEthereumNetwork } from '../../helpers/types';

const MOCK_CHAINLINK_AGGREGATORS_PRICES = {
  AAVE: oneEther.multipliedBy('0.003620948469').toFixed(),
  BAT: oneEther.multipliedBy('0.00137893825230').toFixed(),
  BUSD: oneEther.multipliedBy('0.00736484').toFixed(),
  DAI: oneEther.multipliedBy('0.00369068412860').toFixed(),
  ENJ: oneEther.multipliedBy('0.00029560').toFixed(),
  KNC: oneEther.multipliedBy('0.001072').toFixed(),
  LINK: oneEther.multipliedBy('0.009955').toFixed(),
  MANA: oneEther.multipliedBy('0.000158').toFixed(),
  MKR: oneEther.multipliedBy('2.508581').toFixed(),
  REN: oneEther.multipliedBy('0.00065133').toFixed(),
  SNX: oneEther.multipliedBy('0.00442616').toFixed(),
  SUSD: oneEther.multipliedBy('0.00364714136416').toFixed(),
  TUSD: oneEther.multipliedBy('0.00364714136416').toFixed(),
  UNI: oneEther.multipliedBy('0.00536479').toFixed(),
  USDC: oneEther.multipliedBy('0.00367714136416').toFixed(),
  USDT: oneEther.multipliedBy('0.00369068412860').toFixed(),
  WETH: oneEther.toFixed(),
  WBTC: oneEther.multipliedBy('47.332685').toFixed(),
  YFI: oneEther.multipliedBy('22.407436').toFixed(),
  ZRX: oneEther.multipliedBy('0.001151').toFixed(),
  UniDAI: oneEther.multipliedBy('0.00369068412860').toFixed(),
  UniUSDC: oneEther.multipliedBy('0.00367714136416').toFixed(),
  UniUSDT: oneEther.multipliedBy('0.00369068412860').toFixed(),
  UniWBTC: oneEther.multipliedBy('47.332685').toFixed(),
  UniWETH: oneEther.toFixed(),
  UniDAIWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniWBTCWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniAAVEWETH: oneEther.multipliedBy('0.003620948469').toFixed(),
  UniBATWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniUSDCDAI: oneEther.multipliedBy('22.407436').toFixed(),
  UniCRVWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniLINKWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniMKRWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniRENWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniSNXWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniUNIWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniUSDCWETH: oneEther.multipliedBy('22.407436').toFixed(),
  UniWBTCUSDC: oneEther.multipliedBy('22.407436').toFixed(),
  UniYFIWETH: oneEther.multipliedBy('22.407436').toFixed(),
  USD: '5848466240000000',
};
// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ProviderId: 0,
  ProtocolGlobalParams: {
    TokenDistributorPercentageBase: '10000',
    MockUsdPriceInWei: '5848466240000000',
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
    },
  },
  // TODO: reorg alphabetically, checking the reason of tests failing
  LendingRateOracleRatesCommon: {
    UniWETH: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    UniDAI: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    UniUSDC: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    UniUSDT: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    UniWBTC: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    UniDAIWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniWBTCWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniAAVEWETH:{
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniBATWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniUSDCDAI: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniCRVWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniLINKWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniMKRWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniRENWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniSNXWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniUNIWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniUSDCWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniWBTCUSDC: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniYFIWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
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
    [eEthereumNetwork.tenderlyMain]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.buidlerevm]: undefined,
    [eEthereumNetwork.kovan]: undefined,
    [eEthereumNetwork.ropsten]: undefined,
    [eEthereumNetwork.main]: undefined,
    [eEthereumNetwork.tenderlyMain]: undefined,
  },
  EmergencyAdminIndex: 1,
  ProviderRegistry: {
    [eEthereumNetwork.kovan]: '0x1E40B561EC587036f9789aF83236f057D1ed2A90',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '0x52D306e36E3B6B02c153d0266ff0f85d18BCD413',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.tenderlyMain]: '0x52D306e36E3B6B02c153d0266ff0f85d18BCD413',
  },
  ProviderRegistryOwner: { // TEMPORARILY USING MY DEPLOYER
    [eEthereumNetwork.kovan]: '0x18d9bA2baEfBdE0FF137C4ad031427EF205f1Fd9',//'0x85e4A467343c0dc4aDAB74Af84448D9c45D8ae6F',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '0xbd723fc4f1d737dcfc48a07fe7336766d34cad5f',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.tenderlyMain]: '0xbd723fc4f1d737dcfc48a07fe7336766d34cad5f',
  },
  LendingRateOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '',//'0xdCde9Bb6a49e37fA433990832AB541AE2d4FEB4a',
    [eEthereumNetwork.ropsten]: '0x05dcca805a6562c1bdd0423768754acb6993241b',
    [eEthereumNetwork.main]: '', //'0x8A32f49FFbA88aba6EFF96F45D8BD1D4b3f35c7D',
    [eEthereumNetwork.tenderlyMain]: '0x8A32f49FFbA88aba6EFF96F45D8BD1D4b3f35c7D',
  },
  TokenDistributor: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.hardhat]: '',
    [EthereumNetwork.kovan]: '0x971efe90088f21dc6a36f610ffed77fc19710708',
    [EthereumNetwork.ropsten]: '0xeba2ea67942b8250d870b12750b594696d02fc9c',
    [EthereumNetwork.main]: '0xe3d9988f676457123c5fd01297605efdd0cba1ae',
    [EthereumNetwork.tenderlyMain]: '0xe3d9988f676457123c5fd01297605efdd0cba1ae',
  },
  AaveOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [EthereumNetwork.kovan]: '',//'0xB8bE51E6563BB312Cbb2aa26e352516c25c26ac1',
    [EthereumNetwork.ropsten]: ZERO_ADDRESS,
    [EthereumNetwork.main]: '', //'0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',
    [EthereumNetwork.tenderlyMain]: '0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',
  },
  FallbackOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [EthereumNetwork.kovan]: '0x50913E8E1c650E790F8a1E741FF9B1B1bB251dfe',
    [EthereumNetwork.ropsten]: '0xAD1a978cdbb8175b2eaeC47B01404f8AEC5f4F0d',
    [EthereumNetwork.main]: ZERO_ADDRESS,
    [EthereumNetwork.tenderlyMain]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [EthereumNetwork.kovan]: {
      UniUSDT: '0x0bF499444525a23E7Bb61997539725cA2e928138',
      UniWBTC: '0xF7904a295A029a3aBDFFB6F12755974a958C7C25',
      UniUSDC: '0x64EaC61A2DFda2c3Fa04eED49AA33D021AeC8838',
      UniDAI:'0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541',
      UniDAIWETH: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',   // Mock oracles
      UniWBTCWETH: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',  
      UniAAVEWETH: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',
      UniBATWETH: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',
      UniUSDCDAI: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',
      UniCRVWETH: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',
      UniLINKWETH: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',
      UniMKRWETH: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',
      UniRENWETH: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',
      UniSNXWETH: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',
      UniUNIWETH: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',
      UniUSDCWETH: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',
      UniWBTCUSDC: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',
      UniYFIWETH: '0x90B86B501BF4d800a7F76E551952E214Cc58Fba3',
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
    },
    [EthereumNetwork.ropsten]: {
    },
    [EthereumNetwork.main]: {
      UniUSDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      UniWBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      UniUSDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      UniDAI:'0x773616E4d11A78F511299002da57A0a94577F1f4',
      UniDAIWETH: '0xf4071801C4421Db7e63DaC15B9432e50C44a7F42',
      UniWBTCWETH: ZERO_ADDRESS,
      UniAAVEWETH: ZERO_ADDRESS,
      UniBATWETH: ZERO_ADDRESS,
      UniUSDCDAI: ZERO_ADDRESS,
      UniCRVWETH: ZERO_ADDRESS,
      UniLINKWETH: ZERO_ADDRESS,
      UniMKRWETH: ZERO_ADDRESS,
      UniRENWETH: ZERO_ADDRESS,
      UniSNXWETH: ZERO_ADDRESS,
      UniUNIWETH: ZERO_ADDRESS,
      UniUSDCWETH: ZERO_ADDRESS,
      UniWBTCUSDC: ZERO_ADDRESS,
      UniYFIWETH: ZERO_ADDRESS,
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
    },
    [EthereumNetwork.tenderlyMain]: {
      UniUSDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      UniWBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      UniUSDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      UniDAI:'0x773616E4d11A78F511299002da57A0a94577F1f4',
      UniDAIWETH: ZERO_ADDRESS,
      UniWBTCWETH: ZERO_ADDRESS,
      UniAAVEWETH: ZERO_ADDRESS,
      UniBATWETH: ZERO_ADDRESS,
      UniUSDCDAI: ZERO_ADDRESS,
      UniCRVWETH: ZERO_ADDRESS,
      UniLINKWETH: ZERO_ADDRESS,
      UniMKRWETH: ZERO_ADDRESS,
      UniRENWETH: ZERO_ADDRESS,
      UniSNXWETH: ZERO_ADDRESS,
      UniUNIWETH: ZERO_ADDRESS,
      UniUSDCWETH: ZERO_ADDRESS,
      UniWBTCUSDC: ZERO_ADDRESS,
      UniYFIWETH: ZERO_ADDRESS,
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
    },
  },
  ReserveAssets: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [EthereumNetwork.main]: {},
    [EthereumNetwork.kovan]: {},
    [EthereumNetwork.ropsten]: {},
    [EthereumNetwork.tenderlyMain]: {},
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
    [eEthereumNetwork.tenderlyMain]: '',
  },
  WETH: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.buidlerevm]: '', // deployed in local evm
    [eEthereumNetwork.kovan]: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    [eEthereumNetwork.ropsten]: '0xc778417e063141139fce010982780140aa0cd5ab',
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    [eEthereumNetwork.tenderlyMain]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  ReserveFactorTreasuryAddress: {
    [eEthereumNetwork.coverage]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.hardhat]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.buidlerevm]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.kovan]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.ropsten]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.main]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.tenderlyMain]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
  },
};
