import { task } from 'hardhat/config';
import { eContractid, eEthereumNetwork, ePolygonNetwork } from '../../helpers/types';
import { deployUiPoolDataProvider } from '../../helpers/contracts-deployments';

task(`deploy-${eContractid.UiPoolDataProvider}`, `Deploys the UiPoolDataProvider contract`)
  .addFlag('verify', 'Verify UiPoolDataProvider contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');
    console.log('founds: ', await localBRE.ethers.getSigners());
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
        incentivesController: '0xc31c45a46e55f714f9CB2b43Ae688487C16616e2',
        aaveOracle: '0x584c84AA7aE807e18957f8E3693BccBD482357E2',
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
