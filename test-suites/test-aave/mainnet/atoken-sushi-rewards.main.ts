import {
  MASTER_CHEF,
  MAX_UINT_AMOUNT,
  SUSHI_BAR,
  SUSHI_TOKEN,
  ZERO_ADDRESS,
} from '../../../helpers/constants';
import { makeSuite, SignerWithAddress, TestEnv } from '../helpers/make-suite';
import {
  evmRevert,
  evmSnapshot,
  increaseTime,
  impersonateAddress,
  waitForTx,
  DRE,
} from '../../../helpers/misc-utils';
import {
  getAaveOracle,
  getATokensAndRatesHelper,
  getFirstSigner,
  getLendingPool,
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
} from '../../../helpers/contracts-getters';
import {
  deploySushiAmmReserveInterestRateStrategy,
  deploySushiRewardsAwareAToken,
} from '../../../helpers/contracts-deployments';
import { IERC20Factory } from '../../../types/IERC20Factory';
import BigNumberJs from 'bignumber.js';
import { eContractid, eEthereumNetwork, RateMode, tEthereumAddress } from '../../../helpers/types';
import { strategyWETH } from '../../../markets/aave/reservesConfigs';
import { checkRewards } from '../helpers/rewards-distribution/verify';
import { IRewardsAwareAToken } from '../../../types/IRewardsAwareAToken';
import { IRewardsAwareATokenFactory } from '../../../types/IRewardsAwareATokenFactory';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { IERC20 } from '../../../types/IERC20';
import { IMasterChefFactory } from '../../../types/IMasterChefFactory';
import { loadPoolConfig, ConfigNames } from '../../../helpers/configuration';
import {
  getParamPerNetwork,
  getContractAddressWithJsonFallback,
} from '../../../helpers/contracts-helpers';
import { IMasterChef } from '../../../types/IMasterChef';

const ONE_DAY = 86400;
const { expect } = require('chai');

interface SLPInfo {
  address: tEthereumAddress;
  name: string;
  symbol: string;
}

const poolId = '12';
const USER_ADDRESS = '0x40e234f653Ac53e94B1F097a6f67756A164Cdb2D';

const LP_SUSHI_WETH: SLPInfo = {
  address: '0x795065dCc9f64b5614C407a6EFDC400DA6221FB0',
  name: 'Sushi SLP SUSHI-WETH',
  symbol: 'SLP-SUSHI-WETH',
};

