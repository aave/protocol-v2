import rawBRE from 'hardhat';
import { MockContract } from 'ethereum-waffle';
import {
  insertContractAddressInDb,
  getEthersSigners,
  registerContractInJsonDb,
  getEthersSignersAddresses,
  rawInsertContractAddressInDb,
  getParamPerNetwork,
} from '../../helpers/contracts-helpers';
import {
  deployLendingPoolAddressesProvider,
  deployMintableERC20,
  deployLendingPoolAddressesProviderRegistry,
  deployLendingPoolConfigurator,
  deployLendingPool,
  deployPriceOracle,
  deploySturdyOracle,
  deployLendingPoolCollateralManager,
  deploySturdyProtocolDataProvider,
  deployLendingRateOracle,
  deployStableAndVariableTokensHelper,
  deployATokensAndRatesHelper,
  deployWETHMocked,
  deploySturdyIncentivesController,
  deploySturdyToken,
  deployYearnVault,
  // deployBeefyETHVault,
  deployTombMiMaticBeefyVaultImpl,
  deployDefaultReserveInterestRateStrategy,
  deployTombMiMaticLPOracle,
} from '../../helpers/contracts-deployments';
import { Signer } from 'ethers';
import { TokenContractId, eContractid, tEthereumAddress, SturdyPools, eNetwork, IFantomConfiguration } from '../../helpers/types';
import { MintableERC20 } from '../../types/MintableERC20';
import {
  ConfigNames,
  getReservesConfigByPool,
  getTreasuryAddress,
  loadPoolConfig,
} from '../../helpers/configuration';
import { initializeMakeSuite } from './helpers/make-suite';

import {
  setInitialAssetPricesInOracle,
  deployAllMockAggregators,
  setInitialMarketRatesInRatesOracleByHelper,
} from '../../helpers/oracles-helpers';
import { DRE, impersonateAccountsHardhat, waitForTx } from '../../helpers/misc-utils';
import { initReservesByHelper, configureReservesByHelper, getReserveConfigs } from '../../helpers/init-helpers';
import FantomConfig from '../../markets/ftm';
import { oneEther, ZERO_ADDRESS } from '../../helpers/constants';
import {
  getATokensAndRatesHelper,
  getDeployVaultHelper,
  getFirstSigner,
  // getBeefyVault,
  getLendingPool,
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
  getPairsTokenAggregator,
  getSturdyOracle,
  getYearnVault,
  getYearnWETHVault,
} from '../../helpers/contracts-getters';
import { WETH9Mocked } from '../../types/WETH9Mocked';

const MOCK_USD_PRICE_IN_WEI = FantomConfig.ProtocolGlobalParams.MockUsdPriceInWei;
const ALL_ASSETS_INITIAL_PRICES = FantomConfig.Mocks.AllAssetsInitialPrices;
const USD_ADDRESS = FantomConfig.ProtocolGlobalParams.UsdAddress;
const MOCK_CHAINLINK_AGGREGATORS_PRICES = FantomConfig.Mocks.AllAssetsInitialPrices;
const LENDING_RATE_ORACLE_RATES_COMMON = FantomConfig.LendingRateOracleRatesCommon;

const deployAllMockTokens = async (deployer: Signer) => {
  const tokens: { [symbol: string]: MockContract | MintableERC20 | WETH9Mocked } = {};

  const protoConfigData = getReservesConfigByPool(SturdyPools.proto);

  for (const tokenSymbol of Object.keys(TokenContractId)) {
    console.log(tokenSymbol);
    if (tokenSymbol === 'WETH') {
      tokens[tokenSymbol] = await deployWETHMocked();
      await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
      continue;
    }
    let decimals = 18;

    let configData = (<any>protoConfigData)[tokenSymbol];
    if (!configData) {
      decimals = 18;
    }

    tokens[tokenSymbol] = await deployMintableERC20([
      tokenSymbol,
      tokenSymbol,
      configData ? configData.reserveDecimals : 18,
    ]);
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
  }

  return tokens;
};

