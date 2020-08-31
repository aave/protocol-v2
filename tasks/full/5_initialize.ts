import {task} from '@nomiclabs/buidler/config';
import {
  getLendingPoolAddressesProvider,
  initReserves,
  deployLendingPoolLiquidationManager,
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

task('full:initialize-lending-pool', 'Initialize lending pool configuration.')
  .addOptionalParam('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({verify, pool}, localBRE) => {
    await localBRE.run('set-bre');
    const network = <eEthereumNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const {ReserveAssets, ReservesConfig} = poolConfig as ICommonConfiguration;

    const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
    const lendingPoolProxy = await getLendingPool();
    const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy();

    const addressesProvider = await getLendingPoolAddressesProvider();

    await initReserves(
      ReservesConfig,
      reserveAssets,
      addressesProvider,
      lendingPoolProxy,
      lendingPoolConfiguratorProxy,
      AavePools.proto,
      verify
    );
    await enableReservesToBorrow(
      ReservesConfig,
      reserveAssets,
      lendingPoolProxy,
      lendingPoolConfiguratorProxy
    );
    await enableReservesAsCollateral(
      ReservesConfig,
      reserveAssets,
      lendingPoolProxy,
      lendingPoolConfiguratorProxy
    );

    const liquidationManager = await deployLendingPoolLiquidationManager(verify);
    await waitForTx(
      await addressesProvider.setLendingPoolLiquidationManager(liquidationManager.address)
    );

    await deployWalletBalancerProvider(addressesProvider.address, verify);

    const testHelpers = await deployAaveProtocolTestHelpers(addressesProvider.address, verify);

    await insertContractAddressInDb(eContractid.AaveProtocolTestHelpers, testHelpers.address);
  });
