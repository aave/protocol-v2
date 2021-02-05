import { task } from 'hardhat/config';
import { DRE, setDRE } from '../../helpers/misc-utils';
import { EthereumNetworkNames } from '../../helpers/types';
import { usingTenderly } from '../../helpers/tenderly-utils';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

task(`set-DRE`, `Inits the DRE, to have access to all the plugins' objects`).setAction(
  async (_, _DRE) => {
    if (DRE) {
      return;
    }
    if (
      (_DRE as HardhatRuntimeEnvironment).network.name.includes('tenderly') ||
      process.env.TENDERLY === 'true'
    ) {
      console.log('- Setting up Tenderly provider');
      await _DRE.tenderlyRPC.initializeFork();
      console.log('- Initialized Tenderly fork');
      const provider = new _DRE.ethers.providers.Web3Provider(_DRE.tenderlyRPC as any);
      _DRE.ethers.provider = provider;
    }

    setDRE(_DRE);
    return _DRE;
  }
);
