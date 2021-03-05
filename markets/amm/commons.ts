import BigNumber from 'bignumber.js';
import {
  oneEther,
  oneRay,
  RAY,
  ZERO_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
} from '../../helpers/constants';
import { ICommonConfiguration, eEthereumNetwork } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ATokenNamePrefix: 'Aave AMM Market',
  StableDebtTokenNamePrefix: 'Aave AMM Market stable debt',
  VariableDebtTokenNamePrefix: 'Aave AMM Market variable debt',
  SymbolPrefix: 'Amm',
  ProviderId: 0, // Overriden in index.ts
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
    WETH: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    DAI: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    USDC: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    USDT: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    WBTC: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    UniDAIWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniWBTCWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniAAVEWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniBATWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniDAIUSDC: {
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
    BptWBTCWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    BptBALWETH: {
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
  ProviderRegistryOwner: {
    // DEPLOYED WITH CORRECT ADDRESS
    [eEthereumNetwork.kovan]: '0x85e4A467343c0dc4aDAB74Af84448D9c45D8ae6F',
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
    [eEthereumNetwork.buidlerevm]: '', // Updated to match Kovan deployment
    [eEthereumNetwork.kovan]: '0xd00Bd28FAdDa9d5658D1D4e0c151973146C7A533', //'0xE48F95873855bfd97BF89572DDf5cBC44D9c545b'
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
  LendingPoolConfigurator: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '0x36eB31800aa67a9c50df1d56EE01981A6E14Cce5',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderlyMain]: '',
  },
  LendingPool: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '0x78142De7a1930412E9e50dEB3b80dB284c2dFa3A',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderlyMain]: '',
  },
  WethGateway: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '0x1c4A1cC35A477aa1cF35DF671d93ACc04d8131E0',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderlyMain]: '',
  },
  TokenDistributor: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.kovan]: '0x971efe90088f21dc6a36f610ffed77fc19710708',
    [eEthereumNetwork.ropsten]: '0xeba2ea67942b8250d870b12750b594696d02fc9c',
    [eEthereumNetwork.main]: '0xe3d9988f676457123c5fd01297605efdd0cba1ae',
    [eEthereumNetwork.tenderlyMain]: '0xe3d9988f676457123c5fd01297605efdd0cba1ae',
  },
  AaveOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '0x8fb777d67e9945e2c01936e319057f9d41d559e6', // Need to re-deploy because of onlyOwner
    [eEthereumNetwork.ropsten]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: '', //'0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',  // Need to re-deploy because of onlyOwner
    [eEthereumNetwork.tenderlyMain]: '0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',
  },
  FallbackOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '0x50913E8E1c650E790F8a1E741FF9B1B1bB251dfe',
    [eEthereumNetwork.ropsten]: '0xAD1a978cdbb8175b2eaeC47B01404f8AEC5f4F0d',
    [eEthereumNetwork.main]: ZERO_ADDRESS,
    [eEthereumNetwork.tenderlyMain]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.kovan]: {
      USDT: '0x0bF499444525a23E7Bb61997539725cA2e928138',
      WBTC: '0xF7904a295A029a3aBDFFB6F12755974a958C7C25',
      USDC: '0x64EaC61A2DFda2c3Fa04eED49AA33D021AeC8838',
      DAI: '0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541',
      UniDAIWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F', // Mock oracles
      UniWBTCWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      UniAAVEWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      UniBATWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      UniDAIUSDC: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      UniCRVWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      UniLINKWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      UniMKRWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      UniRENWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      UniSNXWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      UniUNIWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      UniUSDCWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      UniWBTCUSDC: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      UniYFIWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      BptWBTCWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      BptBALWETH: '0x5699302154A020FB1DE2B1d39f4c73785A235d8F',
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
    },
    [eEthereumNetwork.ropsten]: {},
    [eEthereumNetwork.main]: {
      USDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      WBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      DAI: '0x773616E4d11A78F511299002da57A0a94577F1f4',
      UniDAIWETH: '0xf4071801C4421Db7e63DaC15B9432e50C44a7F42',
      UniWBTCWETH: '0x55EF7F1226507cFd846DE009C2f097c2211b6Fb8',
      UniAAVEWETH: '0x5671387d56eAB334A2D65d6D0BB4D907898C7abA',
      UniBATWETH: '0xA61ca04DF33B72b235a8A28CfB535bb7A5271B70',
      UniDAIUSDC: '0xFd8dFc92B030e6BA957336e9f08C2a711e19069A',
      UniCRVWETH: '0xd4D344D076256Fdf806375983b2cab2Db52FD506',
      UniLINKWETH: '0x8C0e5df19B998F06e57A1Db1a38232F7590abe4b',
      UniMKRWETH: '0x92f2A28fE33E0b6Ea218057EEe004E3B2B6de45d',
      UniRENWETH: '0xFc0398b247107138dB494395600fB0d075b72C9A',
      UniSNXWETH: '0xF5CB13c859383B5fb070bd111Cae7a900c00BA07',
      UniUNIWETH: '0xE50e47E37DCF55dE1c5F2c32d346BB52064f7CE6',
      UniUSDCWETH: '0xBE6ac123799572c98eFdE48895465AB392534AFD',
      UniWBTCUSDC: '0xd6b8b08a0d13994A5f4a1949F4870DE57e9B40d9',
      UniYFIWETH: '0x94daB35789f05f54224F6851921160DE21318072',
      BptWBTCWETH: '0x4a2731c9f3B4355922c676f9b538278D79C299C5',
      BptBALWETH: '0xD9400999f38E1877a6dDDb0090A327F19257f9AE',
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
    },
    [eEthereumNetwork.tenderlyMain]: {
      USDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      WBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      DAI: '0x773616E4d11A78F511299002da57A0a94577F1f4',
      UniDAIWETH: '0xf4071801C4421Db7e63DaC15B9432e50C44a7F42',
      UniWBTCWETH: '0x55EF7F1226507cFd846DE009C2f097c2211b6Fb8',
      UniAAVEWETH: '0x5671387d56eAB334A2D65d6D0BB4D907898C7abA',
      UniBATWETH: '0xA61ca04DF33B72b235a8A28CfB535bb7A5271B70',
      UniDAIUSDC: '0xFd8dFc92B030e6BA957336e9f08C2a711e19069A',
      UniCRVWETH: '0xd4D344D076256Fdf806375983b2cab2Db52FD506',
      UniLINKWETH: '0x8C0e5df19B998F06e57A1Db1a38232F7590abe4b',
      UniMKRWETH: '0x92f2A28fE33E0b6Ea218057EEe004E3B2B6de45d',
      UniRENWETH: '0xFc0398b247107138dB494395600fB0d075b72C9A',
      UniSNXWETH: '0xF5CB13c859383B5fb070bd111Cae7a900c00BA07',
      UniUNIWETH: '0xE50e47E37DCF55dE1c5F2c32d346BB52064f7CE6',
      UniUSDCWETH: '0xBE6ac123799572c98eFdE48895465AB392534AFD',
      UniWBTCUSDC: '0xd6b8b08a0d13994A5f4a1949F4870DE57e9B40d9',
      UniYFIWETH: '0x94daB35789f05f54224F6851921160DE21318072',
      BptWBTCWETH: '0x4a2731c9f3B4355922c676f9b538278D79C299C5',
      BptBALWETH: '0xD9400999f38E1877a6dDDb0090A327F19257f9AE',
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
    },
  },
  ReserveAssets: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.main]: {},
    [eEthereumNetwork.kovan]: {},
    [eEthereumNetwork.ropsten]: {},
    [eEthereumNetwork.tenderlyMain]: {},
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
