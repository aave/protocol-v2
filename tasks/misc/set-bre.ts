import {ExternalProvider} from '@ethersproject/providers';

import {task} from 'hardhat/config';
import {setDRE} from '../../helpers/misc-utils';

task(`set-DRE`, `Inits the DRE, to have access to all the plugins' objects`).setAction(
  async (_, _DRE) => {
    setDRE(_DRE);
    const provider = new _DRE.ethers.providers.Web3Provider(_DRE.tenderlyRPC as ExternalProvider);
    //Set the ethers provider to the one we initialized so it targets the correct backend
    _DRE.ethers.provider = provider;
    return _DRE;
  }
);
