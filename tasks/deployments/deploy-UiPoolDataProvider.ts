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
      [eEthereumNetwork.kovan]: {
        incentivesController: '0x0000000000000000000000000000000000000000',
        aaveOracle: '0x8fb777d67e9945e2c01936e319057f9d41d559e6',
      },
      [eEthereumNetwork.main]: {
        incentivesController: '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5',
        aaveOracle: '0xa50ba011c48153de246e5192c8f9258a2ba79ca9',
      },
      [ePolygonNetwork.matic]: {
        incentivesController: '0x357D51124f59836DeD84c8a1730D72B749d8BC23',
        aaveOracle: '0x21451bD7b528896B4AB2b9764b521D6ed641708d',
      },
      [ePolygonNetwork.mumbai]: {
        incentivesController: '0xd41aE58e803Edf4304334acCE4DC4Ec34a63C644',
        aaveOracle: '0xC365C653f7229894F93994CD0b30947Ab69Ff1D5',
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
