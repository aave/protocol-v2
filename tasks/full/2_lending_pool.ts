import {task} from 'hardhat/config';
import {insertContractAddressInDb} from '../../helpers/contracts-helpers';
import {
  deployATokensAndRatesHelper,
  deployLendingPool,
  deployLendingPoolConfigurator,
  deployStableAndVariableTokensHelper,
} from '../../helpers/contracts-deployments';
import {eContractid} from '../../helpers/types';
import {waitForTx} from '../../helpers/misc-utils';
import {
  getLendingPoolAddressesProvider,
  getLendingPool,
  getLendingPoolConfiguratorProxy,
} from '../../helpers/contracts-getters';

task('full:deploy-lending-pool', 'Deploy lending pool for dev enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({verify}, DRE) => {
    try {
      await DRE.run('set-DRE');

      const addressesProvider = await getLendingPoolAddressesProvider();

      // Deploy lending pool
      const lendingPoolImpl = await deployLendingPool(verify);

      console.log('setting up lending pool', addressesProvider);
      // Set lending pool impl to address provider
      await waitForTx(await addressesProvider.setLendingPoolImpl(lendingPoolImpl.address));
      console.log('lending pool setted');

      const address = await addressesProvider.getLendingPool();
      const lendingPoolProxy = await getLendingPool(address);

      await insertContractAddressInDb(eContractid.LendingPool, lendingPoolProxy.address);

      // Deploy lending pool configurator
      const lendingPoolConfiguratorImpl = await deployLendingPoolConfigurator(verify);

      console.log('set up x');
      // Set lending pool conf impl to Address Provider
      await waitForTx(
        await addressesProvider.setLendingPoolConfiguratorImpl(lendingPoolConfiguratorImpl.address)
      );

      console.log('set up x');
      const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy(
        await addressesProvider.getLendingPoolConfigurator()
      );

      await insertContractAddressInDb(
        eContractid.LendingPoolConfigurator,
        lendingPoolConfiguratorProxy.address
      );
      // Deploy deployment helpers
      await deployStableAndVariableTokensHelper(
        [lendingPoolProxy.address, addressesProvider.address],
        verify
      );
      console.log('set up x');
      await deployATokensAndRatesHelper(
        [lendingPoolProxy.address, addressesProvider.address, lendingPoolConfiguratorProxy.address],
        verify
      );
    } catch (error) {
      const transactionLink = `https://dashboard.tenderly.co/fork/${DRE.tenderlyRPC.getFork()}/simulation/${DRE.tenderlyRPC.getHead()}`;
      console.log(transactionLink);
    }
  });
