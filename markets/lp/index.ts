import { oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { ILpConfiguration, EthereumNetwork, eEthereumNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyDAI,
  strategyUSDC,
  strategyUSDT,
  strategyWETH,
  strategyWBTC,
  strategyWBTCWETH,
  strategyDAIWETH,
  strategyAAVEWETH,
  strategyBATWETH,
  strategyUSDCDAI,
  strategyCRVWETH,
  strategyLINKWETH,
  strategyMKRWETH,
  strategyRENWETH,
  strategySNXWETH,
  strategyUNIWETH,
  strategyUSDCWETH,
  strategyWBTCUSDC,
  strategyYFIWETH,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const lpConfig: ILpConfiguration = {
  ...CommonsConfig,
  MarketId: 'Aave LP market',
  ProviderId: 2,
  ReservesConfig: {
    LpWETH: strategyWETH,
    LpDAI: strategyDAI,
    LpUSDC: strategyUSDC,
    LpUSDT: strategyUSDT,
    LpWBTC: strategyWBTC,
    LpDAIWETH: strategyDAIWETH,
    LpWBTCWETH: strategyWBTCWETH,
    LpAAVEWETH: strategyAAVEWETH,
    LpBATWETH: strategyBATWETH,
    LpUSDCDAI: strategyUSDCDAI,
    LpCRVWETH: strategyCRVWETH,
    LpLINKWETH: strategyLINKWETH,
    LpMKRWETH: strategyMKRWETH,
    LpRENWETH: strategyRENWETH,
    LpSNXWETH: strategySNXWETH,
    LpUNIWETH: strategyUNIWETH,
    LpUSDCWETH: strategyUSDCWETH,
    LpWBTCUSDC: strategyWBTCUSDC,
    LpYFIWETH: strategyYFIWETH,
  },
  ReserveAssets: {
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [EthereumNetwork.kovan]: {
      LpDAI: '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD',
      LpUSDC: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
      LpUSDT: '0x13512979ADE267AB5100878E2e0f485B568328a4',
      LpWBTC: '0xD1B98B6607330172f1D991521145A22BCe793277',
      LpWETH: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
      LpDAIWETH: '0x7d3A67ab574abD3F9849e5fcDa48c19939d032b4',
      uniWBTCWETH: '0x342e78bf229Cd2a750E80D7D7c2C185455979b91',
      // Other assets
    },
    [EthereumNetwork.ropsten]: {
    },
    [EthereumNetwork.main]: {
      LpDAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      LpUSDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      LpUSDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      LpWBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      LpWETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      LpDAIWETH: '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11',
      LpWBTCWETH: '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940',
      LpAAVEWETH: '0xDFC14d2Af169B0D36C4EFF567Ada9b2E0CAE044f',
      LpBATWETH: '0xB6909B960DbbE7392D405429eB2b3649752b4838',
      LpUSDCDAI: '0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5',
      LpCRVWETH: '0x3dA1313aE46132A397D90d95B1424A9A7e3e0fCE',
      LpLINKWETH: '0xa2107FA5B38d9bbd2C461D6EDf11B11A50F6b974',
      LpMKRWETH: '0xC2aDdA861F89bBB333c90c492cB837741916A225',
      LpRENWETH: '0x8Bd1661Da98EBDd3BD080F0bE4e6d9bE8cE9858c',
      LpSNXWETH: '0x43AE24960e5534731Fc831386c07755A2dc33D47',
      LpUNIWETH: '0xd3d2E2692501A5c9Ca623199D38826e513033a17',
      LpUSDCWETH: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
      LpWBTCUSDC: '0x004375Dff511095CC5A197A54140a24eFEF3A416',
      LpYFIWETH: '0x2fDbAdf3C4D5A8666Bc06645B8358ab803996E28',
    },
    [EthereumNetwork.tenderlyMain]: {
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
  },
};

export default lpConfig;
