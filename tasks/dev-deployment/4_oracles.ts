import {task} from '@nomiclabs/buidler/config';
import {
  getLendingPoolAddressesProvider,
  deployPriceOracle,
  getMockedTokens,
  getPairsTokenAggregator,
  deployChainlinkProxyPriceProvider,
  deployLendingRateOracle,
} from '../../helpers/contracts-helpers';
import {
  MOCK_USD_PRICE_IN_WEI,
  ALL_ASSETS_INITIAL_PRICES,
  USD_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  LENDING_RATE_ORACLE_RATES_COMMON,
} from '../../helpers/constants';
import {
  setInitialAssetPricesInOracle,
  deployAllMockAggregators,
  setInitialMarketRatesInRatesOracle,
} from '../../helpers/oracles-helpers';
import {tEthereumAddress} from '../../helpers/types';
import {waitForTx} from '../../helpers/misc-utils';

task('deploy-oracles', 'Deploy oracles for dev enviroment')
  .addOptionalParam('verify', 'Verify contracts at Etherscan')
  .setAction(async ({verify}, localBRE) => {
    await localBRE.run('set-bre');

    const mockTokens = await getMockedTokens();

    const addressesProvider = await getLendingPoolAddressesProvider();

    const fallbackOracle = await deployPriceOracle(verify);
    await waitForTx(await fallbackOracle.setEthUsdPrice(MOCK_USD_PRICE_IN_WEI));
    await setInitialAssetPricesInOracle(
      ALL_ASSETS_INITIAL_PRICES,
      {
        WETH: mockTokens.WETH.address,
        DAI: mockTokens.DAI.address,
        TUSD: mockTokens.TUSD.address,
        USDC: mockTokens.USDC.address,
        USDT: mockTokens.USDT.address,
        SUSD: mockTokens.SUSD.address,
        LEND: mockTokens.LEND.address,
        BAT: mockTokens.BAT.address,
        REP: mockTokens.REP.address,
        MKR: mockTokens.MKR.address,
        LINK: mockTokens.LINK.address,
        KNC: mockTokens.KNC.address,
        WBTC: mockTokens.WBTC.address,
        MANA: mockTokens.MANA.address,
        ZRX: mockTokens.ZRX.address,
        SNX: mockTokens.SNX.address,
        BUSD: mockTokens.BUSD.address,
        USD: USD_ADDRESS,
        UNI_DAI_ETH: mockTokens.UNI_DAI_ETH.address,
        UNI_USDC_ETH: mockTokens.UNI_USDC_ETH.address,
        UNI_SETH_ETH: mockTokens.UNI_SETH_ETH.address,
        UNI_LEND_ETH: mockTokens.UNI_LEND_ETH.address,
        UNI_MKR_ETH: mockTokens.UNI_MKR_ETH.address,
        UNI_LINK_ETH: mockTokens.UNI_LINK_ETH.address,
      },
      fallbackOracle
    );

    // TODO: Missing verify
    const mockAggregators = await deployAllMockAggregators(MOCK_CHAINLINK_AGGREGATORS_PRICES);

    const allTokenAddresses = Object.entries(mockTokens).reduce(
      (accum: {[tokenSymbol: string]: tEthereumAddress}, [tokenSymbol, tokenContract]) => ({
        ...accum,
        [tokenSymbol]: tokenContract.address,
      }),
      {}
    );
    const allAggregatorsAddresses = Object.entries(mockAggregators).reduce(
      (accum: {[tokenSymbol: string]: tEthereumAddress}, [tokenSymbol, aggregator]) => ({
        ...accum,
        [tokenSymbol]: aggregator.address,
      }),
      {}
    );

    const [tokens, aggregators] = getPairsTokenAggregator(
      allTokenAddresses,
      allAggregatorsAddresses
    );

    // TODO: Missing verify and getter
    const chainlinkProxyPriceProvider = await deployChainlinkProxyPriceProvider([
      tokens,
      aggregators,
      fallbackOracle.address,
    ]);
    await waitForTx(await addressesProvider.setPriceOracle(fallbackOracle.address));

    // TODO: Missing verify
    const lendingRateOracle = await deployLendingRateOracle();
    await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));

    const {USD, ...tokensAddressesWithoutUsd} = allTokenAddresses;
    const allReservesAddresses = {
      ...tokensAddressesWithoutUsd,
    };
    await setInitialMarketRatesInRatesOracle(
      LENDING_RATE_ORACLE_RATES_COMMON,
      allReservesAddresses,
      lendingRateOracle
    );
  });
