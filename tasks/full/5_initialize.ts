import {task} from '@nomiclabs/buidler/config';
import {getParamPerNetwork} from '../../helpers/contracts-helpers';
import {
  deployLendingPoolCollateralManager,
  deployWalletBalancerProvider,
  deployAaveProtocolTestHelpers,
  deployWETHGateway,
} from '../../helpers/contracts-deployments';
import {loadPoolConfig, ConfigNames, getWethAddress} from '../../helpers/configuration';
import {eEthereumNetwork, ICommonConfiguration} from '../../helpers/types';
import {waitForTx} from '../../helpers/misc-utils';
import {
  initReservesByHelper,
  enableReservesToBorrowByHelper,
  enableReservesAsCollateralByHelper,
} from '../../helpers/init-helpers';
import {exit} from 'process';
import {getLendingPoolAddressesProvider} from '../../helpers/contracts-getters';
import {ZERO_ADDRESS} from '../../helpers/constants';

task('full:initialize-lending-pool', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({verify, pool}, localBRE) => {
    try {
      await localBRE.run('set-bre');
      const network = <eEthereumNetwork>localBRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const {ReserveAssets, ReservesConfig} = poolConfig as ICommonConfiguration;

      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);

      const addressesProvider = await getLendingPoolAddressesProvider();

      const testHelpers = await deployAaveProtocolTestHelpers(addressesProvider.address, verify);

      const admin = await addressesProvider.getAaveAdmin();
      if (!reserveAssets) {
        throw 'Reserve assets is undefined. Check ReserveAssets configuration at config directory';
      }

      await initReservesByHelper(ReservesConfig, reserveAssets, admin, ZERO_ADDRESS);
      await enableReservesToBorrowByHelper(ReservesConfig, reserveAssets, testHelpers, admin);
      await enableReservesAsCollateralByHelper(ReservesConfig, reserveAssets, testHelpers, admin);

      const collateralManager = await deployLendingPoolCollateralManager(verify);
      await waitForTx(
        await addressesProvider.setLendingPoolCollateralManager(collateralManager.address)
      );

      await deployWalletBalancerProvider(addressesProvider.address, verify);

      const wethAddress = await getWethAddress(poolConfig);
      const lendingPoolAddress = await addressesProvider.getLendingPool();

      await deployWETHGateway([wethAddress, lendingPoolAddress]);
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });
