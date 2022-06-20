import BigNumber from 'bignumber.js';
import {
  oneEther,
  oneRay,
  RAY,
  ZERO_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  oneUsd,
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
  OracleQuoteCurrency: 'ETH',
  OracleQuoteUnit: oneEther.toString(),
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
    [eEthereumNetwork.main]: undefined,
    [eEthereumNetwork.tenderly]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.buidlerevm]: undefined,
    [eEthereumNetwork.main]: undefined,
    [eEthereumNetwork.tenderly]: undefined,
  },
  EmergencyAdminIndex: 1,
  ProviderRegistry: {
    [eEthereumNetwork.main]: '0x52D306e36E3B6B02c153d0266ff0f85d18BCD413',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.tenderly]: '0x52D306e36E3B6B02c153d0266ff0f85d18BCD413',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.main]: '0xB9062896ec3A615a4e4444DF183F0531a77218AE',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.tenderly]: '0xB9062896ec3A615a4e4444DF183F0531a77218AE',
  },
  LendingRateOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '', // Updated to match Kovan deployment
    [eEthereumNetwork.main]: '', //'0x8A32f49FFbA88aba6EFF96F45D8BD1D4b3f35c7D',  // Need to re-deploy because of onlyOwner
    [eEthereumNetwork.tenderly]: '0x8A32f49FFbA88aba6EFF96F45D8BD1D4b3f35c7D',
  },
  LendingPoolCollateralManager: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.main]: '0xbd4765210d4167CE2A5b87280D9E8Ee316D5EC7C',
    [eEthereumNetwork.tenderly]: '0xbd4765210d4167CE2A5b87280D9E8Ee316D5EC7C',
  },
  LendingPoolConfigurator: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  LendingPool: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  WethGateway: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  TokenDistributor: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '0xe3d9988f676457123c5fd01297605efdd0cba1ae',
    [eEthereumNetwork.tenderly]: '0xe3d9988f676457123c5fd01297605efdd0cba1ae',
  },
  AaveOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.main]: '', //'0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',  // Need to re-deploy because of onlyOwner
    [eEthereumNetwork.tenderly]: '0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',
  },
  FallbackOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.main]: ZERO_ADDRESS,
    [eEthereumNetwork.tenderly]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.main]: {
      USDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      WBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      DAI: '0x773616E4d11A78F511299002da57A0a94577F1f4',
      UniDAIWETH: '0x66a6b87a18db78086acda75b7720dc47cdabcc05',
      UniWBTCWETH: '0x7004BB6F2013F13C54899309cCa029B49707E547',
      UniAAVEWETH: '0xB525547968610395B60085bDc8033FFeaEaa5F64',
      UniBATWETH: '0xB394D8a1CE721630Cbea8Ec110DCEf0D283EDE3a',
      UniDAIUSDC: '0x3B148Fa5E8297DB64262442052b227328730EA81',
      UniCRVWETH: '0x10F7078e2f29802D2AC78045F61A69aE0883535A',
      UniLINKWETH: '0x30adCEfA5d483284FD79E1eFd54ED3e0A8eaA632',
      UniMKRWETH: '0xEBF4A448ff3D835F8FA883941a3E9D5E74B40B5E',
      UniRENWETH: '0xe2f7C06906A9dB063C28EB5c71B6Ab454e5222dD',
      UniSNXWETH: '0x29bfee7E90572Abf1088a58a145a10D051b78E46',
      UniUNIWETH: '0xC2E93e8121237A885A00627975eB06C7BF9808d6',
      UniUSDCWETH: '0x71c4a2173CE3620982DC8A7D870297533360Da4E',
      UniWBTCUSDC: '0x11f4ba2227F21Dc2A9F0b0e6Ea740369d580a212',
      UniYFIWETH: '0x664223b8Bb0934aE0970e601F452f75AaCe9Aa2A',
      BptWBTCWETH: '0x4CA8D8fC2b4fCe8A2dcB71Da884bba042d48E067',
      BptBALWETH: '0x2e4e78936b100be6Ef85BCEf7FB25bC770B02B85',
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
    },
    [eEthereumNetwork.tenderly]: {
      USDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      WBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      DAI: '0x773616E4d11A78F511299002da57A0a94577F1f4',
      UniDAIWETH: '0x66a6b87a18db78086acda75b7720dc47cdabcc05',
      UniWBTCWETH: '0x7004BB6F2013F13C54899309cCa029B49707E547',
      UniAAVEWETH: '0xB525547968610395B60085bDc8033FFeaEaa5F64',
      UniBATWETH: '0xB394D8a1CE721630Cbea8Ec110DCEf0D283EDE3a',
      UniDAIUSDC: '0x3B148Fa5E8297DB64262442052b227328730EA81',
      UniCRVWETH: '0x10F7078e2f29802D2AC78045F61A69aE0883535A',
      UniLINKWETH: '0x30adCEfA5d483284FD79E1eFd54ED3e0A8eaA632',
      UniMKRWETH: '0xEBF4A448ff3D835F8FA883941a3E9D5E74B40B5E',
      UniRENWETH: '0xe2f7C06906A9dB063C28EB5c71B6Ab454e5222dD',
      UniSNXWETH: '0x29bfee7E90572Abf1088a58a145a10D051b78E46',
      UniUNIWETH: '0xC2E93e8121237A885A00627975eB06C7BF9808d6',
      UniUSDCWETH: '0x71c4a2173CE3620982DC8A7D870297533360Da4E',
      UniWBTCUSDC: '0x11f4ba2227F21Dc2A9F0b0e6Ea740369d580a212',
      UniYFIWETH: '0x664223b8Bb0934aE0970e601F452f75AaCe9Aa2A',
      BptWBTCWETH: '0x4CA8D8fC2b4fCe8A2dcB71Da884bba042d48E067',
      BptBALWETH: '0x2e4e78936b100be6Ef85BCEf7FB25bC770B02B85',
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
    },
  },
  ReserveAssets: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.main]: {},
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
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
  },
  WETH: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.buidlerevm]: '', // deployed in local evm
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    [eEthereumNetwork.tenderly]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  WrappedNativeToken: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.buidlerevm]: '', // deployed in local evm
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    [eEthereumNetwork.tenderly]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  ReserveFactorTreasuryAddress: {
    [eEthereumNetwork.coverage]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.hardhat]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.buidlerevm]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.main]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.tenderly]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
  },
  IncentivesController: {
    [eEthereumNetwork.coverage]: ZERO_ADDRESS,
    [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
    [eEthereumNetwork.buidlerevm]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: ZERO_ADDRESS,
    [eEthereumNetwork.tenderly]: ZERO_ADDRESS,
  },
};
