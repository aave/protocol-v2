import { formatUnits } from '@ethersproject/units';
import { task } from 'hardhat/config';
import { impersonateAddress, waitForTx } from '../../helpers/misc-utils';
import { usingTenderly } from '../../helpers/tenderly-utils';
import { IERC20DetailedFactory } from '../../types/IERC20DetailedFactory';

task('dev:impersonate-transfer', 'Send ERC20 from an impersonated address')
  .addParam('from', 'Impersonate from user address')
  .addParam('to', 'Where to send impersonated funds')
  .addParam('token', 'ERC20 Token address')
  .addOptionalParam('amount', 'Optional amount in wei unit to send, by default is all')
  .setAction(async ({ from, to, token, amount }, localBRE) => {
    await localBRE.run('set-DRE');

    const fromSigner = await impersonateAddress(from);
    const erc20 = IERC20DetailedFactory.connect(token, fromSigner.signer);
    const amountToSend = amount ? amount : await erc20.balanceOf(from);
    const symbol = await erc20.symbol();
    const decimals = await erc20.decimals();
    console.log('- Transfering...');
    await waitForTx(await erc20.transfer(to, amountToSend));
    console.log('- Sent ', formatUnits(await erc20.balanceOf(from), decimals), symbol, 'to', to);

    console.log('\nBalances after transfer');
    console.log('=======================');
    console.log('from:');
    console.log('- Address:', from);
    console.log('- Balance:', formatUnits(await erc20.balanceOf(from), decimals), symbol);
    console.log('to:');
    console.log('- Address:', to);
    console.log('- Balance:', formatUnits(await erc20.balanceOf(to), decimals), symbol);
    if (usingTenderly()) {
      const postDeployHead = localBRE.tenderly.network().getHead();
      const postDeployFork = localBRE.tenderly.network().getFork();
      console.log('Tenderly Info');
      console.log('- Head', postDeployHead);
      console.log('- Fork', postDeployFork);
    }
  });
