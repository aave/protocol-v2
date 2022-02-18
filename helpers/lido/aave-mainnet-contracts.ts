import { Signer } from 'ethers';
import {
  AaveProtocolDataProvider,
  AaveProtocolDataProviderFactory,
  LendingPool,
  LendingPoolAddressesProviderFactory,
  LendingPoolConfigurator,
  LendingPoolConfiguratorFactory,
  LendingPoolFactory,
  AaveOracle,
  AaveOracleFactory,
} from '../../types';

export const Addresses = {
  Owner: '0xEE56e2B3D491590B5b31738cC34d5232F378a8D5',
  LendingPoolConfigurator: '0x311Bb771e4F8952E6Da169b425E7e92d6Ac45756',
  LendingPoolAddressesProvider: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
  Treasury: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
  PriceOracle: '0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',
  ProtocolDataProvider: '0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d',
};

export class AaveContracts {
  constructor(
    public readonly lendingPool: LendingPool,
    public readonly lendingPoolConfigurator: LendingPoolConfigurator,
    public readonly priceOracle: AaveOracle,
    public readonly protocolDataProvider: AaveProtocolDataProvider
  ) {}

  static async connect(signer: Signer) {
    const [
      lendingPoolConfigurator,
      lendingPoolAddressesProvider,
      priceOracle,
      protocolDataProvider,
    ] = await Promise.all([
      LendingPoolConfiguratorFactory.connect(Addresses.LendingPoolConfigurator, signer),
      LendingPoolAddressesProviderFactory.connect(Addresses.LendingPoolAddressesProvider, signer),
      AaveOracleFactory.connect(Addresses.PriceOracle, signer),
      AaveProtocolDataProviderFactory.connect(Addresses.ProtocolDataProvider, signer),
    ]);
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool();
    const lendingPool = await LendingPoolFactory.connect(lendingPoolAddress, signer);
    return new AaveContracts(
      lendingPool,
      lendingPoolConfigurator,
      priceOracle,
      protocolDataProvider
    );
  }
}
