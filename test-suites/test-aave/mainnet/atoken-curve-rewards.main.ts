import { ZERO_ADDRESS } from '../../../helpers/constants';
import { makeSuite, SignerWithAddress, TestEnv } from '../helpers/make-suite';
import {
  advanceTimeAndBlock,
  evmRevert,
  evmSnapshot,
  impersonateAddress,
  increaseTime,
  waitForTx,
} from '../../../helpers/misc-utils';
import {
  getFirstSigner,
  getLendingPool,
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
} from '../../../helpers/contracts-getters';
import { deployDefaultReserveInterestRateStrategy } from '../../../helpers/contracts-deployments';
import { IERC20Factory } from '../../../types/IERC20Factory';
import BigNumberJs from 'bignumber.js';
import { CurveRewardsAwareATokenFactory } from '../../../types';
import { eContractid, eEthereumNetwork, tEthereumAddress } from '../../../helpers/types';
import { strategyWBTC } from '../../../markets/aave/reservesConfigs';
import { checkRewards } from '../helpers/rewards-distribution/verify';
import { IRewardsAwareAToken } from '../../../types/IRewardsAwareAToken';
import { IRewardsAwareATokenFactory } from '../../../types/IRewardsAwareATokenFactory';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { IERC20 } from '../../../types/IERC20';
import {
  getContractAddressWithJsonFallback,
  getParamPerNetwork,
} from '../../../helpers/contracts-helpers';
import { ConfigNames, loadPoolConfig } from '../../../helpers/configuration';

const ONE_DAY = 86400;
const { expect } = require('chai');

interface GaugeInfo {
  address: tEthereumAddress;
  name: string;
  symbol: string;
  rewardTokens: tEthereumAddress[];
}
const USER_ADDRESS = '0x9c5083dd4838E120Dbeac44C052179692Aa5dAC5';

const CRV_TOKEN = '0xd533a949740bb3306d119cc777fa900ba034cd52';
const SNX_TOKEN = '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f';

const GAUGE_AAVE3: GaugeInfo = {
  address: '0xd662908ADA2Ea1916B3318327A97eB18aD588b5d',
  name: 'aToken a3CRV Gauge Deposit',
  symbol: 'a-a3CRV-gauge',
  rewardTokens: [],
};

const GAUGE_EURS: GaugeInfo = {
  address: '0x90Bb609649E0451E5aD952683D64BD2d1f245840',
  name: 'aToken eursCRV Gauge Deposit',
  symbol: 'a-eursCRV-gauge',
  rewardTokens: ['0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F'],
};

const GAUGE_ANKR: GaugeInfo = {
  address: '0x6d10ed2cf043e6fcf51a0e7b4c2af3fa06695707',
  name: 'aToken ankrCRV Gauge Deposit',
  symbol: 'a-ankrCRV-gauge',
  rewardTokens: [
    '0xE0aD1806Fd3E7edF6FF52Fdb822432e847411033',
    '0x8290333ceF9e6D528dD5618Fb97a76f268f3EDD4',
  ],
};

const listGauge = async (gauge: GaugeInfo) => {
  const { symbol } = gauge;
  const poolConfig = loadPoolConfig(ConfigNames.Aave);
  const {
    SymbolPrefix: symbolPrefix,
    ATokenNamePrefix: aTokenNamePrefix,
    StableDebtTokenNamePrefix: stableDebtTokenNamePrefix,
    VariableDebtTokenNamePrefix: variableDebtTokenNamePrefix,
  } = poolConfig;
  const addressProvider = await getLendingPoolAddressesProvider();
  const poolConfigurator = await getLendingPoolConfiguratorProxy();

  const treasury = await getParamPerNetwork(
    poolConfig.ReserveFactorTreasuryAddress,
    eEthereumNetwork.main
  );
  const aTokenImpl = (
    await new CurveRewardsAwareATokenFactory(await getFirstSigner()).deploy(CRV_TOKEN)
  ).address;
  const stableDebtTokenImpl = await getContractAddressWithJsonFallback(
    eContractid.StableDebtToken,
    ConfigNames.Aave
  );
  const variableDebtTokenImpl = await getContractAddressWithJsonFallback(
    eContractid.VariableDebtToken,
    ConfigNames.Aave
  );
  // WBTC Strategy used as a template for tests scenario
  const interestStrategy = await deployDefaultReserveInterestRateStrategy(
    [
      addressProvider.address,
      strategyWBTC.strategy.optimalUtilizationRate,
      strategyWBTC.strategy.baseVariableBorrowRate,
      strategyWBTC.strategy.variableRateSlope1,
      strategyWBTC.strategy.variableRateSlope2,
      strategyWBTC.strategy.stableRateSlope1,
      strategyWBTC.strategy.stableRateSlope2,
    ],
    false
  );
  const interestRateStrategyAddress = interestStrategy.address;

  const curveReserveInitParams = [
    {
      aTokenImpl,
      stableDebtTokenImpl,
      variableDebtTokenImpl,
      underlyingAssetDecimals: '18',
      interestRateStrategyAddress,
      underlyingAsset: gauge.address,
      treasury,
      incentivesController: ZERO_ADDRESS,
      underlyingAssetName: gauge.symbol,
      aTokenName: `${aTokenNamePrefix} ${symbol}`,
      aTokenSymbol: `a${symbolPrefix}${symbol}`,
      variableDebtTokenName: `${variableDebtTokenNamePrefix} ${symbolPrefix}${symbol}`,
      variableDebtTokenSymbol: `variableDebt${symbolPrefix}${symbol}`,
      stableDebtTokenName: `${stableDebtTokenNamePrefix} ${symbol}`,
      stableDebtTokenSymbol: `stableDebt${symbolPrefix}${symbol}`,
      params: '0x10',
    },
  ];

  await waitForTx(await poolConfigurator.batchInitReserve(curveReserveInitParams));
};

