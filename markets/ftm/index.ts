import { eFantomNetwork, IFantomConfiguration } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyDAI,
  strategyUSDC,
  strategyUSDT,
  strategyYVWFTM,
  strategyMOOWETH,
  strategyYVWETH,
  strategyYVWBTC,
  strategyYVBOO,
  strategyMOOTOMB_FTM,
  strategyMOOTOMB_MIMATIC,
  strategyYVFBEETS,
  strategyYVLINK,
  strategyYVCRV,
  strategyYVSPELL,
  strategyMOOBASED_MIMATIC,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

// noinspection SpellCheckingInspection
export const FantomConfig: IFantomConfiguration = {
  ...CommonsConfig,
  MarketId: 'Fantom market',
  ProviderId: 2,
  ReservesConfig: {
    DAI: strategyDAI,
    USDC: strategyUSDC,
    fUSDT: strategyUSDT,
    yvWFTM: strategyYVWFTM,
    mooWETH: strategyMOOWETH,
    yvWETH: strategyYVWETH,
    yvWBTC: strategyYVWBTC,
    yvBOO: strategyYVBOO,
    mooTOMB_FTM: strategyMOOTOMB_FTM,
    mooTOMB_MIMATIC: strategyMOOTOMB_MIMATIC,
    mooBASED_MIMATIC: strategyMOOBASED_MIMATIC,
    yvfBEETS: strategyYVFBEETS,
    yvLINK: strategyYVLINK,
    yvCRV: strategyYVCRV,
    yvSPELL: strategyYVSPELL,
  },
  ReserveAssets: {
    [eFantomNetwork.ftm]: {
      DAI: '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E',
      USDC: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
      fUSDT: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
      yvWFTM: '0x0DEC85e74A92c52b7F708c4B10207D9560CEFaf0',
      mooWETH: '0x0a03D2C1cFcA48075992d810cc69Bd9FE026384a',
      yvWETH: '0xCe2Fc0bDc18BD6a4d9A725791A3DEe33F3a23BB7',
      yvWBTC: '0xd817A100AB8A29fE3DBd925c2EB489D67F758DA9',
      yvBOO: '0x0fBbf9848D969776a5Eb842EdAfAf29ef4467698',
      mooTOMB_FTM: '0x27c77411074ba90cA35e6f92A79dAd577c05A746',
      mooTOMB_MIMATIC: '0xb2be5Cd33DBFf412Bce9587E44b5647a4BdA6a66',
      yvfBEETS: '0x1e2fe8074a5ce1Bb7394856B0C618E75D823B93b',
      yvLINK: '0xf2d323621785A066E64282d2B407eAc79cC04966',
      yvCRV: '0x0446acaB3e0242fCf33Aa526f1c95a88068d5042',
      yvSPELL: '0xD3c19eB022CAC706c898D60d756bf1535d605e1d',
      mooBASED_MIMATIC: '0x5Ddb9a342672ecEe80a028CE40500F16ba1Bca44',
    },
    [eFantomNetwork.ftm_test]: {
      DAI: '0x9440c3bB6Adb5F0D5b8A460d8a8c010690daC2E8',
      USDC: '0x8f785910e0cc96f854450DFb53be6492daff0b15',
      fUSDT: '0x211554151F2f00305f33530Fdd3a5d0354927A65',
      yvWFTM: '0x5a18d89Ad063C1AEd5B3c30741333c1a1116CFE3',
      mooWETH: '0xDD7eEE411FF990561A679646e9d1E08861D6486d',
      yvWETH: '0x5F37179e6714D137C6A196eAd40d79005c5e9A61',
      yvWBTC: '0xf0074B10f63c7002A2254e8E310c60D72b13Ed91',
      yvBOO: '0x62aaa32a0AD45BE19ca418aC9e0CE9dB01d6A272',
      mooTOMB_FTM: '0x6Ea737e951c0079A0F4a38DFebe8B9Db7f29d17d',
      mooTOMB_MIMATIC: '0x53F26e11497A3632CC58F88957C1761925f753B0',
      yvfBEETS: '0xb61fc41e813a0f783aBFaF9B93ba5DC22Ad30B0D',
      yvLINK: '0x9170EaE627687feb87Adfa71B43318A6565c440f',
      yvCRV: '0x113D668aEB0205aa4EC9e3bAC47c9b4d6b66E674',
      yvSPELL: '0x7fc436Eec9b6688A5ba46812C76051e87EB00998',
      mooBASED_MIMATIC: '0x316C7c7e783A1d91806A069cF91aA048FD4a86dC',
    },
    [eFantomNetwork.tenderlyFTM]: {
      DAI: '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E',
      USDC: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
      yvWFTM: '0x0DEC85e74A92c52b7F708c4B10207D9560CEFaf0',
      mooWETH: '0x0a03D2C1cFcA48075992d810cc69Bd9FE026384a',
      fUSDT: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
      yvWETH: '0xCe2Fc0bDc18BD6a4d9A725791A3DEe33F3a23BB7',
      yvWBTC: '0xd817A100AB8A29fE3DBd925c2EB489D67F758DA9',
      yvBOO: '0x0fBbf9848D969776a5Eb842EdAfAf29ef4467698',
      mooTOMB_FTM: '0x27c77411074ba90cA35e6f92A79dAd577c05A746',
      mooTOMB_MIMATIC: '0xb2be5Cd33DBFf412Bce9587E44b5647a4BdA6a66',
      yvfBEETS: '0x1e2fe8074a5ce1Bb7394856B0C618E75D823B93b',
      yvLINK: '0xf2d323621785A066E64282d2B407eAc79cC04966',
      yvCRV: '0x0446acaB3e0242fCf33Aa526f1c95a88068d5042',
      yvSPELL: '0xD3c19eB022CAC706c898D60d756bf1535d605e1d',
      mooBASED_MIMATIC: '0x5Ddb9a342672ecEe80a028CE40500F16ba1Bca44',
    },
  },
  BOO: {
    [eFantomNetwork.ftm]: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE',
    [eFantomNetwork.ftm_test]: '0x9dAFB108f0fFd18C1f844C4782F8c7F934f8566E',
    [eFantomNetwork.tenderlyFTM]: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE',
  },
  TOMB: {
    [eFantomNetwork.ftm]: '0x6c021Ae822BEa943b2E66552bDe1D2696a53fbB7',
    [eFantomNetwork.ftm_test]: '0x81b1E83538Adaa4164156ED43b8081aA97eD197D',
    [eFantomNetwork.tenderlyFTM]: '0x6c021Ae822BEa943b2E66552bDe1D2696a53fbB7',
  },
  MIMATIC: {
    [eFantomNetwork.ftm]: '0xfB98B335551a418cD0737375a2ea0ded62Ea213b',
    [eFantomNetwork.ftm_test]: '0x3420eFfdc6ADd729325B38122904Cfe7F3dD6762',
    [eFantomNetwork.tenderlyFTM]: '0xfB98B335551a418cD0737375a2ea0ded62Ea213b',
  },
  BASED: {
    [eFantomNetwork.ftm]: '0x8D7d3409881b51466B483B11Ea1B8A03cdEd89ae',
    [eFantomNetwork.ftm_test]: '0xD5868d9D96eFD744f4b0579C74Abdb26697E9AB2',
    [eFantomNetwork.tenderlyFTM]: '0x8D7d3409881b51466B483B11Ea1B8A03cdEd89ae',
  },
  TOMB_FTM_LP: {
    [eFantomNetwork.ftm]: '0x2A651563C9d3Af67aE0388a5c8F89b867038089e',
    [eFantomNetwork.ftm_test]: '0x0906E97beB6f422C239627FeFB9198144904327d',
    [eFantomNetwork.tenderlyFTM]: '0x2A651563C9d3Af67aE0388a5c8F89b867038089e',
  },
  TOMB_MIMATIC_LP: {
    [eFantomNetwork.ftm]: '0x45f4682B560d4e3B8FF1F1b3A38FDBe775C7177b',
    [eFantomNetwork.ftm_test]: '0x16c8deB0B2a1dfC8Fc44b4b2694ccAfa76dfE6B6',
    [eFantomNetwork.tenderlyFTM]: '0x45f4682B560d4e3B8FF1F1b3A38FDBe775C7177b',
  },
  BASED_MIMATIC_LP: {
    [eFantomNetwork.ftm]: '0x7B5B3751550be4FF87aC6bda89533F7A0c9825B3',
    [eFantomNetwork.ftm_test]: '0x323b65bC4F76b36AB57EAF4cFBD9561cfaAe5d29',
    [eFantomNetwork.tenderlyFTM]: '0x7B5B3751550be4FF87aC6bda89533F7A0c9825B3',
  },
  fBEETS: {
    [eFantomNetwork.ftm]: '0xfcef8a994209d6916EB2C86cDD2AFD60Aa6F54b1',
    [eFantomNetwork.ftm_test]: '0xBC412e39D2291DF1B7E5F05Fcdf9da9d5Af08411',
    [eFantomNetwork.tenderlyFTM]: '0xfcef8a994209d6916EB2C86cDD2AFD60Aa6F54b1',
  },  
  BEETS: {
    [eFantomNetwork.ftm]: '0xF24Bcf4d1e507740041C9cFd2DddB29585aDCe1e',
    [eFantomNetwork.ftm_test]: '0xEDCB19A71952Ea544dba5F5d0e82D80CC2f79816',
    [eFantomNetwork.tenderlyFTM]: '0xF24Bcf4d1e507740041C9cFd2DddB29585aDCe1e',
  },  
  LINK: {
    [eFantomNetwork.ftm]: '0xb3654dc3D10Ea7645f8319668E8F54d2574FBdC8',
    [eFantomNetwork.ftm_test]: '0x62d652e4F5E805A1Fb5B6e90B168Ff03a3A6efFF',
    [eFantomNetwork.tenderlyFTM]: '0xb3654dc3D10Ea7645f8319668E8F54d2574FBdC8',
  },
  CRV: {
    [eFantomNetwork.ftm]: '0x1E4F97b9f9F913c46F1632781732927B9019C68b',
    [eFantomNetwork.ftm_test]: '0x9e5C734c28B8Df6F45d4b757F3dDFbc241042259',
    [eFantomNetwork.tenderlyFTM]: '0x1E4F97b9f9F913c46F1632781732927B9019C68b',
  },
  SPELL: {
    [eFantomNetwork.ftm]: '0x468003B688943977e6130F4F68F23aad939a1040',
    [eFantomNetwork.ftm_test]: '0x180D7c72DAb76D11Dd8E0ffD4892ABc34D4d1f48',
    [eFantomNetwork.tenderlyFTM]: '0x468003B688943977e6130F4F68F23aad939a1040',
  },
  YearnVaultFTM: {
    [eFantomNetwork.ftm]: '0x0DEC85e74A92c52b7F708c4B10207D9560CEFaf0',
    [eFantomNetwork.ftm_test]: '0x5a18d89Ad063C1AEd5B3c30741333c1a1116CFE3',
    [eFantomNetwork.tenderlyFTM]: '0x0DEC85e74A92c52b7F708c4B10207D9560CEFaf0',
  },
  YearnWETHVaultFTM: {
    [eFantomNetwork.ftm]: '0xCe2Fc0bDc18BD6a4d9A725791A3DEe33F3a23BB7',
    [eFantomNetwork.ftm_test]: '0x5F37179e6714D137C6A196eAd40d79005c5e9A61',
    [eFantomNetwork.tenderlyFTM]: '0xCe2Fc0bDc18BD6a4d9A725791A3DEe33F3a23BB7',
  },
  YearnWBTCVaultFTM: {
    [eFantomNetwork.ftm]: '0xd817A100AB8A29fE3DBd925c2EB489D67F758DA9',
    [eFantomNetwork.ftm_test]: '0xf0074B10f63c7002A2254e8E310c60D72b13Ed91',
    [eFantomNetwork.tenderlyFTM]: '0xd817A100AB8A29fE3DBd925c2EB489D67F758DA9',
  },
  YearnBOOVaultFTM: {
    [eFantomNetwork.ftm]: '0x0fBbf9848D969776a5Eb842EdAfAf29ef4467698',
    [eFantomNetwork.ftm_test]: '0x62aaa32a0AD45BE19ca418aC9e0CE9dB01d6A272',
    [eFantomNetwork.tenderlyFTM]: '0x0fBbf9848D969776a5Eb842EdAfAf29ef4467698',
  },
  BeefyVaultTOMB_FTM: {
    [eFantomNetwork.ftm]: '0x27c77411074ba90cA35e6f92A79dAd577c05A746',
    [eFantomNetwork.ftm_test]: '0x6Ea737e951c0079A0F4a38DFebe8B9Db7f29d17d',
    [eFantomNetwork.tenderlyFTM]: '0x27c77411074ba90cA35e6f92A79dAd577c05A746',
  },
  BeefyVaultTOMB_MIMATIC: {
    [eFantomNetwork.ftm]: '0xb2be5Cd33DBFf412Bce9587E44b5647a4BdA6a66',
    [eFantomNetwork.ftm_test]: '0x53F26e11497A3632CC58F88957C1761925f753B0',
    [eFantomNetwork.tenderlyFTM]: '0xb2be5Cd33DBFf412Bce9587E44b5647a4BdA6a66',
  },
  BeefyVaultBASED_MIMATIC: {
    [eFantomNetwork.ftm]: '0x5Ddb9a342672ecEe80a028CE40500F16ba1Bca44',
    [eFantomNetwork.ftm_test]: '0x316C7c7e783A1d91806A069cF91aA048FD4a86dC',
    [eFantomNetwork.tenderlyFTM]: '0x5Ddb9a342672ecEe80a028CE40500F16ba1Bca44',
  },
  YearnFBEETSVaultFTM: {
    [eFantomNetwork.ftm]: '0x1e2fe8074a5ce1Bb7394856B0C618E75D823B93b',
    [eFantomNetwork.ftm_test]: '0xb61fc41e813a0f783aBFaF9B93ba5DC22Ad30B0D',
    [eFantomNetwork.tenderlyFTM]: '0x1e2fe8074a5ce1Bb7394856B0C618E75D823B93b',
  },  
  YearnLINKVaultFTM: {
    [eFantomNetwork.ftm]: '0xf2d323621785A066E64282d2B407eAc79cC04966',
    [eFantomNetwork.ftm_test]: '0x9170EaE627687feb87Adfa71B43318A6565c440f',
    [eFantomNetwork.tenderlyFTM]: '0xf2d323621785A066E64282d2B407eAc79cC04966',
  },
  BeefyETHVault: {
    [eFantomNetwork.ftm]: '0x0a03D2C1cFcA48075992d810cc69Bd9FE026384a',
    [eFantomNetwork.ftm_test]: '0xDD7eEE411FF990561A679646e9d1E08861D6486d',
    [eFantomNetwork.tenderlyFTM]: '0x0a03D2C1cFcA48075992d810cc69Bd9FE026384a',
  },
  YearnCRVVaultFTM: {
    [eFantomNetwork.ftm]: '0x0446acaB3e0242fCf33Aa526f1c95a88068d5042',
    [eFantomNetwork.ftm_test]: '0x113D668aEB0205aa4EC9e3bAC47c9b4d6b66E674',
    [eFantomNetwork.tenderlyFTM]: '0x0446acaB3e0242fCf33Aa526f1c95a88068d5042',
  },
  YearnSPELLVaultFTM: {
    [eFantomNetwork.ftm]: '0xD3c19eB022CAC706c898D60d756bf1535d605e1d',
    [eFantomNetwork.ftm_test]: '0x7fc436Eec9b6688A5ba46812C76051e87EB00998',
    [eFantomNetwork.tenderlyFTM]: '0xD3c19eB022CAC706c898D60d756bf1535d605e1d',
  },
  UniswapRouter: {
    [eFantomNetwork.ftm]: '0xF491e7B69E4244ad4002BC14e878a34207E38c29',
    [eFantomNetwork.ftm_test]: '0xcCAFCf876caB8f9542d6972f87B5D62e1182767d',
    [eFantomNetwork.tenderlyFTM]: '0xF491e7B69E4244ad4002BC14e878a34207E38c29',
  },
  TombSwapRouter: {
    [eFantomNetwork.ftm]: '0x6D0176C5ea1e44b08D3dd001b0784cE42F47a3A7',
    [eFantomNetwork.ftm_test]: '',
    [eFantomNetwork.tenderlyFTM]: '0x6D0176C5ea1e44b08D3dd001b0784cE42F47a3A7',
  },
  AavePool: {
    [eFantomNetwork.ftm]: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    [eFantomNetwork.ftm_test]: '',
    [eFantomNetwork.tenderlyFTM]: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  },
};

export default FantomConfig;
