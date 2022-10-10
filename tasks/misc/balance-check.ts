import { formatEther, parseEther } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { DRE } from '../../helpers/misc-utils';

task('balance-check', 'Checks deployer balance').setAction(async ({}, localBRE) => {
  await localBRE.run('set-DRE');

  const signers = await DRE.ethers.getSigners();
  const deployer = signers[0];
  const proxyAdmin = signers[1];

  const proxyAdminBalance = await proxyAdmin.getBalance();

  if (proxyAdminBalance.lt(parseEther('0.10'))) {
    await (
      await deployer.sendTransaction({
        to: await proxyAdmin.getAddress(),
        value: parseEther('0.15'),
      })
    ).wait();
    console.log('- Sent 0.15 ETH to proxy admin');
  }

  console.log('\nAccounts');
  console.log('========');
  console.table({
    deployer: formatEther(await deployer.getBalance()),
    proxyAdmin: formatEther(await proxyAdmin.getBalance()),
  });
});