const depositGauge = async (
  key: SignerWithAddress,
  gauge: GaugeInfo,
  aGaugeAddress: tEthereumAddress,
  amount: BigNumber,
  shouldReward?: boolean
) => {
  const pool = await getLendingPool();
  const gaugeErc20 = IERC20Factory.connect(gauge.address, key.signer);

  await gaugeErc20.connect(key.signer).approve(pool.address, amount);

  const txDeposit = await waitForTx(
    await pool.connect(key.signer).deposit(gauge.address, amount, key.address, '0')
  );

  await checkRewards(key, aGaugeAddress, txDeposit.blockNumber, shouldReward);
};

const withdrawGauge = async (
  key: SignerWithAddress,
  gauge: GaugeInfo,
  aGaugeAddress: tEthereumAddress,
  shouldReward = true
) => {
  const pool = await getLendingPool();
  const aGauge = IRewardsAwareATokenFactory.connect(aGaugeAddress, key.signer);

  const entireBalance = await aGauge.balanceOf(key.address);

  await aGauge.connect(key.signer).approve(pool.address, entireBalance);

  const txWithdraw = await waitForTx(
    await pool.connect(key.signer).withdraw(gauge.address, entireBalance, key.address)
  );

  await checkRewards(key, aGaugeAddress, txWithdraw.blockNumber, shouldReward);
};

const claimFromGauge = async (
  key: SignerWithAddress,
  gauge: GaugeInfo,
  aGaugeAddress: tEthereumAddress,
  shouldReward = true
) => {
  const aGauge = IRewardsAwareATokenFactory.connect(aGaugeAddress, key.signer);
  const rewardTokens = await aGauge.getRewardsTokenAddressList();

  for (let x = 0; x < rewardTokens.length; x++) {
    if (rewardTokens[x] == ZERO_ADDRESS) break;

    const balanceBefore = await IERC20Factory.connect(rewardTokens[x], key.signer).balanceOf(
      key.address
    );
    const txClaim = await waitForTx(await aGauge.claim(rewardTokens[x]));

    await checkRewards(
      key,
      aGaugeAddress,
      txClaim.blockNumber,
      shouldReward,
      rewardTokens[x],
      balanceBefore
    );
  }
};

