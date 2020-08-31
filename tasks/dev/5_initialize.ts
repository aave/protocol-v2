import {task} from '@nomiclabs/buidler/config';
import {
  getLendingPoolAddressesProvider,
  initReserves,
  deployLendingPoolLiquidationManager,
  insertContractAddressInDb,
  deployMockFlashLoanReceiver,
  deployWalletBalancerProvider,
  deployAaveProtocolTestHelpers,
  getLendingPool,
  getLendingPoolConfiguratorProxy,
  getAllMockedTokens,
} from '../../helpers/contracts-helpers';
import {getReservesConfigByPool} from '../../helpers/configuration';

import {tEthereumAddress, AavePools, eContractid} from '../../helpers/types';
import {waitForTx, filterMapBy} from '../../helpers/misc-utils';
import {enableReservesToBorrow, enableReservesAsCollateral} from '../../helpers/init-helpers';
import {getAllTokenAddresses} from '../../helpers/mock-helpers';

task('dev:initialize-lending-pool', 'Initialize lending pool configuration.')
  .addOptionalParam('verify', 'Verify contracts at Etherscan')
  .setAction(async ({verify}, localBRE) => {
    await localBRE.run('set-bre');

    const mockTokens = await getAllMockedTokens();
    const lendingPoolProxy = await getLendingPool();
    const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy();
    const allTokenAddresses = getAllTokenAddresses(mockTokens);

    const addressesProvider = await getLendingPoolAddressesProvider();

    const protoPoolReservesAddresses = <{[symbol: string]: tEthereumAddress}>(
      filterMapBy(allTokenAddresses, (key: string) => !key.includes('UNI'))
    );

    const reservesParams = getReservesConfigByPool(AavePools.proto);

    await initReserves(
      reservesParams,
      protoPoolReservesAddresses,
      addressesProvider,
      lendingPoolProxy,
      lendingPoolConfiguratorProxy,
      AavePools.proto,
      verify
    );
    await enableReservesToBorrow(
      reservesParams,
      protoPoolReservesAddresses,
      lendingPoolProxy,
      lendingPoolConfiguratorProxy
    );
    await enableReservesAsCollateral(
      reservesParams,
      protoPoolReservesAddresses,
      lendingPoolProxy,
      lendingPoolConfiguratorProxy
    );

    const liquidationManager = await deployLendingPoolLiquidationManager(verify);
    await waitForTx(
      await addressesProvider.setLendingPoolLiquidationManager(liquidationManager.address)
    );

    const mockFlashLoanReceiver = await deployMockFlashLoanReceiver(
      addressesProvider.address,
      verify
    );
    await insertContractAddressInDb(
      eContractid.MockFlashLoanReceiver,
      mockFlashLoanReceiver.address
    );

    await deployWalletBalancerProvider(addressesProvider.address, verify);

    const testHelpers = await deployAaveProtocolTestHelpers(addressesProvider.address, verify);

    await insertContractAddressInDb(eContractid.AaveProtocolTestHelpers, testHelpers.address);
  });
