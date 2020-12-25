import { task } from 'hardhat/config';
import {
  deployATokensAndRatesHelper,
  deployStableAndVariableTokensHelper,
  deployAaveProtocolDataProvider,
  deployLendingPoolAddressesProvider, //Test
} from '../../helpers/contracts-deployments';
import {
  deployUniswapLendingPoolAddressesProvider,
  deployUniswapLendingPool,
  deployUniswapLendingPoolConfigurator,
  deployUniswapPriceOracle,
  deployUniswapAaveOracle,
  deployUniswapLendingRateOracle,
  deployUniswapLendingPoolCollateralManager,
  deployUniswapMockFlashLoanReceiver,
  deployUniswapWETHGateway,
  deployUniswapWalletBalancerProvider,
} from '../../helpers/uniswap-contracts-deployments';
import { tEthereumAddress, 
  eContractid,
  AavePools,
  ICommonConfiguration,
  iAssetBase,
  TokenContractId,
  IMarketRates,
} from '../../helpers/types';
import { 
  getLendingPoolAddressesProviderRegistry,
  getLendingPoolAddressesProvider, //Test
  getLendingPool,
  getLendingPoolConfiguratorProxy,
  getAllMockedTokens,
  getPairsTokenAggregator,
} from '../../helpers/contracts-getters';
import { waitForTx, filterMapBy } from '../../helpers/misc-utils';
import { UniswapConfig } from '../../markets/uniswap';
import { insertContractAddressInDb } from '../../helpers/contracts-helpers';
import {
  setInitialAssetPricesInOracle,
  deployAllMockAggregators,
  setInitialMarketRatesInRatesOracleByHelper,
} from '../../helpers/oracles-helpers';
import {getAllAggregatorsAddresses, getAllTokenAddresses} from '../../helpers/mock-helpers';
import {
  ConfigNames,
  getReservesConfigByPool,
  getTreasuryAddress,
  loadPoolConfig,
  getWethAddress,
} from '../../helpers/configuration';
import {
  configureReservesByHelper,
  initReservesByHelper,
} from '../../helpers/init-helpers';
import { ZERO_ADDRESS } from '../../helpers/constants';


const pool = ConfigNames.Uniswap;
/**
 * @dev addressesProvider is actually created here, so we don't need to use getAddressesProvider
 */
