import { ethers } from 'ethers';
import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { getIWETH } from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { eNetwork } from '../../helpers/types';

task('wrap:ftm', 'Wrapping FTM')
  .addParam('amount', 'Wrapping amount')
  .setAction(async ({ amount }, DRE) => {
    await DRE.run('set-DRE');

    const { parseEther } = ethers.utils;

    const poolConfig = loadPoolConfig(ConfigNames.Fantom);
    const network = <eNetwork>DRE.network.name;
    const wftmAddress = getParamPerNetwork(poolConfig.WETH, network);
    const WFTM = await getIWETH(wftmAddress);

    await WFTM.deposit({ value: parseEther(amount) });

    console.log('FTM -> WFTM %s success');
  });
