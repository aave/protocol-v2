import { ZERO_ADDRESS } from '../../helpers/constants';
import { IAaveArcConfiguration, eEthereumNetwork, eContractid } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyAAVE,
  strategyUSDC,
  strategyWBTC,
  strategyWETH,
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
   USDC: strategyUSDC,
    WBTC: strategyWBTC,
    WETH: strategyWETH,
    AAVE: strategyAAVE
  },
  ReserveAssets: {
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
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
  }
};

export default AaveArcConfig;
