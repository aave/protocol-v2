import { task } from 'hardhat/config';
import { setDRE } from '../../helpers/misc-utils';

task(`set-DRE`, `Inits the DRE, to have access to all the plugins' objects`).setAction(
  async (_, _DRE) => {
    setDRE(_DRE);
    return _DRE;
  }
);
