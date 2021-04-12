import { task } from 'hardhat/config';
import { eContractid, eEthereumNetwork, ePolygonNetwork } from '../../helpers/types';
import { deployUiPoolDataProvider } from '../../helpers/contracts-deployments';

task(`deploy-${eContractid.UiPoolDataProvider}`, `Deploys the UiPoolDataProvider contract`)
  .addFlag('verify', 'Verify UiPoolDataProvider contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');
    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const addressesByNetwork = {
      // [eEthereumNetwork.kovan]: {
      //   incentivesController: '',
      //   aaveOracle: '',
      // },
      // [eEthereumNetwork.main]: {
      //   incentivesController: '',
      //   aaveOracle: '0xa50ba011c48153de246e5192c8f9258a2ba79ca9',
      // },
      [ePolygonNetwork.matic]: {
        incentivesController: '0x357D51124f59836DeD84c8a1730D72B749d8BC23',
        aaveOracle: '0x21451bD7b528896B4AB2b9764b521D6ed641708d',
      },
      [ePolygonNetwork.mumbai]: {
        incentivesController: '0xCA8f76C244271A857CE76263e60d294EB24186A8',
        aaveOracle: '0x3cC6db8dBBa233Fe342c2c8379993aCa231674bd',
      },
    };

    console.log(`\n- UiPoolDataProvider deployment`);

    console.log(`\tDeploying UiPoolDataProvider implementation ...`);
    const UiPoolDataProvider = await deployUiPoolDataProvider(
      [
        addressesByNetwork[localBRE.network.name].incentivesController,
        addressesByNetwork[localBRE.network.name].aaveOracle,
      ],
      verify
    );

    console.log(`\tFinished UiPoolDataProvider deployment: ${UiPoolDataProvider.address}`);
  });