task(
  'dev:deploy-uniswap-market',
  'Deploy uniswap market'
)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const admin = await (await localBRE.ethers.getSigners())[0].getAddress();

    const testProvider = await getLendingPoolAddressesProvider();
    console.log("Addresses provider from function (pre re-deploy):", testProvider.address);
    const addressesProvider = await deployLendingPoolAddressesProvider(UniswapConfig.MarketId, verify);
    console.log("Addresses provider in execution::", addressesProvider.address)

    const testProviderPost = await getLendingPoolAddressesProvider();
    console.log("Addresses provider from function (pre re-deploy):", testProviderPost.address);
    console.log("Addresses provider from function (post re-deploy) should be different:")
    await waitForTx(await addressesProvider.setPoolAdmin(admin));
    
    
    const addressesProviderRegistry = await getLendingPoolAddressesProviderRegistry();
    await waitForTx(
      await addressesProviderRegistry.registerAddressesProvider(addressesProvider.address, 1)
    );
    console.log(addressesProvider.address);


    /**
     * LENDING POOL DEPLOYMENT
     */
    const lendingPoolImpl = await deployUniswapLendingPool(verify);

    await waitForTx(await addressesProvider.setLendingPoolImpl(lendingPoolImpl.address));

    const address = await addressesProvider.getLendingPool();
    console.log("UNISWAP MARKET LENDING POOL:", address);
    const lendingPoolProxy = await getLendingPool(address);
    await insertContractAddressInDb(eContractid.UniswapLendingPool, lendingPoolProxy.address);

    const lendingPoolConfiguratorImpl = await deployUniswapLendingPoolConfigurator(verify);

    // Set lending pool conf impl to Address Provider
    await waitForTx(
      await addressesProvider.setLendingPoolConfiguratorImpl(lendingPoolConfiguratorImpl.address)
    );

    const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy(
      await addressesProvider.getLendingPoolConfigurator()
    );

    await insertContractAddressInDb(
      eContractid.UniswapLendingPoolConfigurator,
      lendingPoolConfiguratorProxy.address
    );

    // Deploy deployment helpers
    await deployStableAndVariableTokensHelper(
      [lendingPoolProxy.address, addressesProvider.address],
      verify
    );
    await deployATokensAndRatesHelper(
      [lendingPoolProxy.address, addressesProvider.address, lendingPoolConfiguratorProxy.address],
      verify
    );

    /**
     * @dev Oracle deployment section
     */

    console.log("Uniswap oracle deployment beginning.")
    const poolConfig = loadPoolConfig(pool);
    console.log("Initialized pool config...");

    const {
      Mocks: {AllAssetsInitialPrices},
      ProtocolGlobalParams: {UsdAddress, MockUsdPriceInWei},
      LendingRateOracleRatesCommon,
    } = poolConfig as ICommonConfiguration;
    console.log("Initialized mocks, global params and lending rate oracle rates");

    const defaultTokenList = {
      ...Object.fromEntries(Object.keys(TokenContractId).map((symbol) => [symbol, ''])),
      USD: UsdAddress,
    } as iAssetBase<string>;
    
    console.log("Initialized defaultTokenList");

    const mockTokens = await getAllMockedTokens();

    console.log("Initialized mock tokens");

    const mockTokensAddress = Object.keys(mockTokens).reduce<iAssetBase<string>>((prev, curr) => {
      prev[curr as keyof iAssetBase<string>] = mockTokens[curr].address;
      return prev;
    }, defaultTokenList);
    console.log(mockTokensAddress);
    console.log("Initialized mock tokens addresses");

    // No need to re-initialize addressesProvider and admin

    const fallbackOracle = await deployUniswapPriceOracle(verify);
    console.log("Deployed fallback price oracle");

    await waitForTx(await fallbackOracle.setEthUsdPrice(MockUsdPriceInWei));
    console.log("set fallback ETH USD price");

    await setInitialAssetPricesInOracle(AllAssetsInitialPrices, mockTokensAddress, fallbackOracle);
    console.log("Set initial asset prices in oracle");

    const mockAggregators = await deployAllMockAggregators(AllAssetsInitialPrices, verify);
    console.log("Deployed mock aggregators");

    const allTokenAddresses = getAllTokenAddresses(mockTokens);
    console.log("Got all mock token addresses");

    const allAggregatorsAddresses = getAllAggregatorsAddresses(mockAggregators);
    console.log("Got all aggregator addresses");
    console.log("allTokenAddresses object: \n", allTokenAddresses);
    //Should modify this to potentially contain only the tokens in the Uniswap market
    // const [tokens, aggregators] = getPairsTokenAggregator(
    //   allTokenAddresses,
    //   allAggregatorsAddresses
    // );
    // console.log("Got \"pairsToken aggregator\"");
    // console.log("Tokens: \n", tokens);
    
    // const assetAddressIndex = Object.keys(allReservesAddresses).findIndex(
    //   (value) => value === assetSymbol
    // );
    // const [, assetAddress] = (Object.entries(assetsAddresses) as [string, string][])[
    //   assetAddressIndex
    // ];
    // assetAddresses.push(assetAddress);

    // await deployUniswapAaveOracle(
    //   [tokens, aggregators, fallbackOracle.address, await getWethAddress(poolConfig)],
    //   verify
    // );
    console.log("Deployed Uniswap Aave oracle");

    await waitForTx(await addressesProvider.setPriceOracle(fallbackOracle.address));
    console.log("Set price oracle in addresses provider");

    const lendingRateOracle = await deployUniswapLendingRateOracle(verify);
    console.log("Deployed lendingRateOracle");

    await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));
    console.log("Set lending rate oracle in addresses provider");

    const {USD, ...tokensAddressesWithoutUsd} = allTokenAddresses;
    console.log("Initialized object with token addresses & usd")

    const allReservesAddresses = {
      ...tokensAddressesWithoutUsd,
    };
    console.log("Initialized object with all reserve addresses, allReservesAddresses:");
    console.log(allReservesAddresses);

    console.log("LendingRateOracleRatesCommon: \n", LendingRateOracleRatesCommon);
    //
    // -- test
    //
    const [tokens, aggregators] = getPairsTokenAggregator(
      allTokenAddresses,
      allAggregatorsAddresses
    );
    console.log("Got \"pairsToken aggregator\"");
    console.log("Tokens: \n", tokens);
    const assetAddresses: string[] = [];
    const aggregatorAddresses: string[] = [];
    for (const [assetSymbol, {borrowRate}] of Object.entries(LendingRateOracleRatesCommon) as [
      string,
      IMarketRates
    ][]) {
      const assetAddressIndex = Object.keys(allReservesAddresses).findIndex(
        (value) => value === assetSymbol
      );
      const [, assetAddress] = (Object.entries(allReservesAddresses) as [string, string][])[
        assetAddressIndex
      ];

      const [, aggregatorAddress] = (Object.entries(allAggregatorsAddresses) as [string, string][])[
        assetAddressIndex
      ];
      aggregatorAddresses.push(aggregatorAddress);
      assetAddresses.push(assetAddress);
    }
    console.log("\nPRICE ORACLE PARAMS:\nassetAddresses: %s\naggregatorAddresses: %s", assetAddresses, aggregatorAddresses);
    await deployUniswapAaveOracle(
      [assetAddresses, aggregatorAddresses, fallbackOracle.address, await getWethAddress(poolConfig)],
      verify
    );
    //
    // -- test end
    //
    console.log("TEST END-----------------------------------------------------------------------");
    await setInitialMarketRatesInRatesOracleByHelper(
      LendingRateOracleRatesCommon,
      allReservesAddresses,
      lendingRateOracle,
      admin
    );

    console.log("Task complete");

    /**
     * @dev Initialization 
     */

    // No need to initialize poolConfig, mockTokens, allTokenAddresses, admin and
    // addressesProvider and protoReservesAddresses (we use allReserveAddresses)
    
    const testHelpers = await deployAaveProtocolDataProvider(addressesProvider.address, verify);

    const reservesParams = getReservesConfigByPool(AavePools.uniswap);

    const treasuryAddress = await getTreasuryAddress(poolConfig);

    await initReservesByHelper(
      addressesProvider,
      reservesParams,
      allReservesAddresses,
      admin,
      treasuryAddress,
      ZERO_ADDRESS,
      verify
    );

    await configureReservesByHelper(
      addressesProvider,
      reservesParams,
      allReservesAddresses,
      testHelpers,
      admin
    );

    const collateralManager = await deployUniswapLendingPoolCollateralManager(verify);
    await waitForTx(
      await addressesProvider.setLendingPoolCollateralManager(collateralManager.address)
    );
    
    const mockFlashLoanReceiver = await deployUniswapMockFlashLoanReceiver(
      addressesProvider.address,
      verify
    );

    await insertContractAddressInDb(
      eContractid.UniswapMockFlashLoanReceiver,
      mockFlashLoanReceiver.address
    );

    await deployUniswapWalletBalancerProvider(verify);

    await insertContractAddressInDb(eContractid.AaveProtocolDataProvider, testHelpers.address);

    const lendingPoolAddress = await addressesProvider.getLendingPool();
    const wethAddress = await getWethAddress(poolConfig);
    await deployUniswapWETHGateway([wethAddress, lendingPoolAddress]);
  });
