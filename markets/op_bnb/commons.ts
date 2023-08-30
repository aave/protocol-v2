import {
  oneRay,
  ZERO_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  oneEther,
} from '../../helpers/constants';
import { ICommonConfiguration, eOpBNBNetwork ,eEthereumNetwork} from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ATokenNamePrefix: 'Aave interest bearing',
  StableDebtTokenNamePrefix: 'Aave stable debt bearing',
  VariableDebtTokenNamePrefix: 'Aave variable debt bearing',
  SymbolPrefix: 'b',
  ProviderId: 0, // Overriden in index.ts
  OracleQuoteCurrency: 'BNB',
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
    WBNB: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },

    ZO_ZO: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },

    BKS : {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },

    BUSD: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eOpBNBNetwork.op_bnb]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdmin: {
    [eOpBNBNetwork.op_bnb]: undefined,
  },
  EmergencyAdminIndex: 1,
  ProviderRegistry: {
    // [eEthereumNetwork.main]: '0x52D306e36E3B6B02c153d0266ff0f85d18BCD413',
    [eOpBNBNetwork.op_bnb]: ''
  },
  ProviderRegistryOwner: {
    //[eEthereumNetwork.main]: '0xB9062896ec3A615a4e4444DF183F0531a77218AE',
   [eOpBNBNetwork.op_bnb]: ''
  },
  LendingRateOracle: {
    //[eEthereumNetwork.main]: '', //'0x8A32f49FFbA88aba6EFF96F45D8BD1D4b3f35c7D',
    [eOpBNBNetwork.op_bnb]: ''
  },
  LendingPoolCollateralManager: {
    //[eEthereumNetwork.main]: '0xbd4765210d4167CE2A5b87280D9E8Ee316D5EC7C',
    [eOpBNBNetwork.op_bnb]: ''
  },
  LendingPoolConfigurator: {
    [eOpBNBNetwork.op_bnb]: ''
  },
  LendingPool: {
    [eOpBNBNetwork.op_bnb]: ''
  },
  WethGateway: {
    [eOpBNBNetwork.op_bnb]: ''
  },
  TokenDistributor: {
    //[eEthereumNetwork.main]: '0xe3d9988f676457123c5fd01297605efdd0cba1ae',
    [eOpBNBNetwork.op_bnb]: ''
  },
  AaveOracle: {
    [eOpBNBNetwork.op_bnb]: ''
    //[eEthereumNetwork.main]: '', //'0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',
  },
  FallbackOracle: {
    [eOpBNBNetwork.op_bnb]: '',
    //[eEthereumNetwork.main]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    /*[eEthereumNetwork.main]: {
      AAVE: '0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012',
      BAT: '0x0d16d4528239e9ee52fa531af613AcdB23D88c94',
      BUSD: '0x614715d2Af89E6EC99A233818275142cE88d1Cfd',
      DAI: '0x773616E4d11A78F511299002da57A0a94577F1f4',
      ENJ: '0x24D9aB51950F3d62E9144fdC2f3135DAA6Ce8D1B',
      KNC: '0x656c0544eF4C98A6a98491833A89204Abb045d6b',
      LINK: '0xDC530D9457755926550b59e8ECcdaE7624181557',
      MANA: '0x82A44D92D6c329826dc557c5E1Be6ebeC5D5FeB9',
      MKR: '0x24551a8Fb2A7211A25a17B1481f043A8a8adC7f2',
      REN: '0x3147D7203354Dc06D9fd350c7a2437bcA92387a4',
      SNX: '0x79291A9d692Df95334B1a0B3B4AE6bC606782f8c',
      SUSD: '0x8e0b7e6062272B5eF4524250bFFF8e5Bd3497757',
      TUSD: '0x3886BA987236181D98F2401c507Fb8BeA7871dF2',
      UNI: '0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      USDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      WBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      YFI: '0x7c5d4F8345e66f68099581Db340cd65B078C41f4',
      ZRX: '0x2Da4983a622a8498bb1a21FaE9D8F6C664939962',
      USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
      xSUSHI: '0x9b26214bEC078E68a394AaEbfbffF406Ce14893F',
    },*/
    [eOpBNBNetwork.op_bnb]: {}
  },
  ReserveAssets: {
    [eOpBNBNetwork.op_bnb]: {}
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eOpBNBNetwork.op_bnb]: '',
    //[eEthereumNetwork.main]: '',
  },
  WETH: {
    [eOpBNBNetwork.op_bnb]: '',
    //[eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  WrappedNativeToken: {
    [eOpBNBNetwork.op_bnb]: ''
    //[eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  ReserveFactorTreasuryAddress: {
    [eOpBNBNetwork.op_bnb]: ''
    //[eEthereumNetwork.main]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
  },
  IncentivesController: {
    [eOpBNBNetwork.op_bnb]: '',
    //[eEthereumNetwork.main]: ZERO_ADDRESS,
  },
};