makeSuite('Curve Rewards Aware aToken', (testEnv: TestEnv) => {
  let evmSnapshotId;
  let depositor: SignerWithAddress;

  let gaugeEursErc20: IERC20;
  let gaugeAave3Erc20: IERC20;
  let gaugeAnkrErc20: IERC20;

  let aEURS: IRewardsAwareAToken;
  let aAAVE3: IRewardsAwareAToken;
  let aANKR: IRewardsAwareAToken;

  let crvToken: IERC20;
  let snxToken: IERC20;

  before('Initializing configuration', async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumberJs.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumberJs.ROUND_DOWN });

    // Set local vars
    depositor = await impersonateAddress(USER_ADDRESS);

    gaugeEursErc20 = IERC20Factory.connect(GAUGE_EURS.address, depositor.signer);
    gaugeAave3Erc20 = IERC20Factory.connect(GAUGE_AAVE3.address, depositor.signer);
    gaugeAnkrErc20 = IERC20Factory.connect(GAUGE_ANKR.address, depositor.signer);
    crvToken = IERC20Factory.connect(CRV_TOKEN, depositor.signer);
    snxToken = IERC20Factory.connect(SNX_TOKEN, depositor.signer);

    // Depositor should have EURS, AAVE3, and ANKR gauges balance
    const gaugeEursBalance = await gaugeEursErc20.balanceOf(USER_ADDRESS);
    const gaugeAave3Balance = await gaugeAave3Erc20.balanceOf(USER_ADDRESS);
    const gaugeAnkrBalance = await gaugeAnkrErc20.balanceOf(USER_ADDRESS);

    expect(gaugeEursBalance).to.be.gt('0');
    expect(gaugeAave3Balance).to.be.gt('0');
    expect(gaugeAnkrBalance).to.be.gt('0');

    // Gauge tokens should be listed at Aave test deployment
    await listGauge(GAUGE_EURS);
    await listGauge(GAUGE_AAVE3);
    await listGauge(GAUGE_ANKR);

    const allTokens = await testEnv.helpersContract.getAllATokens();

    aEURS = IRewardsAwareATokenFactory.connect(
      allTokens.find((aToken) => aToken.symbol.includes('eurs'))?.tokenAddress || ZERO_ADDRESS,
      await getFirstSigner()
    );
    aAAVE3 = IRewardsAwareATokenFactory.connect(
      allTokens.find((aToken) => aToken.symbol.includes('a3CRV'))?.tokenAddress || ZERO_ADDRESS,
      await getFirstSigner()
    );
    aANKR = IRewardsAwareATokenFactory.connect(
      allTokens.find((aToken) => aToken.symbol.includes('ankr'))?.tokenAddress || ZERO_ADDRESS,

      await getFirstSigner()
    );
  });

  after('Reset', () => {
    // Reset BigNumber
    BigNumberJs.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumberJs.ROUND_HALF_UP });
  });

  describe('AToken with only CRV rewards - AAVE3 Gauge', () => {
    before(async () => {
      evmSnapshotId = await evmSnapshot();
    });

    after(async () => {
      await evmRevert(evmSnapshotId);
    });

    it('Deposit and generate user reward checkpoints', async () => {
      // Deposits
      await depositGauge(depositor, GAUGE_AAVE3, aAAVE3.address, parseEther('100000'));
      const curveATokenBalance = await crvToken.balanceOf(aAAVE3.address);
      expect(curveATokenBalance).to.be.eq('0', 'CRV rewards should be zero');
    });

    it('Increase time and claim CRV', async () => {
      // Pass time to generate rewards
      await increaseTime(ONE_DAY);

      // Claim
      await claimFromGauge(depositor, GAUGE_AAVE3, aAAVE3.address);
      const curveATokenBalance = await crvToken.balanceOf(aAAVE3.address);
      expect(curveATokenBalance).to.be.eq(
        '0',
        'CRV Balance should be zero as there is only one aToken holder'
      );
    });

    it('Pass time and withdraw Staked AAVE3', async () => {
      // Pass time to generate rewards
      await increaseTime(ONE_DAY);

      // Withdraw
      await withdrawGauge(depositor, GAUGE_AAVE3, aAAVE3.address);
      const curveATokenBalance = await crvToken.balanceOf(aAAVE3.address);
      expect(curveATokenBalance).to.be.eq('0', 'CRV rewards should be zero');
    });

    it('Claim the remaining CRV', async () => {
      // Claim
      await claimFromGauge(depositor, GAUGE_AAVE3, aAAVE3.address);
      const curveATokenBalance = await crvToken.balanceOf(aAAVE3.address);
      expect(curveATokenBalance).to.be.eq(
        '0',
        'CRV Balance should be zero as there is only one aToken holder'
      );
    });
  });

  describe('AToken with CRV and 1 extra rewards - EURS Gauge', () => {
    before(async () => {
      evmSnapshotId = await evmSnapshot();
    });

    after(async () => {
      await evmRevert(evmSnapshotId);
    });

    it('Deposit and generate user reward checkpoints', async () => {
      // Deposits

      await depositGauge(depositor, GAUGE_EURS, aEURS.address, parseEther('100000'));
      const curveATokenBalance = await crvToken.balanceOf(aEURS.address);
      expect(curveATokenBalance).to.be.eq('0', 'CRV should be zero');
    });

    it('Increase time and claim CRV and SNX', async () => {
      // Pass time to generate rewards
      await advanceTimeAndBlock(ONE_DAY * 14);

      // Claim
      await claimFromGauge(depositor, GAUGE_EURS, aEURS.address);
    });

    it('Pass time and withdraw Staked EURS', async () => {
      // Pass time to generate rewards
      await increaseTime(ONE_DAY);

      // Withdraw
      await withdrawGauge(depositor, GAUGE_EURS, aEURS.address);
    });

    it('Claim the remaining CRV and SNX', async () => {
      // Claim
      await claimFromGauge(depositor, GAUGE_EURS, aEURS.address);
    });
  });

  describe('AToken with CRV and 2 extra rewards - ANKR Gauge', () => {
    before(async () => {
      evmSnapshotId = await evmSnapshot();
    });

    after(async () => {
      await evmRevert(evmSnapshotId);
    });

    it('Deposit and generate user reward checkpoints', async () => {
      // Deposits
      await depositGauge(
        depositor,
        GAUGE_ANKR,
        aANKR.address,
        parseEther('2002.018841813024963468')
      );
    });

    it('Increase time and claim CRV with extra rewards', async () => {
      // Pass time to generate rewards
      await increaseTime(ONE_DAY * 30);

      // Claim
      await claimFromGauge(depositor, GAUGE_ANKR, aANKR.address);
    });

    it('Pass time and withdraw Staked ANKR', async () => {
      // Pass time to generate rewards
      await increaseTime(ONE_DAY * 30);

      // Withdraw
      await withdrawGauge(depositor, GAUGE_ANKR, aANKR.address);
    });

    it('Claim the CRV with extra rewards', async () => {
      // Claim
      await claimFromGauge(depositor, GAUGE_ANKR, aANKR.address);
    });
  });
});
