import { MAX_UINT_AMOUNT, ZERO_ADDRESS } from '../../../helpers/constants';
import { makeSuite, SignerWithAddress, TestEnv } from '../helpers/make-suite';
import {
  advanceTimeAndBlock,
  DRE,
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
import { deployCurveGaugeReserveInterestRateStrategy } from '../../../helpers/contracts-deployments';
import { IERC20Factory } from '../../../types/IERC20Factory';
import BigNumberJs from 'bignumber.js';
import {
  CurveGaugeRewardsAwareATokenFactory,
  CurveTreasury,
  CurveTreasuryFactory,
} from '../../../types';
import { eContractid, eEthereumNetwork, tEthereumAddress } from '../../../helpers/types';
import { strategyWBTC } from '../../../markets/aave/reservesConfigs';
import { checkRewards } from '../helpers/rewards-distribution/verify';
import { IRewardsAwareAToken } from '../../../types/IRewardsAwareAToken';
import { IRewardsAwareATokenFactory } from '../../../types/IRewardsAwareATokenFactory';
import { BigNumber } from 'ethers';
import { defaultAbiCoder, formatEther, parseEther } from 'ethers/lib/utils';
import { IERC20 } from '../../../types/IERC20';
import {
  getContractAddressWithJsonFallback,
  getParamPerNetwork,
} from '../../../helpers/contracts-helpers';
import { ConfigNames, loadPoolConfig } from '../../../helpers/configuration';
import { ICurveGaugeFactory } from '../../../types/ICurveGaugeFactory';
const ONE_DAY = 86400;
const { expect } = require('chai');

interface GaugeInfo {
  underlying: tEthereumAddress;
  address: tEthereumAddress;
  name: string;
  symbol: string;
  rewardTokens: tEthereumAddress[];
}
const USER_ADDRESS = '0x9c5083dd4838E120Dbeac44C052179692Aa5dAC5';

const CRV_TOKEN = '0xd533a949740bb3306d119cc777fa900ba034cd52';
const SNX_TOKEN = '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f';

const GAUGE_3POOL: GaugeInfo = {
  underlying: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
  address: '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A',
  name: 'aToken 3pool Gauge Deposit',
  symbol: 'a-3poolCRV-gauge',
  rewardTokens: [],
};

const GAUGE_AAVE3: GaugeInfo = {
  underlying: '0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900',
  address: '0xd662908ADA2Ea1916B3318327A97eB18aD588b5d',
  name: 'aToken a3CRV Gauge Deposit',
  symbol: 'a-a3CRV-gauge',
  rewardTokens: [],
};

const GAUGE_EURS: GaugeInfo = {
  underlying: '0x194eBd173F6cDacE046C53eACcE9B953F28411d1',
  address: '0x90Bb609649E0451E5aD952683D64BD2d1f245840',
  name: 'aToken eursCRV Gauge Deposit',
  symbol: 'a-eursCRV-gauge',
  rewardTokens: ['0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F'],
};

const GAUGE_ANKR: GaugeInfo = {
  underlying: '0xaA17A236F2bAdc98DDc0Cf999AbB47D47Fc0A6Cf',
  address: '0x6d10ed2cf043e6fcf51a0e7b4c2af3fa06695707',
  name: 'aToken ankrCRV Gauge Deposit',
  symbol: 'a-ankrCRV-gauge',
  rewardTokens: [
    '0xE0aD1806Fd3E7edF6FF52Fdb822432e847411033',
    '0x8290333ceF9e6D528dD5618Fb97a76f268f3EDD4',
  ],
};
const isGaugeV2 = (address: tEthereumAddress) =>
  GAUGE_3POOL.address.toLowerCase() !== address.toLowerCase();

const unstakeAllGauges = async (key: SignerWithAddress, gauges: tEthereumAddress[]) => {
  for (let x = 0; x < gauges.length; x++) {
    if (isGaugeV2(gauges[x])) {
      await waitForTx(
        await IERC20Factory.connect(gauges[x], key.signer).approve(gauges[x], MAX_UINT_AMOUNT)
      );
    }
    const balance = IERC20Factory.connect(gauges[x], key.signer).balanceOf(key.address);
    await waitForTx(await ICurveGaugeFactory.connect(gauges[x], key.signer).withdraw(balance));
  }
};

const listCurveLPToken = async (gauge: GaugeInfo, curveTreasury: tEthereumAddress) => {
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
    await new CurveGaugeRewardsAwareATokenFactory(await getFirstSigner()).deploy(
      CRV_TOKEN,
      curveTreasury
    )
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
  const interestStrategy = await deployCurveGaugeReserveInterestRateStrategy(
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
  const encodedParams = defaultAbiCoder.encode(
    ['address', 'bool'],
    [gauge.address, isGaugeV2(gauge.address)]
  );
  const curveReserveInitParams = [
    {
      aTokenImpl,
      stableDebtTokenImpl,
      variableDebtTokenImpl,
      underlyingAssetDecimals: '18',
      interestRateStrategyAddress,
      underlyingAsset: gauge.underlying,
      treasury,
      incentivesController: ZERO_ADDRESS,
      underlyingAssetName: gauge.symbol,
      aTokenName: `${aTokenNamePrefix} ${symbol}`,
      aTokenSymbol: `a${symbolPrefix}${symbol}`,
      variableDebtTokenName: `${variableDebtTokenNamePrefix} ${symbolPrefix}${symbol}`,
      variableDebtTokenSymbol: `variableDebt${symbolPrefix}${symbol}`,
      stableDebtTokenName: `${stableDebtTokenNamePrefix} ${symbol}`,
      stableDebtTokenSymbol: `stableDebt${symbolPrefix}${symbol}`,
      params: encodedParams,
    },
  ];

  await waitForTx(await poolConfigurator.batchInitReserve(curveReserveInitParams));
};

const depositPoolToken = async (
  key: SignerWithAddress,
  gauge: GaugeInfo,
  aTokenAddress: tEthereumAddress,
  amount: BigNumber,
  shouldReward?: boolean
) => {
  const pool = await getLendingPool();
  const curveReserveToken = IERC20Factory.connect(gauge.underlying, key.signer);

  await waitForTx(await curveReserveToken.connect(key.signer).approve(pool.address, 0));
  await waitForTx(await curveReserveToken.connect(key.signer).approve(pool.address, amount));

  const txDeposit = await waitForTx(
    await pool.connect(key.signer).deposit(gauge.underlying, amount, key.address, '0')
  );

  await checkRewards(key, aTokenAddress, txDeposit.blockNumber, shouldReward);
};

const withdrawPoolToken = async (
  key: SignerWithAddress,
  gauge: GaugeInfo,
  aTokenAddress: tEthereumAddress,
  shouldReward = true
) => {
  const pool = await getLendingPool();
  const aGauge = IRewardsAwareATokenFactory.connect(aTokenAddress, key.signer);

  const entireBalance = await aGauge.balanceOf(key.address);

  await aGauge.connect(key.signer).approve(pool.address, entireBalance);

  const txWithdraw = await waitForTx(
    await pool.connect(key.signer).withdraw(gauge.underlying, entireBalance, key.address)
  );

  await checkRewards(key, aTokenAddress, txWithdraw.blockNumber, shouldReward);
};

const claimFromGauge = async (
  key: SignerWithAddress,
  gauge: GaugeInfo,
  aTokenAddress: tEthereumAddress,
  shouldReward = true
) => {
  const aToken = IRewardsAwareATokenFactory.connect(aTokenAddress, key.signer);
  const rewardTokens = await aToken.getRewardsTokenAddressList();

  for (let x = 0; x < rewardTokens.length; x++) {
    if (rewardTokens[x] == ZERO_ADDRESS) break;

    const balanceBefore = await IERC20Factory.connect(rewardTokens[x], key.signer).balanceOf(
      key.address
    );
    const txClaim = await waitForTx(await aToken.claim(rewardTokens[x]));

    await checkRewards(
      key,
      aTokenAddress,
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

  let curve3poolErc20: IERC20;
  let curveEursErc20: IERC20;
  let curveAave3Erc20: IERC20;
  let curveAnkrErc20: IERC20;

  let a3POOL: IRewardsAwareAToken;
  let aEURS: IRewardsAwareAToken;
  let aAAVE3: IRewardsAwareAToken;
  let aANKR: IRewardsAwareAToken;

  let crvToken: IERC20;
  let snxToken: IERC20;

  let curveTreasury: CurveTreasury;

  before('Initializing configuration', async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumberJs.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumberJs.ROUND_DOWN });

    // Set local vars
    depositor = await impersonateAddress(USER_ADDRESS);

    curve3poolErc20 = IERC20Factory.connect(GAUGE_3POOL.underlying, depositor.signer);
    curveEursErc20 = IERC20Factory.connect(GAUGE_EURS.underlying, depositor.signer);
    curveAave3Erc20 = IERC20Factory.connect(GAUGE_AAVE3.underlying, depositor.signer);
    curveAnkrErc20 = IERC20Factory.connect(GAUGE_ANKR.underlying, depositor.signer);
    crvToken = IERC20Factory.connect(CRV_TOKEN, depositor.signer);
    snxToken = IERC20Factory.connect(SNX_TOKEN, depositor.signer);
    // Unstake gauges to deposit into Aave
    await unstakeAllGauges(depositor, [
      GAUGE_3POOL.address,
      GAUGE_AAVE3.address,
      GAUGE_EURS.address,
      GAUGE_ANKR.address,
    ]);

    // Depositor should have 3pool, EURS, AAVE3, and ANKR balance
    const curve3poolBalance = await curve3poolErc20.balanceOf(USER_ADDRESS);
    const curveEursBalance = await curveEursErc20.balanceOf(USER_ADDRESS);
    const curveAave3Balance = await curveAave3Erc20.balanceOf(USER_ADDRESS);
    const curveAnkrBalance = await curveAnkrErc20.balanceOf(USER_ADDRESS);

    expect(curve3poolBalance).to.be.gt('0', 'insufficient 3pool');
    expect(curveEursBalance).to.be.gt('0', 'insufficient eurs');
    expect(curveAave3Balance).to.be.gt('0', 'insufficient aave3');
    expect(curveAnkrBalance).to.be.gt('0', 'insufficient ankr');

    // Deploy Curve Treasury
    const poolConfig = loadPoolConfig(ConfigNames.Aave);
    const collector = await getParamPerNetwork(
      poolConfig.ReserveFactorTreasuryAddress,
      eEthereumNetwork.main
    );

    const { proxy: curveTreasuryAddress } = await DRE.run('deploy-curve-treasury', {
      proxyAdmin: testEnv.users[1].address,
      treasuryAdmin: testEnv.users[0].address,
      collector,
    });

    // Gauge tokens should be listed at Aave test deployment
    await listCurveLPToken(GAUGE_3POOL, curveTreasuryAddress);
    await listCurveLPToken(GAUGE_EURS, curveTreasuryAddress);
    await listCurveLPToken(GAUGE_AAVE3, curveTreasuryAddress);
    await listCurveLPToken(GAUGE_ANKR, curveTreasuryAddress);

    const allTokens = await testEnv.helpersContract.getAllATokens();

    a3POOL = IRewardsAwareATokenFactory.connect(
      allTokens.find((aToken) => aToken.symbol.includes('3pool'))?.tokenAddress || ZERO_ADDRESS,
      await getFirstSigner()
    );
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
    curveTreasury = CurveTreasuryFactory.connect(curveTreasuryAddress, testEnv.users[0].signer);

    // Enable atoken entities into Curve Treasury
    console.log(a3POOL.address, aEURS.address, aAAVE3.address, aANKR.address);
    await waitForTx(
      await curveTreasury.setWhitelist(
        [a3POOL.address, aEURS.address, aAAVE3.address, aANKR.address],
        [
          GAUGE_3POOL.underlying,
          GAUGE_EURS.underlying,
          GAUGE_AAVE3.underlying,
          GAUGE_ANKR.underlying,
        ],
        [GAUGE_3POOL.address, GAUGE_EURS.address, GAUGE_AAVE3.address, GAUGE_ANKR.address],
        [false, true, true, true],
        [true, true, true, true]
      )
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
      await depositPoolToken(depositor, GAUGE_AAVE3, aAAVE3.address, parseEther('100000'));
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
      await withdrawPoolToken(depositor, GAUGE_AAVE3, aAAVE3.address);
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

  describe('AToken with only CRV rewards - 3pool Gauge', () => {
    before(async () => {
      evmSnapshotId = await evmSnapshot();
    });

    after(async () => {
      await evmRevert(evmSnapshotId);
    });

    it('Deposit and generate user reward checkpoints', async () => {
      // Deposits
      await depositPoolToken(depositor, GAUGE_3POOL, a3POOL.address, parseEther('2000'));
      const curveATokenBalance = await crvToken.balanceOf(a3POOL.address);
      expect(curveATokenBalance).to.be.eq('0', 'CRV rewards should be zero');
    });

    it('Increase time and claim CRV', async () => {
      // Pass time to generate rewards
      await increaseTime(ONE_DAY);

      // Claim
      await claimFromGauge(depositor, GAUGE_3POOL, a3POOL.address);
      const curveATokenBalance = await crvToken.balanceOf(a3POOL.address);
      expect(curveATokenBalance).to.be.eq(
        '0',
        'CRV Balance should be zero as there is only one aToken holder'
      );
    });

    it('Pass time and withdraw Staked 3pool', async () => {
      // Pass time to generate rewards
      await increaseTime(ONE_DAY);

      // Withdraw
      await withdrawPoolToken(depositor, GAUGE_3POOL, a3POOL.address, true);
      const curveATokenBalance = await crvToken.balanceOf(a3POOL.address);
      expect(curveATokenBalance).to.be.eq('0', 'CRV rewards should be zero');
    });

    it('Claim the remaining CRV, should not reward', async () => {
      // Claim
      await claimFromGauge(depositor, GAUGE_AAVE3, aAAVE3.address, false);
      const curveATokenBalance = await crvToken.balanceOf(a3POOL.address);
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

      await depositPoolToken(depositor, GAUGE_EURS, aEURS.address, parseEther('100000'));
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
      await withdrawPoolToken(depositor, GAUGE_EURS, aEURS.address);
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
      await depositPoolToken(
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
      await withdrawPoolToken(depositor, GAUGE_ANKR, aANKR.address);
    });

    it('Claim the CRV with extra rewards', async () => {
      // Claim
      await claimFromGauge(depositor, GAUGE_ANKR, aANKR.address);
    });
  });
});