const buildTestEnv = async (deployer: Signer, secondaryWallet: Signer) => {
  console.time('setup');
  const sturdyAdmin = await deployer.getAddress();
  const mockTokens = await deployAllMockTokens(deployer);
  console.log('Deployed mocks');
  const addressesProvider = await deployLendingPoolAddressesProvider(FantomConfig.MarketId);
  await waitForTx(await addressesProvider.setPoolAdmin(sturdyAdmin));

  //setting users[1] as emergency admin, which is in position 2 in the DRE addresses list
  const addressList = await getEthersSignersAddresses();

  await waitForTx(await addressesProvider.setEmergencyAdmin(addressList[2]));

  const addressesProviderRegistry = await deployLendingPoolAddressesProviderRegistry();
  await waitForTx(
    await addressesProviderRegistry.registerAddressesProvider(addressesProvider.address, 1)
  );

  const lendingPoolImpl = await deployLendingPool();

  await waitForTx(await addressesProvider.setLendingPoolImpl(lendingPoolImpl.address));

  const lendingPoolAddress = await addressesProvider.getLendingPool();
  const lendingPoolProxy = await getLendingPool(lendingPoolAddress);

  await insertContractAddressInDb(eContractid.LendingPool, lendingPoolProxy.address);

  const lendingPoolConfiguratorImpl = await deployLendingPoolConfigurator();
  await waitForTx(
    await addressesProvider.setLendingPoolConfiguratorImpl(lendingPoolConfiguratorImpl.address)
  );
  const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy(
    await addressesProvider.getLendingPoolConfigurator()
  );
  await insertContractAddressInDb(
    eContractid.LendingPoolConfigurator,
    lendingPoolConfiguratorProxy.address
  );

  // Deploy deployment helpers
  await deployStableAndVariableTokensHelper([]);
  await deployATokensAndRatesHelper([
    lendingPoolConfiguratorProxy.address,
  ]);

  const fallbackOracle = await deployPriceOracle();
  await waitForTx(await fallbackOracle.setEthUsdPrice(MOCK_USD_PRICE_IN_WEI));
  await setInitialAssetPricesInOracle(
    ALL_ASSETS_INITIAL_PRICES,
    {
      WETH: mockTokens.WETH.address,
      DAI: mockTokens.DAI.address,
      USDC: mockTokens.USDC.address,
      fUSDT: mockTokens.fUSDT.address,
      USD: USD_ADDRESS,
      stETH: mockTokens.stETH.address,
      yvWFTM: mockTokens.yvWFTM.address,
      mooWETH: mockTokens.mooWETH.address,
      yvWETH: mockTokens.yvWETH.address,
      yvWBTC: mockTokens.yvWBTC.address,
      yvBOO: mockTokens.yvBOO.address,
      mooTOMB_FTM: mockTokens.mooTOMB_FTM.address,
      mooTOMB_MIMATIC: mockTokens.mooTOMB_MIMATIC.address,
      mooBASED_MIMATIC: mockTokens.mooBASED_MIMATIC.address,
      yvfBEETS: mockTokens.yvfBEETS.address,
      yvLINK: mockTokens.yvLINK.address,
    },
    fallbackOracle
  );

  const mockAggregators = await deployAllMockAggregators(MOCK_CHAINLINK_AGGREGATORS_PRICES);
  console.log('Mock aggs deployed');
  const allTokenAddresses = Object.entries(mockTokens).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, tokenContract]) => ({
      ...accum,
      [tokenSymbol]: tokenContract.address,
    }),
    {}
  );
  const allAggregatorsAddresses = Object.entries(mockAggregators).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, aggregator]) => ({
      ...accum,
      [tokenSymbol]: aggregator.address,
    }),
    {}
  );

  const [tokens, aggregators] = getPairsTokenAggregator(allTokenAddresses, allAggregatorsAddresses, FantomConfig.OracleQuoteCurrency);

  await deploySturdyOracle([tokens, aggregators, fallbackOracle.address, mockTokens.WETH.address, oneEther.toString()]);
  await waitForTx(await addressesProvider.setPriceOracle(fallbackOracle.address));

  const lendingRateOracle = await deployLendingRateOracle();
  await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));

  const { USD, ...tokensAddressesWithoutUsd } = allTokenAddresses;
  const allReservesAddresses = {
    ...tokensAddressesWithoutUsd,
  };
  await setInitialMarketRatesInRatesOracleByHelper(
    LENDING_RATE_ORACLE_RATES_COMMON,
    allReservesAddresses,
    lendingRateOracle,
    sturdyAdmin
  );

  const reservesParams = getReservesConfigByPool(SturdyPools.proto);

  const testHelpers = await deploySturdyProtocolDataProvider(addressesProvider.address);

  await insertContractAddressInDb(eContractid.SturdyProtocolDataProvider, testHelpers.address);
  const admin = await deployer.getAddress();

  console.log('Incentive controller and token');

  const EMISSION_EXECUTOR = await deployer.getAddress();
  const incentives = await deploySturdyIncentivesController([EMISSION_EXECUTOR]);
  console.log(`- Incentives proxy address ${incentives.address}`);

  const sturdyToken = await deploySturdyToken();
  console.log(`- Incentives sturdy token proxy address ${sturdyToken.address}`);

  console.log('Initialize configuration');

  const config = loadPoolConfig(ConfigNames.Sturdy);

  const { ATokenNamePrefix, StableDebtTokenNamePrefix, VariableDebtTokenNamePrefix, SymbolPrefix } =
    config;
  const treasuryAddress = await getTreasuryAddress(config);

  await initReservesByHelper(
    reservesParams,
    allReservesAddresses,
    ATokenNamePrefix,
    StableDebtTokenNamePrefix,
    VariableDebtTokenNamePrefix,
    SymbolPrefix,
    admin,
    treasuryAddress,
    {
      yvWFTM: (await getYearnVault()).address,
      yvWETH: (await getYearnWETHVault()).address,
      // mooWETH: (await getBeefyVault()).address,
    },
    false
  );

  await configureReservesByHelper(reservesParams, allReservesAddresses, testHelpers, admin);

  const collateralManager = await deployLendingPoolCollateralManager();
  await waitForTx(
    await addressesProvider.setLendingPoolCollateralManager(collateralManager.address)
  );

  // console.log('Yearn Vault');
  // const yearnVault = await deployYearnVault();
  // const configurator = await getLendingPoolConfiguratorProxy();
  // await configurator.registerVault(yearnVault.address);
  // console.log('Yearn Vault', yearnVault.address);
  // console.log(`\tFinished Yearn Vault deployment`);

  // console.log('Beefy Vault');
  // const beefyVault = await deployBeefyETHVault();
  // await configurator.registerVault(beefyVault.address);
  // console.log('Beefy Vault', beefyVault.address);
  // console.log(`\tFinished Beefy Vault deployment`);

  console.timeEnd('setup');
};

