import {
  tEthereumAddress,
  iMultiPoolsAssets,
  IMarketRates,
  iAssetBase,
  iAssetAggregatorBase,
  eContractid,
  SymbolMap,
} from './types';

import {LendingRateOracle} from '../types/LendingRateOracle';
import {PriceOracle} from '../types/PriceOracle';
import {MockAggregator} from '../types/MockAggregator';
import {deployMockAggregator} from './contracts-deployments';
import {waitForTx} from './misc-utils';

export const setInitialMarketRatesInRatesOracle = async (
  marketRates: iMultiPoolsAssets<IMarketRates>,
  assetsAddresses: {[x: string]: tEthereumAddress},
  lendingRateOracleInstance: LendingRateOracle
) => {
  for (const [assetSymbol, {borrowRate}] of Object.entries(marketRates) as [
    string,
    IMarketRates
  ][]) {
    const assetAddressIndex = Object.keys(assetsAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, assetAddress] = (Object.entries(assetsAddresses) as [string, string][])[
      assetAddressIndex
    ];
    await waitForTx(await lendingRateOracleInstance.setMarketBorrowRate(assetAddress, borrowRate));
    console.log('added Market Borrow Rate for: ', assetSymbol);
  }
};

export const setInitialAssetPricesInOracle = async (
  prices: iAssetBase<tEthereumAddress>,
  assetsAddresses: iAssetBase<tEthereumAddress>,
  priceOracleInstance: PriceOracle
) => {
  for (const [assetSymbol, price] of Object.entries(prices) as [string, string][]) {
    const assetAddressIndex = Object.keys(assetsAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, assetAddress] = (Object.entries(assetsAddresses) as [string, string][])[
      assetAddressIndex
    ];
    await waitForTx(await priceOracleInstance.setAssetPrice(assetAddress, price));
  }
};

export const setAssetPricesInOracle = async (
  prices: SymbolMap<string>,
  assetsAddresses: SymbolMap<tEthereumAddress>,
  priceOracleInstance: PriceOracle
) => {
  for (const [assetSymbol, price] of Object.entries(prices) as [string, string][]) {
    const assetAddressIndex = Object.keys(assetsAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, assetAddress] = (Object.entries(assetsAddresses) as [string, string][])[
      assetAddressIndex
    ];
    await waitForTx(await priceOracleInstance.setAssetPrice(assetAddress, price));
  }
};

export const deployMockAggregators = async (initialPrices: SymbolMap<string>, verify?: boolean) => {
  const aggregators: {[tokenSymbol: string]: MockAggregator} = {};
  for (const tokenContractName of Object.keys(initialPrices)) {
    if (tokenContractName !== 'ETH') {
      const priceIndex = Object.keys(initialPrices).findIndex(
        (value) => value === tokenContractName
      );
      const [, price] = (Object.entries(initialPrices) as [string, string][])[priceIndex];
      aggregators[tokenContractName] = await deployMockAggregator(price, verify);
    }
  }
  return aggregators;
};

export const deployAllMockAggregators = async (
  initialPrices: iAssetAggregatorBase<string>,
  verify?: boolean
) => {
  const aggregators: {[tokenSymbol: string]: MockAggregator} = {};
  for (const tokenContractName of Object.keys(initialPrices)) {
    if (tokenContractName !== 'ETH') {
      const priceIndex = Object.keys(initialPrices).findIndex(
        (value) => value === tokenContractName
      );
      const [, price] = (Object.entries(initialPrices) as [string, string][])[priceIndex];
      aggregators[tokenContractName] = await deployMockAggregator(price, verify);
    }
  }
  return aggregators;
};
