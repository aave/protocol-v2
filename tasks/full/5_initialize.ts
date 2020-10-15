import {task} from '@nomiclabs/buidler/config';
import {
  getLendingPoolAddressesProvider,
  initReserves,
  deployLendingPoolCollateralManager,
  insertContractAddressInDb,
  deployWalletBalancerProvider,
  deployAaveProtocolTestHelpers,
  getLendingPool,
  getLendingPoolConfiguratorProxy,
  getParamPerNetwork,
} from '../../helpers/contracts-helpers';
import {loadPoolConfig, ConfigNames} from '../../helpers/configuration';

import {AavePools, eContractid, eEthereumNetwork, ICommonConfiguration} from '../../helpers/types';
import {waitForTx} from '../../helpers/misc-utils';
import {enableReservesToBorrow, enableReservesAsCollateral} from '../../helpers/init-helpers';
import {ZERO_ADDRESS} from '../../helpers/constants';
import {exit} from 'process';

task('full:initialize-lending-pool', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({verify, pool}, localBRE) => {
    try {
      await localBRE.run('set-bre');
      console.log('init');
      const network = <eEthereumNetwork>localBRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const {ReserveAssets, ReservesConfig} = poolConfig as ICommonConfiguration;

      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
      const lendingPoolProxy = await getLendingPool();
      const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy();

      const addressesProvider = await getLendingPoolAddressesProvider();

      const testHelpers = await deployAaveProtocolTestHelpers(addressesProvider.address, verify);

      console.log('init reserves');
      await initReserves(
        ReservesConfig,
        reserveAssets,
        addressesProvider,
        lendingPoolProxy,
        testHelpers,
        lendingPoolConfiguratorProxy,
        AavePools.proto,
        ZERO_ADDRESS,
        verify
      );
      console.log('enable reserves');
      await enableReservesToBorrow(
        ReservesConfig,
        reserveAssets,
        testHelpers,
        lendingPoolConfiguratorProxy
      );
      console.log('enable reserves as collateral');
      await enableReservesAsCollateral(
        ReservesConfig,
        reserveAssets,
        testHelpers,
        lendingPoolConfiguratorProxy
      );

      console.log('deploy coll manager');
      const collateralManager = await deployLendingPoolCollateralManager(verify);
      await waitForTx(
        await addressesProvider.setLendingPoolCollateralManager(collateralManager.address)
      );

      console.log('deploy bal provicer');
      await deployWalletBalancerProvider(addressesProvider.address, verify);
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });
