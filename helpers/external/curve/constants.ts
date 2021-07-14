import { ZERO_ADDRESS } from '../../constants';
import { eEthereumNetwork, tEthereumAddress } from '../../types';

export interface GaugeInfo {
  underlying: tEthereumAddress;
  address: tEthereumAddress;
  name: string;
  symbol: string;
  rewardTokens: tEthereumAddress[];
}

export const GAUGE_3POOL: GaugeInfo = {
  underlying: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
  address: '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A',
  name: 'aToken 3pool',
  symbol: 'a-3poolCRV',
  rewardTokens: [],
};

export const GAUGE_AAVE3: GaugeInfo = {
  underlying: '0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900',
  address: '0xd662908ADA2Ea1916B3318327A97eB18aD588b5d',
  name: 'aToken a3CRV',
  symbol: 'a-a3CRV',
  rewardTokens: [],
};

export const GAUGE_SAAVE: GaugeInfo = {
  underlying: '0x02d341CcB60fAaf662bC0554d13778015d1b285C',
  address: '0x462253b8F74B72304c145DB0e4Eebd326B22ca39',
  name: 'aToken a3CRV',
  symbol: 'a-a3CRV',
  rewardTokens: [],
};

export const GAUGE_EURS: GaugeInfo = {
  underlying: '0x194eBd173F6cDacE046C53eACcE9B953F28411d1',
  address: '0x90Bb609649E0451E5aD952683D64BD2d1f245840',
  name: 'aToken eursCRV Gauge Deposit',
  symbol: 'a-eursCRV',
  rewardTokens: ['0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F'],
};

export const GAUGE_ANKR: GaugeInfo = {
  underlying: '0xaA17A236F2bAdc98DDc0Cf999AbB47D47Fc0A6Cf',
  address: '0x6d10ed2cf043e6fcf51a0e7b4c2af3fa06695707',
  name: 'aToken ankrCRV Gauge Deposit',
  symbol: 'a-ankrCRV',
  rewardTokens: [
    '0xE0aD1806Fd3E7edF6FF52Fdb822432e847411033',
    '0x8290333ceF9e6D528dD5618Fb97a76f268f3EDD4',
  ],
};

export const isCurveGaugeV2 = (address: tEthereumAddress) =>
  GAUGE_3POOL.address.toLowerCase() !== address.toLowerCase();

export const poolToGauge = {
  [GAUGE_EURS.underlying]: GAUGE_EURS.address,
  [GAUGE_AAVE3.underlying]: GAUGE_AAVE3.address,
  [GAUGE_3POOL.underlying]: GAUGE_3POOL.address,
  [GAUGE_SAAVE.underlying]: GAUGE_SAAVE.address,
  [GAUGE_ANKR.underlying]: GAUGE_ANKR.address,
};

export const CRV_TOKEN = {
  [eEthereumNetwork.main]: '0xD533a949740bb3306d119CC777fa900bA034cd52',
  [eEthereumNetwork.tenderly]: '0xD533a949740bb3306d119CC777fa900bA034cd52',
};

export const CURVE_TREASURY = {
  [eEthereumNetwork.main]: ZERO_ADDRESS,
};

export const CURVE_CONFIG = {
  votingEscrow: {
    [eEthereumNetwork.main]: '0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2',
  },
  curveFeeDistributor: {
    [eEthereumNetwork.main]: '0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc',
  },
  gaugeController: {
    [eEthereumNetwork.main]: '0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB',
  },
};
