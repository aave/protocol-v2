import BigNumber from 'bignumber.js';
import {oneEther, oneRay, RAY} from '../helpers/constants';
import {ICommonConfiguration, EthereumNetwork, eEthereumNetwork} from '../helpers/types';

const MOCK_CHAINLINK_AGGREGATORS_PRICES = {
  DAI: oneEther.multipliedBy('0.00369068412860').toFixed(),
  TUSD: oneEther.multipliedBy('0.00364714136416').toFixed(),
  USDC: oneEther.multipliedBy('0.00367714136416').toFixed(),
  LEND: oneEther.multipliedBy('0.00003620948469').toFixed(),
  BAT: oneEther.multipliedBy('0.00137893825230').toFixed(),
  USDT: oneEther.multipliedBy('0.00369068412860').toFixed(),
  SUSD: oneEther.multipliedBy('0.00364714136416').toFixed(),
  MKR: oneEther.multipliedBy('2.508581').toFixed(),
  REP: oneEther.multipliedBy('0.048235').toFixed(),
  ZRX: oneEther.multipliedBy('0.001151').toFixed(),
  WBTC: oneEther.multipliedBy('47.332685').toFixed(),
  LINK: oneEther.multipliedBy('0.009955').toFixed(),
  KNC: oneEther.multipliedBy('0.001072').toFixed(),
  MANA: oneEther.multipliedBy('0.000158').toFixed(),
  SNX: oneEther.multipliedBy('0.00442616').toFixed(),
  BUSD: oneEther.multipliedBy('0.00736484').toFixed(),
  WETH: oneEther.toFixed(),
  USD: '5848466240000000',
  UNI_DAI_ETH: oneEther.multipliedBy('2.1').toFixed(),
  UNI_USDC_ETH: oneEther.multipliedBy('2.1').toFixed(),
  UNI_SETH_ETH: oneEther.multipliedBy('2.1').toFixed(),
  UNI_LEND_ETH: oneEther.multipliedBy('2.1').toFixed(),
  UNI_LINK_ETH: oneEther.multipliedBy('2.1').toFixed(),
  UNI_MKR_ETH: oneEther.multipliedBy('2.1').toFixed(),
};
// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  ConfigName: 'Commons',
  ProviderId: 0,
  ReserveSymbols: [],
  ProtocolGlobalParams: {
    OptimalUtilizationRate: new BigNumber(0.8).times(RAY),
    ExcessUtilizationRate: new BigNumber(0.2).times(RAY),
    ApprovalAmountLendingPoolCore: '1000000000000000000000000000',
    TokenDistributorPercentageBase: '10000',
    MockUsdPriceInWei: '5848466240000000',
    EthereumAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    UsdAddress: '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96',
    NilAddress: '0x0000000000000000000000000000000000000000',
    OneAddress: '0x0000000000000000000000000000000000000001',
    AaveReferral: '0',
  },

  // ----------------
  // COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
  // ----------------

  Mocks: {
    ChainlinkAggregatorPrices: {
      ...MOCK_CHAINLINK_AGGREGATORS_PRICES,
    },
    AllAssetsInitialPrices: {
      ...MOCK_CHAINLINK_AGGREGATORS_PRICES,
    },
  },
  LendingRateOracleRatesCommon: {
    WETH: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    DAI: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    TUSD: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    USDC: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    SUSD: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    USDT: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    BAT: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    LEND: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    LINK: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    KNC: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    REP: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    MKR: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    MANA: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    WBTC: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    ZRX: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    SNX: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    BUSD: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If lendingPoolManagerAddress is set, will take priority over lendingPoolManagerAddressIndex
  LendingPoolManagerAddress: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.buidlerevm]: undefined,
    [eEthereumNetwork.kovan]: undefined,
    [eEthereumNetwork.ropsten]: undefined,
    [eEthereumNetwork.main]: undefined,
  },
  LendingPoolManagerAddressIndex: 0,
  ProviderRegistry: {
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.buidlerevm]: '',
  },
  LendingRateOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '0xdcde9bb6a49e37fa433990832ab541ae2d4feb4a',
    [eEthereumNetwork.ropsten]: '0x05dcca805a6562c1bdd0423768754acb6993241b',
    [eEthereumNetwork.main]: '0x4d728a4496e4de35f218d5a214366bde3a62b51c',
  },
  TokenDistributor: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [EthereumNetwork.kovan]: '0x971efe90088f21dc6a36f610ffed77fc19710708',
    [EthereumNetwork.ropsten]: '0xeba2ea67942b8250d870b12750b594696d02fc9c',
    [EthereumNetwork.main]: '0xe3d9988f676457123c5fd01297605efdd0cba1ae',
  },
  ChainlinkProxyPriceProvider: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [EthereumNetwork.kovan]: '0x276C4793F2EE3D5Bf18C5b879529dD4270BA4814',
    [EthereumNetwork.ropsten]: '0x657372A559c30d236F011239fF9fbB6D76718271',
    [EthereumNetwork.main]: '0x76B47460d7F7c5222cFb6b6A75615ab10895DDe4',
  },
  FallbackOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [EthereumNetwork.kovan]: '0x50913E8E1c650E790F8a1E741FF9B1B1bB251dfe',
    [EthereumNetwork.ropsten]: '0xAD1a978cdbb8175b2eaeC47B01404f8AEC5f4F0d',
    [EthereumNetwork.main]: '0xf67a8b0e3e0ee303422f78b4c5b8da60df80a59c',
  },
  ChainlinkAggregator: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [EthereumNetwork.kovan]: {
      DAI: '0x6F47077D3B6645Cb6fb7A29D280277EC1e5fFD90',
      TUSD: '0x02424c54D78D48179Fd12ebFfB11c16f9CA984Ad',
      USDC: '0x672c1C0d1130912D83664011E7960a42E8cA05D5',
      USDT: '0xCC833A6522721B3252e7578c5BCAF65738B75Fc3',
      SUSD: '0xa353F8b083F7575cfec443b5ad585D42f652E9F7',
      LEND: '0xdce38940264dfbc01ad1486c21764948e511947e',
      BAT: '0x2c8d01771CCDca47c103194C5860dbEA2fE61626',
      REP: '0x09F4A94F44c29d4967C761bBdB89f5bD3E2c09E6',
      MKR: '0x14D7714eC44F44ECD0098B39e642b246fB2c38D0',
      LINK: '0xf1e71Afd1459C05A2F898502C4025be755aa844A',
      KNC: '0x0893AaF58f62279909F9F6FF2E5642f53342e77F',
      WBTC: '0x33E5085E92f5b53E9A193E28ad2f76bF210550BB',
      MANA: '0x3c30c5c415B2410326297F0f65f5Cbb32f3aefCc',
      ZRX: '0x2636cfdDB457a6C7A7D60A439F1E5a5a0C3d9c65',
      SNX: '0x775E76cca1B5bc903c9a8C6f77416A35E5744664',
      BUSD: '0x63294A05C9a81b1A40CAD3f2ff30617111630393',
      USD: '0xD21912D8762078598283B14cbA40Cb4bFCb87581',
      UNI_DAI_ETH: '0x0338C40020Bf886c11406115fD1ba205Ef1D9Ff9',
      UNI_USDC_ETH: '0x7f5E5D34591e9a70D187BBA94260C30B92aC0961',
      UNI_SETH_ETH: '0xc5F1eA001c1570783b3af418fa775237Eb129EDC',
      UNI_LEND_ETH: '0xB996b1a11BA0aACc4deA57f7f92d1722428f2E90',
      UNI_LINK_ETH: '0x267490eE9Ad21dfE839aE73A8B1c8C9A36F60d33',
      UNI_MKR_ETH: '0x6eBF25AB0A18B8F6243619f1AE6b94373169A069',
    },
    [EthereumNetwork.ropsten]: {
      DAI: '0x64b8e49baded7bfb2fd5a9235b2440c0ee02971b',
      TUSD: '0x523ac85618df56e940534443125ef16daf785620',
      USDC: '0xe1480303dde539e2c241bdc527649f37c9cbef7d',
      USDT: '0xc08fe0c4d97ccda6b40649c6da621761b628c288',
      SUSD: '0xe054b4aee7ac7645642dd52f1c892ff0128c98f0',
      LEND: '0xf7b4834fe443d1E04D757b4b089b35F5A90F2847',
      BAT: '0xafd8186c962daf599f171b8600f3e19af7b52c92',
      REP: '0xa949ee9ba80c0f381481f2eab538bc5547a5ac67',
      MKR: '0x811B1f727F8F4aE899774B568d2e72916D91F392',
      LINK: '0xb8c99b98913bE2ca4899CdcaF33a3e519C20EeEc',
      KNC: '0x19d97ceb36624a31d827032d8216dd2eb15e9845',
      WBTC: '0x5b8B87A0abA4be247e660B0e0143bB30Cdf566AF',
      MANA: '0xDab909dedB72573c626481fC98CEE1152b81DEC2',
      ZRX: '0x1d0052e4ae5b4ae4563cbac50edc3627ca0460d7',
      SNX: '0xA95674a8Ed9aa9D2E445eb0024a9aa05ab44f6bf',
      BUSD: '0x0A32D96Ff131cd5c3E0E5AAB645BF009Eda61564',
      USD: '0x8468b2bDCE073A157E560AA4D9CcF6dB1DB98507',
      UNI_DAI_ETH: '0x16048819e3f77b7112eB033624A0bA9d33743028',
      UNI_USDC_ETH: '0x6952A2678D574073DB97963886c2F38CD09C8Ba3',
      UNI_SETH_ETH: '0x23Ee5188806BD2D31103368B0EA0259bc6706Af1',
      UNI_LEND_ETH: '0x43c44B27376Afedee06Bae2A003e979FC3B3Da6C',
      UNI_LINK_ETH: '0xb60c29714146EA3539261f599Eb30f62904108Fa',
      UNI_MKR_ETH: '0x594ae5421f378b8B4AF9e758C461d2A1FF990BC5',
    },
    [EthereumNetwork.main]: {
      DAI: '0x037E8F2125bF532F3e228991e051c8A7253B642c',
      TUSD: '0x73ead35fd6A572EF763B13Be65a9db96f7643577',
      USDC: '0xdE54467873c3BCAA76421061036053e371721708',
      USDT: '0xa874fe207DF445ff19E7482C746C4D3fD0CB9AcE',
      SUSD: '0x6d626Ff97f0E89F6f983dE425dc5B24A18DE26Ea',
      LEND: '0x1EeaF25f2ECbcAf204ECADc8Db7B0db9DA845327',
      BAT: '0x9b4e2579895efa2b4765063310Dc4109a7641129',
      REP: '0xb8b513d9cf440C1b6f5C7142120d611C94fC220c',
      MKR: '0xda3d675d50ff6c555973c4f0424964e1f6a4e7d3',
      LINK: '0xeCfA53A8bdA4F0c4dd39c55CC8deF3757aCFDD07',
      KNC: '0xd0e785973390fF8E77a83961efDb4F271E6B8152',
      WBTC: '0x0133Aa47B6197D0BA090Bf2CD96626Eb71fFd13c',
      MANA: '0xc89c4ed8f52Bb17314022f6c0dCB26210C905C97',
      ZRX: '0xA0F9D94f060836756FFC84Db4C78d097cA8C23E8',
      SNX: '0xE23d1142dE4E83C08bb048bcab54d50907390828',
      BUSD: '0x5d4BB541EED49D0290730b4aB332aA46bd27d888',
      USD: '0x59b826c214aBa7125bFA52970d97736c105Cc375',
      UNI_DAI_ETH: '0x1bAB293850289Bf161C5DA79ff3d1F02A950555b',
      UNI_USDC_ETH: '0x444315Ee92F2bb3579293C17B07194227fA99bF0',
      UNI_SETH_ETH: '0x517D40E49660c7705b2e99eEFA6d7B0E9Ba5BF10',
      UNI_LEND_ETH: '0xF4C8Db2d999b024bBB6c6022566503eD41f2AC1E',
      UNI_LINK_ETH: '0xE2A639Beb647d7F709ca805ABa760bBEfdbE37e3',
      UNI_MKR_ETH: '0xEe40a5E8F3732bE6ECDb5A90e23D0b7bF0D4a73c',
    },
  },
  ReserveAssets: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [EthereumNetwork.main]: {},
    [EthereumNetwork.kovan]: {},
    [EthereumNetwork.ropsten]: {},
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eEthereumNetwork.coverage]:
      '0x95b73a72c6ecf4ccbbba5178800023260bad8e75cdccdb8e4827a2977a37c820',
    [eEthereumNetwork.buidlerevm]:
      '0x76cbbf8aa4b11a7c207dd79ccf8c394f59475301598c9a083f8258b4fafcfa86',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
  },
};