const deployNewVault = async () => {
  const vaultHelper = await getDeployVaultHelper();
  const sender = await getFirstSigner();
  const addressProvider = await getLendingPoolAddressesProvider();
  const aTokenHelper = await getATokensAndRatesHelper();
  const poolConfig = loadPoolConfig(ConfigNames.Fantom) as IFantomConfiguration;
  const network = process.env.FORK || DRE.network.name;
  const {
    ReserveAssets,
    ChainlinkAggregator
  } = poolConfig;
  const deployerAddress = '0x48Cc0719E3bF9561D861CB98E863fdA0CEB07Dbc';
  const ethers = (DRE as any).ethers;
  await impersonateAccountsHardhat([deployerAddress]);
  let signer = await ethers.provider.getSigner(deployerAddress);

  const reserveConfigs = getReserveConfigs(ConfigNames.Fantom);
  const strategyParams = reserveConfigs['strategy' + 'mooTOMB_MIMATIC'.toUpperCase()];
  const rates = await deployDefaultReserveInterestRateStrategy(
    [
      addressProvider.address,
      strategyParams.strategy.optimalUtilizationRate,
      strategyParams.strategy.baseVariableBorrowRate,
      strategyParams.strategy.variableRateSlope1,
      strategyParams.strategy.variableRateSlope2,
      strategyParams.strategy.stableRateSlope1,
      strategyParams.strategy.stableRateSlope2,
    ],
    false
  );
  rawInsertContractAddressInDb(strategyParams.strategy.name, rates.address);

  const mooTombMiMaticOracle = await deployTombMiMaticLPOracle();
  let mooTombMiMaticOracleAddress = mooTombMiMaticOracle.address;
  const sturdyOracle = await getSturdyOracle();
  await waitForTx(
    await sturdyOracle.connect(signer).setAssetSources(
      [
        getParamPerNetwork(poolConfig.MIMATIC, <eNetwork>network),
        getParamPerNetwork(ReserveAssets, <eNetwork>network).mooTOMB_MIMATIC,
      ],
      [
        getParamPerNetwork(ChainlinkAggregator, <eNetwork>network).MIMATIC,
        mooTombMiMaticOracleAddress
      ]
    )
  );

  // 1. Deploy new vault implementation
  const tombMiMaticVaultImpl = await deployTombMiMaticBeefyVaultImpl();
  
  // 2. Get the params to deploy new vault
  // The following params are generated by running this command but only for forked mainnet, when deploy mainnet, need to change command including network
  // FORK=ftm yarn hardhat external:get-param-for-new-vault --pool Fantom --symbol mooTOMB_MIMATIC --network localhost
  const _ids = [
    '0x42454546595f544f4d425f4d494d415449435f5641554c540000000000000000',   // 'BEEFY_TOMB_MIMATIC_VAULT'
    '0x6d6f6f546f6d62544f4d422d4d494d4154494300000000000000000000000000',   // 'mooTombTOMB-MIMATIC'
    '0x544f4d425f4d494d415449435f4c500000000000000000000000000000000000',   // 'TOMB_MIMATIC_LP'
    '0x4d494d4154494300000000000000000000000000000000000000000000000000',   // 'MIMATIC'
    '0x5553444300000000000000000000000000000000000000000000000000000000',   // 'USDC'
    '0x746f6d6253776170526f75746572000000000000000000000000000000000000'    // 'tombSwapRouter'
  ];
  const _addresses = [
    tombMiMaticVaultImpl.address,     // vault implement address (BEEFY_TOMB_MIMATIC_VAULT)
    '0xb2be5Cd33DBFf412Bce9587E44b5647a4BdA6a66',     // internal asset address (mooTombTOMB-MIMATIC)
    '0x45f4682B560d4e3B8FF1F1b3A38FDBe775C7177b',     // exterenal asset address (TOMB_MIMATIC_LP)
    '0xfB98B335551a418cD0737375a2ea0ded62Ea213b',     // MIMATIC address
    '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',     // USDC address
    '0x6D0176C5ea1e44b08D3dd001b0784cE42F47a3A7'      // TombSwapRouter address
  ];
  const _treasuryAddress = '0xFd1D36995d76c0F75bbe4637C84C06E4A68bBB3a';
  const _treasuryFee = 1000;
  const _aTokenHelper = aTokenHelper.address;
  const _inputParams =  [
    {
      asset: '0xb2be5Cd33DBFf412Bce9587E44b5647a4BdA6a66',
      baseLTV: '0',
      liquidationThreshold: '7500',
      liquidationBonus: '10750',
      reserveFactor: '0',
      stableBorrowingEnabled: false,
      borrowingEnabled: false,
      collateralEnabled: true
    }
  ];
  const _input = [
    {
      aTokenImpl: '0x9787bDC2Ff7F39Ff981ecc347DfAcF6D57b8783E',
      stableDebtTokenImpl: '0x56045D514799074E474ee0AC9508162202f62d32',
      variableDebtTokenImpl: '0x95455A00338E046D6b1D180b46d8Bf3597258206',
      underlyingAssetDecimals: '18',
      interestRateStrategyAddress: rates.address,
      yieldAddress: '0x0000000000000000000000000000000000000000',
      underlyingAsset: '0xb2be5Cd33DBFf412Bce9587E44b5647a4BdA6a66',
      treasury: '0xFd1D36995d76c0F75bbe4637C84C06E4A68bBB3a',
      incentivesController: '0xcdA2B5Cd654be0DBA19E4064c583642741712560',
      underlyingAssetName: 'mooTOMB_MIMATIC',
      aTokenName: 'Sturdy interest bearing mooTOMB_MIMATIC',
      aTokenSymbol: 'smooTOMB_MIMATIC',
      variableDebtTokenName: 'Sturdy variable debt bearing mooTOMB_MIMATIC',
      variableDebtTokenSymbol: 'variableDebtmooTOMB_MIMATIC',
      stableDebtTokenName: 'Sturdy stable debt bearing mooTOMB_MIMATIC',
      stableDebtTokenSymbol: 'stableDebtmooTOMB_MIMATIC',
      params: '0x10'
    }
  ];

  // 3. transfer owner to vaule helper contract for deploying new vault
  // on the mainnet, it should be done via multisig wallet + timelock contract.
  await waitForTx(await addressProvider.connect(signer).transferOwnership(vaultHelper.address));
  await waitForTx(await aTokenHelper.connect(signer).transferOwnership(vaultHelper.address));


  // 4. Run deployVault using the above param
  // on the mainnet, it should be done via multisig wallet + timelock contract.
  await waitForTx(
    await vaultHelper.deployVault(
      _ids, 
      _addresses, 
      _treasuryAddress, 
      _treasuryFee, 
      _aTokenHelper, 
      _inputParams, 
      _input
    )
  );
  console.log(await sender.getAddress());
  console.log(await addressProvider.owner());
  console.log(await aTokenHelper.owner());

  // 5. saving the newly created contract address
  const newVaultProxyAddress = await addressProvider.getAddress(
    _ids[0]
  );
  await insertContractAddressInDb(eContractid.TombMiMaticBeefyVault, newVaultProxyAddress);
}

before(async () => {
  await rawBRE.run('set-DRE');
  const [deployer, secondaryWallet] = await getEthersSigners();
  const FORK = process.env.FORK;
  const SKIP_DEPLOY = process.env.SKIP_DEPLOY;

  if (!SKIP_DEPLOY) {
    if (FORK) {
      await rawBRE.run('sturdy:ftm');
    } else {
      console.log('-> Deploying test environment...');
      await buildTestEnv(deployer, secondaryWallet);
    }
  }

  if (process.env.DEPLOY_NEW_VAULT) {
    await rawBRE.run('full:deploy-vault-helper', {pool: "Fantom"});
    await deployNewVault();
  }

  await initializeMakeSuite();
  console.log('\n***************');
  console.log('Setup and snapshot finished');
  console.log('***************\n');
});
