import {task} from 'hardhat/config';
import {printContracts} from '../../helpers/misc-utils';

task('print-contracts', 'Inits the BRE, to have access to all the plugins').setAction(
  async ({}, localBRE) => {
    await localBRE.run('set-bre');
    printContracts();
  }
);
