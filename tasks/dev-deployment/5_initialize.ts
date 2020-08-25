import {task} from '@nomiclabs/buidler/config';
import {
  getLendingPoolAddressesProvider,
  initReserves,
  deployLendingPoolLiquidationManager,
  deployTokenDistributor,
  deployInitializableAdminUpgradeabilityProxy,
  insertContractAddressInDb,
  deployMockFlashLoanReceiver,
  deployWalletBalancerProvider,
  deployAaveProtocolTestHelpers,
  getLendingPool,
  getLendingPoolConfiguratorProxy,
  getAllMockedTokens,
} from '../../helpers/contracts-helpers';
import {getReservesConfigByPool, getFeeDistributionParamsCommon} from '../../helpers/configuration';
import {ZERO_ADDRESS} from '../../helpers/constants';

import {tEthereumAddress, AavePools, eContractid} from '../../helpers/types';
import {waitForTx, filterMapBy} from '../../helpers/misc-utils';
import {enableReservesToBorrow, enableReservesAsCollateral} from '../../helpers/init-helpers';
import {getAllTokenAddresses, getAllAggregatorsAddresses} from '../../helpers/mock-helpers';

task('initialize-lending-pool', 'Initialize lending pool configuration.')
  .addOptionalParam('verify', 'Verify contracts at Etherscan')
  .setAction(async ({verify}, localBRE) => {
    await localBRE.run('set-bre');

    const mockTokens = await getAllMockedTokens();
    const lendingPoolProxy = await getLendingPool();
    const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy();
    const [lendingPoolManager, secondaryWallet] = await Promise.all(
      (await localBRE.ethers.getSigners()).map(async (x) => x.getAddress())
    );

    const allTokenAddresses = getAllTokenAddresses(mockTokens);

    const {USD, ...tokensAddressesWithoutUsd} = allTokenAddresses;

    const addressesProvider = await getLendingPoolAddressesProvider();

    const protoPoolReservesAddresses = <{[symbol: string]: tEthereumAddress}>(
      filterMapBy(allTokenAddresses, (key: string) => !key.includes('UNI'))
    );

    const reservesParams = getReservesConfigByPool(AavePools.proto);

    console.log('Initialize configuration');
    await initReserves(
      reservesParams,
      protoPoolReservesAddresses,
      addressesProvider,
      lendingPoolProxy,
      lendingPoolConfiguratorProxy,
      AavePools.proto
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

    const {receivers, percentages} = getFeeDistributionParamsCommon(lendingPoolManager);

    const tokenDistributorImpl = await deployTokenDistributor(verify);
    const tokenDistributorProxy = await deployInitializableAdminUpgradeabilityProxy(verify);
    const implementationParams = tokenDistributorImpl.interface.encodeFunctionData('initialize', [
      ZERO_ADDRESS,
      tokensAddressesWithoutUsd.LEND,
      '0x0000000000000000000000000000000000000000', // TODO: finish removal
      receivers,
      percentages,
      Object.values(tokensAddressesWithoutUsd),
    ]);
    await waitForTx(
      await tokenDistributorProxy['initialize(address,address,bytes)'](
        tokenDistributorImpl.address,
        secondaryWallet,
        implementationParams
      )
    );
    await waitForTx(await addressesProvider.setTokenDistributor(tokenDistributorProxy.address));

    await insertContractAddressInDb(eContractid.TokenDistributor, tokenDistributorProxy.address);

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
