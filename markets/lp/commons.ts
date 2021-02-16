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
  LpDAI: oneEther.multipliedBy('0.00369068412860').toFixed(),
  LpUSDC: oneEther.multipliedBy('0.00367714136416').toFixed(),
  LpUSDT: oneEther.multipliedBy('0.00369068412860').toFixed(),
  LpWBTC: oneEther.multipliedBy('47.332685').toFixed(),
  LpWETH: oneEther.toFixed(),
  LpUniDAIWETH: oneEther.multipliedBy('22.407436').toFixed(),
  LpUniWBTCWETH: oneEther.multipliedBy('22.407436').toFixed(),
  LpUniAAVEWETH: oneEther.multipliedBy('0.003620948469').toFixed(),
  LpUniBATWETH: oneEther.multipliedBy('22.407436').toFixed(),
  LpUniUSDCDAI: oneEther.multipliedBy('22.407436').toFixed(),
  LpUniCRVWETH: oneEther.multipliedBy('22.407436').toFixed(),
  LpUniLINKWETH: oneEther.multipliedBy('0.009955').toFixed(),
  LpUniMKRWETH: oneEther.multipliedBy('22.407436').toFixed(),
  LpUniRENWETH: oneEther.multipliedBy('22.407436').toFixed(),
  LpUniSNXWETH: oneEther.multipliedBy('22.407436').toFixed(),
  LpUniUNIWETH: oneEther.multipliedBy('22.407436').toFixed(),
  LpUniUSDCWETH: oneEther.multipliedBy('22.407436').toFixed(),
  LpUniWBTCUSDC: oneEther.multipliedBy('22.407436').toFixed(),
  LpUniYFIWETH: oneEther.multipliedBy('22.407436').toFixed(),
  LpBalWBTCWETH: oneEther.multipliedBy('22.407436').toFixed(),
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
    LpWETH: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    LpDAI: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    LpUSDC: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    LpUSDT: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    LpWBTC: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    LpUniDAIWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniWBTCWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniAAVEWETH:{
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniBATWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniUSDCDAI: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniCRVWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniLINKWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniMKRWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniRENWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniSNXWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniUNIWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniUSDCWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniWBTCUSDC: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpUniYFIWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    LpBalWBTCWETH: {
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
    [eEthereumNetwork.kovan]: '', //'0xdCde9Bb6a49e37fA433990832AB541AE2d4FEB4a', // Need to re-deploy because of onlyOwner
    [eEthereumNetwork.ropsten]: '0x05dcca805a6562c1bdd0423768754acb6993241b',
    [eEthereumNetwork.main]: '', //'0x8A32f49FFbA88aba6EFF96F45D8BD1D4b3f35c7D',  // Need to re-deploy because of onlyOwner
    [eEthereumNetwork.tenderlyMain]: '0x8A32f49FFbA88aba6EFF96F45D8BD1D4b3f35c7D',
  },
  LendingPoolCollateralManager: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '0x9269b6453d0d75370c4c85e5a42977a53efdb72a',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '0xbd4765210d4167CE2A5b87280D9E8Ee316D5EC7C',
    [eEthereumNetwork.tenderlyMain]: '0xbd4765210d4167CE2A5b87280D9E8Ee316D5EC7C',
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
    [EthereumNetwork.kovan]: '',//'0xB8bE51E6563BB312Cbb2aa26e352516c25c26ac1', // Need to re-deploy because of onlyOwner
    [EthereumNetwork.ropsten]: ZERO_ADDRESS,
    [EthereumNetwork.main]: '',//'0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',  // Need to re-deploy because of onlyOwner
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
      LpUSDT: '0x0bF499444525a23E7Bb61997539725cA2e928138',
      LpWBTC: '0xF7904a295A029a3aBDFFB6F12755974a958C7C25',
      LpUSDC: '0x64EaC61A2DFda2c3Fa04eED49AA33D021AeC8838',
      LpDAI:'0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541',
      LpUniDAIWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',   // Mock oracles
      LpUniWBTCWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',  
      LpUniAAVEWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      LpUniBATWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      LpUniUSDCDAI: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      LpUniCRVWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      LpUniLINKWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      LpUniMKRWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      LpUniRENWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      LpUniSNXWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      LpUniUNIWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      LpUniUSDCWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      LpUniWBTCUSDC: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      LpUniYFIWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      LpBalWBTCWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
    },
    [EthereumNetwork.ropsten]: {
    },
    [EthereumNetwork.main]: {
      LpUSDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      LpWBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      LpUSDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      LpDAI:'0x773616E4d11A78F511299002da57A0a94577F1f4',
      LpUniDAIWETH: '0xf4071801C4421Db7e63DaC15B9432e50C44a7F42',
      LpUniWBTCWETH: ZERO_ADDRESS,
      LpUniAAVEWETH: ZERO_ADDRESS,
      LpUniBATWETH: ZERO_ADDRESS,
      LpUniUSDCDAI: ZERO_ADDRESS,
      LpUniCRVWETH: ZERO_ADDRESS,
      LpUniLINKWETH: ZERO_ADDRESS,
      LpUniMKRWETH: ZERO_ADDRESS,
      LpUniRENWETH: ZERO_ADDRESS,
      LpUniSNXWETH: ZERO_ADDRESS,
      LpUniUNIWETH: ZERO_ADDRESS,
      LpUniUSDCWETH: ZERO_ADDRESS,
      LpUniWBTCUSDC: ZERO_ADDRESS,
      LpUniYFIWETH: ZERO_ADDRESS,
      LpBalWBTCWETH: ZERO_ADDRESS,
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
    },
    [EthereumNetwork.tenderlyMain]: {
      LpUSDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      LpWBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      LpUSDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      LpDAI:'0x773616E4d11A78F511299002da57A0a94577F1f4',
      LpUniDAIWETH: ZERO_ADDRESS,
      LpUniWBTCWETH: ZERO_ADDRESS,
      LpUniAAVEWETH: ZERO_ADDRESS,
      LpUniBATWETH: ZERO_ADDRESS,
      LpUniUSDCDAI: ZERO_ADDRESS,
      LpUniCRVWETH: ZERO_ADDRESS,
      LpUniLINKWETH: ZERO_ADDRESS,
      LpUniMKRWETH: ZERO_ADDRESS,
      LpUniRENWETH: ZERO_ADDRESS,
      LpUniSNXWETH: ZERO_ADDRESS,
      LpUniUNIWETH: ZERO_ADDRESS,
      LpUniUSDCWETH: ZERO_ADDRESS,
      LpUniWBTCUSDC: ZERO_ADDRESS,
      LpUniYFIWETH: ZERO_ADDRESS,
      LpBalWBTCWETH: ZERO_ADDRESS,
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
