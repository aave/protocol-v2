import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import {
  deployLendingPoolCollateralManager,
  deployWalletBalancerProvider,
  deployAaveProtocolDataProvider,
  deployWETHGateway,
} from '../../helpers/contracts-deployments';
import { loadPoolConfig, ConfigNames, getWethAddress, getTreasuryAddress } from '../../helpers/configuration';
import { eEthereumNetwork, ICommonConfiguration } from '../../helpers/types';
import { waitForTx } from '../../helpers/misc-utils';
import {
  initReservesByHelper,
  configureReservesByHelper,
} from '../../helpers/init-helpers';
import { exit } from 'process';
import {
  getAaveProtocolDataProvider,
  getLendingPoolAddressesProvider,
} from '../../helpers/contracts-getters';
import { ZERO_ADDRESS } from '../../helpers/constants';

task('full:initialize-lending-pool', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    try {
      await localBRE.run('set-DRE');
      const network = <eEthereumNetwork>localBRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const { ReserveAssets, ReservesConfig } = poolConfig as ICommonConfiguration;

      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);

      const addressesProvider = await getLendingPoolAddressesProvider();

      const testHelpers = await getAaveProtocolDataProvider();

      const admin = await addressesProvider.getPoolAdmin();
      if (!reserveAssets) {
        throw 'Reserve assets is undefined. Check ReserveAssets configuration at config directory';
      }

      const treasuryAddress = await getTreasuryAddress(poolConfig);

      await initReservesByHelper(ReservesConfig, reserveAssets, admin, treasuryAddress, ZERO_ADDRESS, verify);
      await configureReservesByHelper(ReservesConfig, reserveAssets, testHelpers, admin);

      const collateralManager = await deployLendingPoolCollateralManager(verify);
      await waitForTx(
        await addressesProvider.setLendingPoolCollateralManager(collateralManager.address)
      );

      await deployWalletBalancerProvider(verify);

      const wethAddress = await getWethAddress(poolConfig);
      const lendingPoolAddress = await addressesProvider.getLendingPool();

      await deployWETHGateway([wethAddress, lendingPoolAddress]);
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });
