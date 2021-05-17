import { task } from 'hardhat/config';
import { DRE, setDRE } from '../../helpers/misc-utils';
import { EthereumNetworkNames } from '../../helpers/types';
import { usingTenderly } from '../../helpers/tenderly-utils';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getFirstSigner } from '../../helpers/contracts-getters';
import { formatEther } from 'ethers/lib/utils';
import { fork } from 'child_process';
import { env } from 'process';

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
      if (process.env.TENDERLY_FORK_ID && process.env.TENDERLY_HEAD_ID) {
        console.log('- Connecting to a Tenderly Fork');
        _DRE.tenderlyRPC.setFork(process.env.TENDERLY_FORK_ID);
        _DRE.tenderlyRPC.setHead(process.env.TENDERLY_HEAD_ID);
      } else {
        console.log('- Creating a new Tenderly Fork');
        await _DRE.tenderlyRPC.initializeFork();
      }
      const provider = new _DRE.ethers.providers.Web3Provider(_DRE.tenderlyRPC as any);
      _DRE.ethers.provider = provider;
      console.log('- Initialized Tenderly fork:');
      console.log('  - Fork: ', _DRE.tenderlyRPC.getFork());
      console.log('  - Head: ', _DRE.tenderlyRPC.getHead());
      console.log('  - First account:', await (await _DRE.ethers.getSigners())[0].getAddress());
      console.log(
        '  - Balance:',
        formatEther(await (await _DRE.ethers.getSigners())[0].getBalance())
      );
    }

    console.log('- Enviroment');
    if (process.env.FORK) {
      console.log('  - Fork Mode activated at network: ', process.env.FORK);
      if (_DRE?.config?.networks?.hardhat?.forking?.url) {
        console.log('  - Provider URL:', _DRE.config.networks.hardhat.forking?.url?.split('/')[2]);
      } else {
        console.error(
          `[FORK][Error], missing Provider URL for "${_DRE.network.name}" network. Fill the URL at './helper-hardhat-config.ts' file`
        );
      }
    }
    console.log('  - Network :', _DRE.network.name);
    setDRE(_DRE);
    return _DRE;
  }
);
