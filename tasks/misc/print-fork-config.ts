import { task } from 'hardhat/config';
import { getSturdyProtocolDataProvider } from '../../helpers/contracts-getters';

task('print-config:fork', 'Deploy development enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    await DRE.run('set-DRE');
    await DRE.run('sturdy:mainnet');

    const dataProvider = await getSturdyProtocolDataProvider();
    await DRE.run('print-config', { dataProvider: dataProvider.address, pool: 'Sturdy' });
  });