const listSushiShareLP = async (slp: SLPInfo) => {
  const { symbol } = slp;
  const poolConfig = loadPoolConfig(ConfigNames.Aave);
  const aTokenAndRatesDeployer = await getATokensAndRatesHelper();
  const aaveOracle = await getAaveOracle();

  const {
    SymbolPrefix: symbolPrefix,
    ATokenNamePrefix: aTokenNamePrefix,
    StableDebtTokenNamePrefix: stableDebtTokenNamePrefix,
    VariableDebtTokenNamePrefix: variableDebtTokenNamePrefix,
  } = poolConfig;
  const addressProvider = await getLendingPoolAddressesProvider();
  const poolConfigurator = await getLendingPoolConfiguratorProxy();
  const admin = await addressProvider.getPoolAdmin();

  const treasury = await getParamPerNetwork(
    poolConfig.ReserveFactorTreasuryAddress,
    eEthereumNetwork.main
  );
  const aTokenImpl = (
    await deploySushiRewardsAwareAToken(
      MASTER_CHEF[eEthereumNetwork.main],
      SUSHI_BAR[eEthereumNetwork.main],
      SUSHI_TOKEN[eEthereumNetwork.main]
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
  const interestStrategy = await deploySushiAmmReserveInterestRateStrategy(
    [
      addressProvider.address,
      strategyWETH.strategy.optimalUtilizationRate,
      strategyWETH.strategy.baseVariableBorrowRate,
      strategyWETH.strategy.variableRateSlope1,
      strategyWETH.strategy.variableRateSlope2,
      strategyWETH.strategy.stableRateSlope1,
      strategyWETH.strategy.stableRateSlope2,
    ],
    false
  );
  const interestRateStrategyAddress = interestStrategy.address;

  const sushiParams = DRE.ethers.utils.defaultAbiCoder.encode(['uint256'], [poolId]);

  const curveReserveInitParams = [
    {
      aTokenImpl,
      stableDebtTokenImpl,
      variableDebtTokenImpl,
      underlyingAssetDecimals: '18',
      interestRateStrategyAddress,
      underlyingAsset: slp.address,
      treasury,
      incentivesController: ZERO_ADDRESS,
      underlyingAssetName: slp.symbol,
      aTokenName: `${aTokenNamePrefix} ${symbol}`,
      aTokenSymbol: `a${symbolPrefix}${symbol}`,
      variableDebtTokenName: `${variableDebtTokenNamePrefix} ${symbolPrefix}${symbol}`,
      variableDebtTokenSymbol: `variableDebt${symbolPrefix}${symbol}`,
      stableDebtTokenName: `${stableDebtTokenNamePrefix} ${symbol}`,
      stableDebtTokenSymbol: `stableDebt${symbolPrefix}${symbol}`,
      params: sushiParams,
    },
  ];
  const reserveConfig = [
    {
      asset: slp.address,
      baseLTV: strategyWETH.baseLTVAsCollateral,
      liquidationThreshold: strategyWETH.liquidationThreshold,
      liquidationBonus: strategyWETH.liquidationBonus,
      reserveFactor: strategyWETH.reserveFactor,
      stableBorrowingEnabled: strategyWETH.stableBorrowRateEnabled,
      borrowingEnabled: strategyWETH.borrowingEnabled,
    },
  ];
  // Set SUSHI LP as WBTC price until proper oracle aggregator deployment
  await aaveOracle.setAssetSources(
    [slp.address],
    [getParamPerNetwork(poolConfig.ChainlinkAggregator, eEthereumNetwork.main).WBTC.toString()]
  );

  // Init reserve
  await waitForTx(await poolConfigurator.batchInitReserve(curveReserveInitParams));

  // Configure reserve
  await waitForTx(await addressProvider.setPoolAdmin(aTokenAndRatesDeployer.address));
  await waitForTx(await aTokenAndRatesDeployer.configureReserves(reserveConfig));
  await waitForTx(await addressProvider.setPoolAdmin(admin));
};

const deposit = async (
  key: SignerWithAddress,
  slp: SLPInfo,
  aGaugeAddress: tEthereumAddress,
  amount: BigNumber,
  shouldReward?: boolean
) => {
  const pool = await getLendingPool();
  const slpErc20 = IERC20Factory.connect(slp.address, key.signer);

  await slpErc20.connect(key.signer).approve(pool.address, amount);

  const txDeposit = await waitForTx(
    await pool.connect(key.signer).deposit(slp.address, amount, key.address, '0')
  );

  await checkRewards(key, aGaugeAddress, txDeposit.blockNumber, shouldReward);
};

const withdraw = async (
  key: SignerWithAddress,
  slp: SLPInfo,
  aSLPAdress: tEthereumAddress,
  amount?: BigNumberish,
  shouldReward = true
) => {
  const pool = await getLendingPool();
  const aSLP = IRewardsAwareATokenFactory.connect(aSLPAdress, key.signer);

  const withdrawAmount = amount ? amount : await aSLP.balanceOf(key.address);
  await aSLP.connect(key.signer).approve(pool.address, withdrawAmount);

  const txWithdraw = await waitForTx(
    await pool.connect(key.signer).withdraw(slp.address, withdrawAmount, key.address)
  );

  await checkRewards(key, aSLPAdress, txWithdraw.blockNumber, shouldReward);
};

const withdrawFarm = async (key: SignerWithAddress) => {
  const masterChef = IMasterChefFactory.connect(MASTER_CHEF[eEthereumNetwork.main], key.signer);
  const { 0: amount } = await masterChef.userInfo(poolId, key.address);

  await masterChef.withdraw(poolId, amount);
};

const claim = async (key: SignerWithAddress, aSLPAdress: tEthereumAddress, shouldReward = true) => {
  const aSLP = IRewardsAwareATokenFactory.connect(aSLPAdress, key.signer);
  const rewardTokens = await aSLP.getRewardsTokenAddressList();

  for (let x = 0; x < rewardTokens.length; x++) {
    if (rewardTokens[x] == ZERO_ADDRESS) break;
    const balanceBefore = await IERC20Factory.connect(rewardTokens[x], key.signer).balanceOf(
      key.address
    );
    const txClaim = await waitForTx(await aSLP.claim(rewardTokens[x]));

    await checkRewards(
      key,
      aSLPAdress,
      txClaim.blockNumber,
      shouldReward,
      rewardTokens[x],
      balanceBefore
    );
  }
};

makeSuite('Sushi LP Rewards Aware aToken', (testEnv: TestEnv) => {
  let evmSnapshotId;
  let depositor: SignerWithAddress;
  let secondDepositor: SignerWithAddress;
  let thirdDepositor: SignerWithAddress;

  let aSLP_SUSHI_WETH: IRewardsAwareAToken;

  let sushiToken: IERC20;

  let xSushiToken: IERC20;

  let masterChef: IMasterChef;

  let LP_SUSHI_WETH_TOKEN: IERC20;

  before('Initializing configuration', async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumberJs.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumberJs.ROUND_DOWN });

    // Set local vars
    depositor = await impersonateAddress(USER_ADDRESS);
    secondDepositor = testEnv.users[2];
    thirdDepositor = testEnv.users[3];

    // Gauge tokens should be listed at Aave test deployment
    await listSushiShareLP(LP_SUSHI_WETH);

    const allTokens = await testEnv.helpersContract.getAllATokens();

    LP_SUSHI_WETH_TOKEN = await IERC20Factory.connect(LP_SUSHI_WETH.address, depositor.signer);

    aSLP_SUSHI_WETH = IRewardsAwareATokenFactory.connect(
      allTokens.find((aToken) => aToken.symbol.includes(LP_SUSHI_WETH.symbol))?.tokenAddress ||
        ZERO_ADDRESS,
      await getFirstSigner()
    );

    sushiToken = IERC20Factory.connect(
      await IMasterChefFactory.connect(
        MASTER_CHEF[eEthereumNetwork.main],
        depositor.signer
      ).sushi(),
      depositor.signer
    );

    xSushiToken = IERC20Factory.connect(SUSHI_BAR[eEthereumNetwork.main], depositor.signer);

    masterChef = IMasterChefFactory.connect(MASTER_CHEF[eEthereumNetwork.main], depositor.signer);

    // Retrieve LP tokens from farm
    await withdrawFarm(depositor);

    // Set reserve factor to 20%
    await aSLP_SUSHI_WETH.connect(testEnv.deployer.signer).setRewardsReserveFactor('2000');
  });

  after('Reset', () => {
    // Reset BigNumber
    BigNumberJs.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumberJs.ROUND_HALF_UP });
  });

  describe('AToken with Sushi rewards: deposit, claim and withdraw SUSHI-WETH', () => {
    let DEPOSIT_AMOUNT: BigNumber;

    before(async () => {
      evmSnapshotId = await evmSnapshot();
      DEPOSIT_AMOUNT = await IERC20Factory.connect(
        LP_SUSHI_WETH.address,
        depositor.signer
      ).balanceOf(depositor.address);
    });

    after(async () => {
      await evmRevert(evmSnapshotId);
    });

    it('Deposit and generate user reward checkpoints', async () => {
      // Deposits
      await deposit(depositor, LP_SUSHI_WETH, aSLP_SUSHI_WETH.address, DEPOSIT_AMOUNT);
      const rewardATokenBalance = await sushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      const depositorBalance = await IERC20Factory.connect(
        LP_SUSHI_WETH.address,
        depositor.signer
      ).balanceOf(depositor.address);
      const xSUSHIATokenBalance = await xSushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      expect(rewardATokenBalance).to.be.eq('0', 'SUSHI rewards should be zero at contract');
      expect(xSUSHIATokenBalance).to.be.eq('0', 'xSUSHI should be zero at contract');
      expect(depositorBalance).to.be.eq(
        '0',
        'Depositor ERC20 balance should be zero after deposit'
      );
    });

    it('Increase time and claim SUSHI', async () => {
      // Pass time to generate rewards
      await increaseTime(ONE_DAY);

      // Claim
      await claim(depositor, aSLP_SUSHI_WETH.address);
      const rewardATokenBalance = await sushiToken.balanceOf(aSLP_SUSHI_WETH.address);

      expect(rewardATokenBalance).to.be.eq(
        '0',
        'SUSHI Balance should be zero as there is only one aToken holder'
      );
    });

    it('Pass time and withdraw SUSHI-WETH', async () => {
      // Pass time to generate rewards
      await increaseTime(ONE_DAY);

      // Withdraw
      await withdraw(depositor, LP_SUSHI_WETH, aSLP_SUSHI_WETH.address);
      const rewardATokenBalance = await sushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      const depositorBalance = await IERC20Factory.connect(
        LP_SUSHI_WETH.address,
        depositor.signer
      ).balanceOf(depositor.address);
      const xSUSHIATokenBalance = await xSushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      expect(rewardATokenBalance).to.be.eq('0', 'SUSHI rewards should be zero at contract');
      expect(xSUSHIATokenBalance).to.be.gt('0', 'Should be staking xSUSHI at contract');
      expect(depositorBalance).to.be.eq(
        DEPOSIT_AMOUNT,
        'Depositor should had initial ERC20 balance'
      );
    });

    it('Claim the remaining Sushi', async () => {
      await claim(depositor, aSLP_SUSHI_WETH.address);
      const rewardATokenBalance = await sushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      const depositorBalance = await IERC20Factory.connect(
        LP_SUSHI_WETH.address,
        depositor.signer
      ).balanceOf(depositor.address);
      const xSUSHIContractBalance = await xSushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      expect(rewardATokenBalance).to.be.eq('0', 'SUSHI rewards should be zero at contract');
      expect(depositorBalance).to.be.eq(
        DEPOSIT_AMOUNT,
        'Depositor should had initial ERC20 balance'
      );
      expect(xSUSHIContractBalance).to.be.lte(
        '10',
        'XSUSHI balance should be near zero at contract'
      );
    });
  });
  describe('AToken with Sushi rewards: deposit SUSHI-WETH, borrow and repay', () => {
    let DEPOSIT_AMOUNT: BigNumber;
    let DEPOSIT_AMOUNT_2: BigNumber;
    let DEPOSIT_AMOUNT_3: BigNumber;

    before(async () => {
      evmSnapshotId = await evmSnapshot();
      const balanceToShare = (await LP_SUSHI_WETH_TOKEN.balanceOf(depositor.address)).div(2);

      DEPOSIT_AMOUNT_2 = balanceToShare.div(3);
      DEPOSIT_AMOUNT_3 = balanceToShare.sub(DEPOSIT_AMOUNT_2);

      await LP_SUSHI_WETH_TOKEN.transfer(secondDepositor.address, DEPOSIT_AMOUNT_2);
      await LP_SUSHI_WETH_TOKEN.transfer(thirdDepositor.address, DEPOSIT_AMOUNT_3);

      DEPOSIT_AMOUNT = (await LP_SUSHI_WETH_TOKEN.balanceOf(depositor.address)).div(2);
    });

    after(async () => {
      await evmRevert(evmSnapshotId);
    });

    it('Deposit', async () => {
      const priorDepositorBalance = await IERC20Factory.connect(
        LP_SUSHI_WETH.address,
        depositor.signer
      ).balanceOf(depositor.address);

      // Deposits
      await deposit(depositor, LP_SUSHI_WETH, aSLP_SUSHI_WETH.address, DEPOSIT_AMOUNT);
      await deposit(secondDepositor, LP_SUSHI_WETH, aSLP_SUSHI_WETH.address, DEPOSIT_AMOUNT_2);
      await deposit(thirdDepositor, LP_SUSHI_WETH, aSLP_SUSHI_WETH.address, DEPOSIT_AMOUNT_3);

      const rewardATokenBalance = await sushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      const depositorBalance = await IERC20Factory.connect(
        LP_SUSHI_WETH.address,
        depositor.signer
      ).balanceOf(depositor.address);
      const { 0: masterChefBalanceAfter } = await masterChef.userInfo(
        '12',
        aSLP_SUSHI_WETH.address
      );

      expect(masterChefBalanceAfter).to.be.eq(
        DEPOSIT_AMOUNT.add(DEPOSIT_AMOUNT_2).add(DEPOSIT_AMOUNT_3),
        'Deposit amount should be staked into Master Chef to receive $SUSHI'
      );
      expect(rewardATokenBalance).to.be.eq('0', 'xSUSHI rewards should be zero at contract');
      expect(depositorBalance).to.be.eq(
        priorDepositorBalance.sub(DEPOSIT_AMOUNT),
        'Depositor ERC20 balance should be correct after deposit'
      );
    });

    it('Depositor 1 Borrow 1 LP_SUSHI_WETH', async () => {
      const lendingPool = await getLendingPool();
      const borrowAmount = parseEther('1');

      // Pass time to generate rewards
      await increaseTime(ONE_DAY);
      const { 0: masterChefBalancePrior } = await masterChef.userInfo(
        '12',
        aSLP_SUSHI_WETH.address
      );
      const priorDepositorBalance = await IERC20Factory.connect(
        LP_SUSHI_WETH.address,
        depositor.signer
      ).balanceOf(depositor.address);

      // Borrow LP_SUSHI_WETH
      await waitForTx(
        await lendingPool
          .connect(depositor.signer)
          .borrow(LP_SUSHI_WETH.address, borrowAmount, RateMode.Variable, '0', depositor.address)
      );

      const rewardATokenBalance = await sushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      const depositorBalance = await IERC20Factory.connect(
        LP_SUSHI_WETH.address,
        depositor.signer
      ).balanceOf(depositor.address);
      const xSUSHIATokenBalance = await xSushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      const { 0: masterChefBalanceAfter } = await masterChef.userInfo(
        '12',
        aSLP_SUSHI_WETH.address
      );

      expect(rewardATokenBalance).to.be.eq('0', 'SUSHI rewards should be zero at contract');
      expect(xSUSHIATokenBalance).to.be.gt(
        '0',
        'xSUSHI should be gt 0 at contract due not claimed'
      );
      expect(depositorBalance).to.be.eq(
        priorDepositorBalance.add(borrowAmount),
        'Depositor ERC20 balance should be equal to prior balance + borrowed amount '
      );
      expect(masterChefBalanceAfter).to.be.eq(
        masterChefBalancePrior.sub(borrowAmount),
        'Staked tokens balance should subtract borrowed balance'
      );
    });

    it('Depositor 1 Repay 1 LP_SUSHI_WETH', async () => {
      const lendingPool = await getLendingPool();
      const priorDepositorBalance = await IERC20Factory.connect(
        LP_SUSHI_WETH.address,
        depositor.signer
      ).balanceOf(depositor.address);

      const { 0: masterChefBalancePrior } = await masterChef.userInfo(
        '12',
        aSLP_SUSHI_WETH.address
      );

      // Pass time to generate rewards
      await increaseTime(ONE_DAY);

      // Approve Repay
      await waitForTx(
        await IERC20Factory.connect(LP_SUSHI_WETH.address, depositor.signer).approve(
          lendingPool.address,
          MAX_UINT_AMOUNT
        )
      );
      // Repay
      await waitForTx(
        await lendingPool
          .connect(depositor.signer)
          .repay(LP_SUSHI_WETH.address, MAX_UINT_AMOUNT, RateMode.Variable, depositor.address)
      );

      const rewardATokenBalance = await sushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      const depositorBalance = await IERC20Factory.connect(
        LP_SUSHI_WETH.address,
        depositor.signer
      ).balanceOf(depositor.address);
      const xSUSHIATokenBalance = await xSushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      const { 0: masterChefBalanceAfter } = await masterChef.userInfo(
        '12',
        aSLP_SUSHI_WETH.address
      );

      expect(masterChefBalanceAfter).to.be.gt(
        masterChefBalancePrior,
        'Master chef balance should be greater after repayment'
      );
      expect(rewardATokenBalance).to.be.eq('0', 'SUSHI rewards should be zero at contract');
      expect(xSUSHIATokenBalance).to.be.gt(
        '0',
        'xSUSHI should be gt 0 at contract due not claimed'
      );
      expect(depositorBalance).to.be.lt(
        priorDepositorBalance,
        'Depositor ERC20 balance should be less than prior balance due repayment'
      );
    });
    it('Claim SUSHI', async () => {
      // Pass time to generate rewards
      await increaseTime(ONE_DAY);

      // Claim
      await claim(thirdDepositor, aSLP_SUSHI_WETH.address);
      await claim(secondDepositor, aSLP_SUSHI_WETH.address);
      await claim(depositor, aSLP_SUSHI_WETH.address);

      const rewardATokenBalance = await sushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      expect(rewardATokenBalance).to.be.eq('0', 'SUSHI rewards should be always zero at contract');
    });
    it('Depositor 1 Withdraw SUSHI-WETH', async () => {
      // Pass time to generate rewards
      await increaseTime(ONE_DAY);

      // Withdraw
      await withdraw(depositor, LP_SUSHI_WETH, aSLP_SUSHI_WETH.address, parseEther('10'));
      const rewardATokenBalance = await sushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      expect(rewardATokenBalance).to.be.eq('0', 'SUSHI rewards should be zero at contract');
    });

    it('All depositors claim the remaining SUSHI', async () => {
      // Pass time to generate rewards
      await increaseTime(ONE_DAY);

      // Claim
      await claim(thirdDepositor, aSLP_SUSHI_WETH.address);
      await claim(secondDepositor, aSLP_SUSHI_WETH.address);
      await claim(depositor, aSLP_SUSHI_WETH.address);

      const rewardATokenBalance = await sushiToken.balanceOf(aSLP_SUSHI_WETH.address);
      expect(rewardATokenBalance).to.be.eq('0', 'SUSHI rewards should be always zero at contract');
    });
  });
});
