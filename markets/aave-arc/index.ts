import { ZERO_ADDRESS } from '../../helpers/constants';
import { IAaveArcConfiguration, eEthereumNetwork, eContractid } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyAAVE,
  strategyUSDC,
  strategyWBTC,
  strategyWETH,
  strategyLINK,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const AaveArcConfig: IAaveArcConfiguration = {
  ...CommonsConfig,
  MarketId: 'Aave Arc market',
  ProviderId: 1,
  LendingPoolImpl: eContractid.PermissionedLendingPool,
  ReservesConfig: {
    WBTC: strategyWBTC,
    WETH: strategyWETH,
    LINK: strategyLINK,
  },
  ReserveAssets: {
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.goerli]: {
      // ADD ERC-20 assets from goerli
      // eth, btc, link
      //     WETH: 0xC642A760bE9F04b453b899f7F454b2AFe21C1C61 incorrect here
      // WBTC: 0x7e752bC77eBE2225B327e6ebF09fAD7801873931
      // LINK: 0xD0fbc05a6B234b2a6a9D65389C2ffd93Fef0527e
      WBTC: '0x7e752bC77eBE2225B327e6ebF09fAD7801873931',
      WETH: '0xd3c3C1F39f4aD6b24EFd48B91b5d130eBc260c9d', // https://github.com/aave/protocol-v2/blob/3542b882022cf5d3884e29b5274bc9efb692b60b/contracts/mocks/tokens/WETH9Mocked.sol
      LINK: '0xD0fbc05a6B234b2a6a9D65389C2ffd93Fef0527e',
    },
    [eEthereumNetwork.kovan]: {
      USDC: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
      WBTC: '0xD1B98B6607330172f1D991521145A22BCe793277',
      WETH: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
      AAVE: '0xB597cd8D3217ea6477232F9217fa70837ff667Af',
    },
    [eEthereumNetwork.ropsten]: {
      USDC: '0x851dEf71f0e6A903375C1e536Bd9ff1684BAD802',
      WBTC: '0xa0E54Ab6AA5f0bf1D62EC3526436F3c05b3348A0',
      WETH: '0xc778417e063141139fce010982780140aa0cd5ab',
      AAVE: 'ZERO_ADDRESS',
    },
    [eEthereumNetwork.main]: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    },
    [eEthereumNetwork.tenderly]: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    },
  },
};

export default AaveArcConfig;
